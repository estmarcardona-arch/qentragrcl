-- 0007_auth_session.sql · Etapa E1 (núcleo GxP)
-- Bloqueo de cuenta tras intentos fallidos (hook de Supabase Auth), eventos de sesión en la
-- bitácora (RF-01) y consulta de la bitácora de un registro (AuditTrailPanel).

-- ---------------------------------------------------------------------------
-- Intentos fallidos de inicio de sesión
-- ---------------------------------------------------------------------------
create table public.login_attempts (
  user_id uuid primary key references public.profiles (id),
  failed_count int not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.login_attempts enable row level security;
select app_private.register_table('public.login_attempts');
revoke all on table public.login_attempts from public, anon, authenticated;

-- Hook «password verification attempt» de Supabase Auth. Se ejecuta en cada verificación de
-- contraseña, así el bloqueo no se puede saltar llamando la API de Auth directamente.
-- Se activa en supabase/config.toml (local y CI) y en el panel de Supabase (nube).
-- La interfaz muestra un mensaje único que no revela si el usuario existe.
create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (event ->> 'user_id')::uuid;
  v_valid boolean := coalesce((event ->> 'valid')::boolean, false);
  v_max int := coalesce((public.get_setting('login_max_failed_attempts'))::int, 5);
  v_lock_min int := coalesce((public.get_setting('login_lockout_minutes'))::int, 15);
  v_row public.login_attempts;
  v_count int;
begin
  if not exists (select 1 from public.profiles where id = v_uid) then
    return jsonb_build_object('decision', 'continue');
  end if;

  select * into v_row from public.login_attempts where user_id = v_uid for update;

  if found and v_row.locked_until is not null and v_row.locked_until > now() then
    insert into public.audit_log (actor_id, action, table_name, record_id, reason)
    values (v_uid, 'auth.login_rejected_locked', 'auth.users', v_uid, 'Cuenta bloqueada por intentos fallidos');
    return jsonb_build_object('decision', 'reject', 'message', 'ACCOUNT_LOCKED', 'should_logout_user', false);
  end if;

  if v_valid then
    delete from public.login_attempts where user_id = v_uid;
    return jsonb_build_object('decision', 'continue');
  end if;

  v_count := coalesce(v_row.failed_count, 0) + 1;
  insert into public.audit_log (actor_id, action, table_name, record_id, reason)
  values (v_uid, 'auth.login_failed', 'auth.users', v_uid, format('Intento fallido %s de %s', v_count, v_max));

  if v_count >= v_max then
    insert into public.login_attempts (user_id, failed_count, locked_until, last_failed_at)
    values (v_uid, 0, now() + make_interval(mins => v_lock_min), now())
    on conflict (user_id) do update
      set failed_count = 0, locked_until = excluded.locked_until, last_failed_at = now();
    insert into public.audit_log (actor_id, action, table_name, record_id, reason)
    values (v_uid, 'auth.account_locked', 'auth.users', v_uid,
            format('Bloqueo de %s minutos tras %s intentos fallidos', v_lock_min, v_max));
  else
    insert into public.login_attempts (user_id, failed_count, last_failed_at)
    values (v_uid, v_count, now())
    on conflict (user_id) do update set failed_count = v_count, last_failed_at = now();
  end if;

  return jsonb_build_object('decision', 'continue');
end;
$$;

revoke execute on function public.hook_password_verification_attempt(jsonb) from public, anon, authenticated;
grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Eventos de sesión en la bitácora (RF-01)
-- ---------------------------------------------------------------------------
create or replace function public.log_session_event(p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN_ROLE: se requiere una sesión';
  end if;
  if p_action not in ('login', 'logout', 'session_expired') then
    raise exception 'INVALID_TRANSITION: evento de sesión no válido: %', p_action;
  end if;
  insert into public.audit_log (actor_id, action, table_name, record_id, reason)
  values (auth.uid(), 'auth.' || p_action, 'auth.users', auth.uid(),
          case p_action when 'session_expired' then 'Cierre por inactividad' end);
end;
$$;

revoke execute on function public.log_session_event(text) from public, anon;
grant execute on function public.log_session_event(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Bitácora de un registro (AuditTrailPanel): cambios del registro, sus firmas y sus correcciones
-- ---------------------------------------------------------------------------
-- security invoker: respeta la política de lectura de audit_log.
create or replace function public.get_audit_trail(p_table text, p_record_id uuid)
returns table (
  id bigint,
  at timestamptz,
  actor_id uuid,
  actor_name text,
  actor_short_signature text,
  action text,
  table_name text,
  before jsonb,
  after jsonb,
  reason text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, a.at, a.actor_id, p.full_name, sr.short_signature, a.action, a.table_name,
         a.before, a.after, a.reason
  from public.audit_log a
  left join public.profiles p on p.id = a.actor_id
  left join public.signature_registry sr on sr.user_id = a.actor_id
  where (a.table_name = p_table and a.record_id = p_record_id)
     or (a.table_name in ('signatures', 'corrections')
         and a.after ->> 'record_table' = p_table
         and a.after ->> 'record_id' = p_record_id::text)
  order by a.at desc, a.id desc;
$$;

revoke execute on function public.get_audit_trail(text, uuid) from public, anon;
grant execute on function public.get_audit_trail(text, uuid) to authenticated;
