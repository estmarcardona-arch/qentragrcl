-- 0009_admin_users.sql · Etapa E2 (administración)
-- Gestión de usuarios y roles (S-03, RF-03): alta (invitación desde el servidor), edición,
-- desactivación (nunca borrado), roles con vigencia, auditor con vencimiento obligatorio (AC-11),
-- combinaciones de roles prohibidas, firma corta y política de contraseñas.

-- ---------------------------------------------------------------------------
-- Configuración nueva
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, description) values
  ('password_min_length', '12', 'Longitud mínima de la contraseña.'),
  ('password_history_count', '5', 'Contraseñas anteriores que no se pueden reutilizar (D-35).'),
  ('password_max_age_days', '0', 'Días de vigencia de la contraseña; 0 = sin caducidad (D-35).');

-- ---------------------------------------------------------------------------
-- Perfil: estado de la contraseña
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column password_changed_at timestamptz,
  add column must_change_password boolean not null default false;

-- Historial de contraseñas (hash bcrypt). En app_private: nunca se expone ni pasa por la bitácora.
create table app_private.password_history (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id),
  password_hash text not null,
  created_at timestamptz not null default now()
);

create index password_history_user_idx on app_private.password_history (user_id, created_at desc);
alter table app_private.password_history enable row level security;
revoke all on table app_private.password_history from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Combinaciones de roles prohibidas en un mismo usuario
-- ---------------------------------------------------------------------------
create table public.role_incompatibilities (
  id uuid primary key default gen_random_uuid(),
  role_a public.app_role not null,
  role_b public.app_role not null,
  rule_code text not null,
  message text not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (role_a < role_b),
  unique (role_a, role_b)
);

comment on table public.role_incompatibilities is
  'Roles que no puede tener la misma persona. La SOD se evalúa además por registro (check_sod).';

alter table public.role_incompatibilities enable row level security;
select app_private.register_table('public.role_incompatibilities', p_no_delete => true);
create policy "authenticated can read role incompatibilities" on public.role_incompatibilities
  for select to authenticated using (true);
revoke all on table public.role_incompatibilities from anon;
revoke insert, update, delete, truncate on table public.role_incompatibilities from authenticated;

-- Pares ordenados (role_a < role_b según el orden del enum).
insert into public.role_incompatibilities (role_a, role_b, rule_code, message)
select least(a, b), greatest(a, b), code, msg from (values
  ('admin'::public.app_role, 'master'::public.app_role, 'D-18',
   'El administrador del sistema y el usuario master son roles separados (D-18).'),
  ('admin', 'lab_aux', 'SOD-7', 'El administrador no puede firmar registros de calidad (SOD-7).'),
  ('admin', 'cc_jefe', 'SOD-7', 'El administrador no puede firmar registros de calidad (SOD-7).'),
  ('admin', 'aq_dir', 'SOD-7', 'El administrador no puede firmar registros de calidad (SOD-7).'),
  ('admin', 'dt', 'SOD-7', 'El administrador no puede firmar registros de calidad (SOD-7).'),
  ('master', 'prod_aux', 'SOD-9', 'El usuario master no firma registros de ejecución de lote (SOD-9).'),
  ('master', 'prod_coord', 'SOD-9', 'El usuario master no firma registros de ejecución de lote (SOD-9).'),
  ('aq_doc', 'prod_aux', 'SOD-9', 'La analista de gestión documental no firma registros de ejecución (SOD-9).'),
  ('aq_doc', 'prod_coord', 'SOD-9', 'La analista de gestión documental no firma registros de ejecución (SOD-9).')
) as t(a, b, code, msg);

-- ---------------------------------------------------------------------------
-- Ayudas
-- ---------------------------------------------------------------------------
create or replace function app_private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'FORBIDDEN_ROLE: solo el administrador del sistema administra usuarios y configuración';
  end if;
end;
$$;

create or replace function app_private.require_reason(p_reason text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED: este cambio exige un motivo';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Listado de usuarios (S-03)
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (
  id uuid,
  full_name text,
  email text,
  job_title text,
  area_id uuid,
  area_name text,
  active boolean,
  short_signature text,
  roles jsonb,
  last_sign_in_at timestamptz,
  invitation_pending boolean,
  must_change_password boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_admin();
  return query
  select p.id, p.full_name, p.email, p.job_title, p.area_id, a.name, p.active, sr.short_signature,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', ur.id, 'role', ur.role, 'granted_at', ur.granted_at, 'expires_at', ur.expires_at,
             'active', (ur.expires_at is null or ur.expires_at > now())
           ) order by ur.role)
           from public.user_roles ur where ur.user_id = p.id and ur.revoked_at is null
         ), '[]'::jsonb),
         u.last_sign_in_at,
         (u.email_confirmed_at is null and u.invited_at is not null),
         p.must_change_password
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.organizational_areas a on a.id = p.area_id
  left join public.signature_registry sr on sr.user_id = p.id
  order by p.full_name;
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- ---------------------------------------------------------------------------
-- Datos del usuario
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_profile(
  p_user uuid,
  p_full_name text,
  p_job_title text,
  p_area_id uuid,
  p_document_id text,
  p_must_change_password boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  if p_full_name is null or length(trim(p_full_name)) = 0 then
    raise exception 'INVALID_FIELD: el nombre es obligatorio';
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.profiles
  set full_name = trim(p_full_name),
      job_title = nullif(trim(p_job_title), ''),
      area_id = p_area_id,
      document_id = nullif(trim(p_document_id), ''),
      must_change_password = coalesce(p_must_change_password, must_change_password)
  where id = p_user;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el usuario %', p_user;
  end if;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- Desactivación (nunca borrado). El usuario desactivado no inicia sesión ni conserva su sesión.
create or replace function public.admin_set_user_active(p_user uuid, p_active boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  if p_user = auth.uid() and not p_active then
    raise exception 'FORBIDDEN_ROLE: no puede desactivar su propio usuario';
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.profiles set active = p_active where id = p_user;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el usuario %', p_user;
  end if;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Roles con vigencia
-- ---------------------------------------------------------------------------
create or replace function public.admin_grant_role(
  p_user uuid,
  p_role public.app_role,
  p_expires_at timestamptz,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conflict public.role_incompatibilities;
  v_id uuid;
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'RECORD_NOT_FOUND: no existe el usuario %', p_user;
  end if;
  if p_role = 'auditor' and p_expires_at is null then
    raise exception 'INVALID_FIELD: el acceso de auditor exige fecha de vencimiento (RF-03)';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'INVALID_FIELD: la fecha de vencimiento debe ser futura';
  end if;
  if exists (select 1 from public.user_roles where user_id = p_user and role = p_role and revoked_at is null) then
    raise exception 'INVALID_TRANSITION: el usuario ya tiene el rol %', p_role;
  end if;

  select ri.* into v_conflict
  from public.role_incompatibilities ri
  join public.user_roles ur on ur.user_id = p_user and ur.revoked_at is null
    and (ur.expires_at is null or ur.expires_at > now())
  where (ri.role_a = p_role and ri.role_b = ur.role) or (ri.role_b = p_role and ri.role_a = ur.role)
  limit 1;
  if found then
    raise exception 'ROLE_INCOMPATIBLE: %: %', v_conflict.rule_code, v_conflict.message;
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);
  insert into public.user_roles (user_id, role, granted_by, expires_at)
  values (p_user, p_role, auth.uid(), p_expires_at)
  returning id into v_id;
  perform set_config('app.audit_reason', '', true);
  return v_id;
end;
$$;

-- Ampliar o fijar el vencimiento de un rol (p. ej. ampliar el acceso de un auditor).
create or replace function public.admin_set_role_expiry(p_user_role uuid, p_expires_at timestamptz, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_roles;
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  select * into v_role from public.user_roles where id = p_user_role and revoked_at is null;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el rol asignado %', p_user_role;
  end if;
  if v_role.role = 'auditor' and p_expires_at is null then
    raise exception 'INVALID_FIELD: el acceso de auditor exige fecha de vencimiento (RF-03)';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'INVALID_FIELD: la fecha de vencimiento debe ser futura';
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.user_roles set expires_at = p_expires_at where id = p_user_role;
  perform set_config('app.audit_reason', '', true);
end;
$$;

create or replace function public.admin_revoke_role(p_user_role uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_roles;
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  select * into v_role from public.user_roles where id = p_user_role and revoked_at is null;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el rol asignado %', p_user_role;
  end if;
  if v_role.user_id = auth.uid() and v_role.role = 'admin' then
    raise exception 'FORBIDDEN_ROLE: no puede quitarse su propio rol de administrador';
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.user_roles set revoked_at = now(), revoked_by = auth.uid() where id = p_user_role;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- Firma corta registrada (DI-11). La rúbrica en imagen queda para una etapa posterior (D-37).
create or replace function public.admin_set_short_signature(p_user uuid, p_short text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  if p_short is null or length(trim(p_short)) = 0 then
    raise exception 'INVALID_FIELD: la firma corta es obligatoria';
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.signature_registry
  set short_signature = trim(p_short), registered_at = now()
  where user_id = p_user;
  if not found then
    insert into public.signature_registry (user_id, short_signature) values (p_user, trim(p_short));
  end if;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Configuración del sistema (una sola tabla con bitácora)
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_setting(p_key text, p_value jsonb, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_num numeric;
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  if not exists (select 1 from public.app_settings where key = p_key) then
    raise exception 'RECORD_NOT_FOUND: no existe la configuración %', p_key;
  end if;

  if p_key in ('session_idle_minutes', 'login_max_failed_attempts', 'login_lockout_minutes',
               'sign_max_failed_attempts', 'sign_lockout_minutes', 'corrections_warning_threshold',
               'password_min_length', 'password_history_count', 'password_max_age_days') then
    if jsonb_typeof(p_value) <> 'number' then
      raise exception 'INVALID_FIELD: % debe ser un número', p_key;
    end if;
    v_num := (p_value #>> '{}')::numeric;
    if v_num <> trunc(v_num)
       or (p_key = 'session_idle_minutes' and v_num not between 1 and 480)
       or (p_key in ('login_max_failed_attempts', 'sign_max_failed_attempts') and v_num not between 1 and 20)
       or (p_key in ('login_lockout_minutes', 'sign_lockout_minutes') and v_num not between 1 and 1440)
       or (p_key = 'corrections_warning_threshold' and v_num not between 1 and 100)
       or (p_key = 'password_min_length' and v_num not between 12 and 128)
       or (p_key = 'password_history_count' and v_num not between 0 and 24)
       or (p_key = 'password_max_age_days' and v_num not between 0 and 3650) then
      raise exception 'INVALID_FIELD: valor fuera de rango para %', p_key;
    end if;
  elsif p_key = 'reauth_method' then
    if p_value #>> '{}' not in ('password', 'password_mfa') then
      raise exception 'INVALID_FIELD: método de reautenticación no válido';
    end if;
  elsif p_key = 'maquila_enabled' then
    if jsonb_typeof(p_value) <> 'boolean' then
      raise exception 'INVALID_FIELD: maquila_enabled debe ser verdadero o falso';
    end if;
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.app_settings set value = p_value where key = p_key;
  perform set_config('app.audit_reason', '', true);
end;
$$;

revoke execute on function public.admin_update_profile(uuid, text, text, uuid, text, boolean, text) from public, anon;
revoke execute on function public.admin_set_user_active(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_grant_role(uuid, public.app_role, timestamptz, text) from public, anon;
revoke execute on function public.admin_set_role_expiry(uuid, timestamptz, text) from public, anon;
revoke execute on function public.admin_revoke_role(uuid, text) from public, anon;
revoke execute on function public.admin_set_short_signature(uuid, text, text) from public, anon;
revoke execute on function public.admin_update_setting(text, jsonb, text) from public, anon;
grant execute on function public.admin_update_profile(uuid, text, text, uuid, text, boolean, text) to authenticated;
grant execute on function public.admin_set_user_active(uuid, boolean, text) to authenticated;
grant execute on function public.admin_grant_role(uuid, public.app_role, timestamptz, text) to authenticated;
grant execute on function public.admin_set_role_expiry(uuid, timestamptz, text) to authenticated;
grant execute on function public.admin_revoke_role(uuid, text) to authenticated;
grant execute on function public.admin_set_short_signature(uuid, text, text) to authenticated;
grant execute on function public.admin_update_setting(text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Política de contraseñas: longitud mínima, sin reutilizar la actual ni las N anteriores, caducidad
-- ---------------------------------------------------------------------------
create or replace function public.check_password_policy(p_password text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_min int := coalesce((public.get_setting('password_min_length'))::int, 12);
  v_hist int := coalesce((public.get_setting('password_history_count'))::int, 5);
  v_errors text[] := '{}';
  v_current text;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN_ROLE: se requiere una sesión';
  end if;
  if p_password is null or length(p_password) < v_min then
    v_errors := v_errors || format('Debe tener al menos %s caracteres.', v_min);
  end if;
  select encrypted_password into v_current from auth.users where id = v_uid;
  if p_password is not null and v_current is not null and extensions.crypt(p_password, v_current) = v_current then
    v_errors := v_errors || 'No puede reutilizar la contraseña actual.'::text;
  elsif p_password is not null and v_hist > 0 and exists (
    select 1 from (
      select password_hash from app_private.password_history
      where user_id = v_uid order by created_at desc limit v_hist
    ) h where extensions.crypt(p_password, h.password_hash) = h.password_hash
  ) then
    v_errors := v_errors || format('No puede reutilizar ninguna de sus últimas %s contraseñas.', v_hist);
  end if;
  return jsonb_build_object('ok', cardinality(v_errors) = 0, 'errors', to_jsonb(v_errors), 'min_length', v_min);
end;
$$;

-- Se llama después de cambiar la contraseña en Supabase Auth.
create or replace function public.record_password_change(p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hist int := coalesce((public.get_setting('password_history_count'))::int, 5);
  v_current text;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN_ROLE: se requiere una sesión';
  end if;
  -- Solo se registra si es realmente la contraseña vigente en Auth.
  select encrypted_password into v_current from auth.users where id = v_uid;
  if v_current is null or extensions.crypt(p_password, v_current) <> v_current then
    raise exception 'REAUTH_FAILED: la contraseña registrada no coincide con la vigente';
  end if;
  insert into app_private.password_history (user_id, password_hash)
  values (v_uid, extensions.crypt(p_password, extensions.gen_salt('bf')));
  delete from app_private.password_history
  where user_id = v_uid and id not in (
    select id from app_private.password_history where user_id = v_uid
    order by created_at desc limit greatest(v_hist, 1)
  );
  update public.profiles set password_changed_at = now(), must_change_password = false where id = v_uid;
  insert into public.audit_log (actor_id, action, table_name, record_id, reason)
  values (v_uid, 'auth.password_changed', 'auth.users', v_uid, 'Cambio de contraseña');
end;
$$;

revoke execute on function public.check_password_policy(text) from public, anon;
revoke execute on function public.record_password_change(text) from public, anon;
grant execute on function public.check_password_policy(text) to authenticated;
grant execute on function public.record_password_change(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Contexto del usuario: vencimiento de acceso (AC-11) y estado de la contraseña
-- ---------------------------------------------------------------------------
create or replace function public.get_my_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', p.id,
    'full_name', p.full_name,
    'email', p.email,
    'job_title', p.job_title,
    'area', a.name,
    'active', p.active,
    'short_signature', sr.short_signature,
    'roles', to_jsonb(public.user_active_roles(p.id)),
    'access_expired_at', (
      select max(ur.expires_at) from public.user_roles ur
      where ur.user_id = p.id and ur.revoked_at is null and ur.expires_at <= now()
    ),
    'must_change_password', p.must_change_password,
    'password_expired', (
      coalesce((public.get_setting('password_max_age_days'))::int, 0) > 0
      and coalesce(p.password_changed_at, p.created_at)
          < now() - make_interval(days => (public.get_setting('password_max_age_days'))::int)
    ),
    'session_idle_minutes', (public.get_setting('session_idle_minutes'))::int,
    'reauth_method', public.get_setting('reauth_method') #>> '{}'
  )
  from public.profiles p
  left join public.signature_registry sr on sr.user_id = p.id
  left join public.organizational_areas a on a.id = p.area_id
  where p.id = auth.uid();
$$;
