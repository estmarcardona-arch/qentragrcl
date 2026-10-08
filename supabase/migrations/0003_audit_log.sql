-- 0003_audit_log.sql · Etapa E1 (núcleo GxP)
-- Bitácora de auditoría de solo-agregar (PRD DI-1) y utilidades para registrar tablas de negocio:
-- metadatos de fila (created_by/updated_by/updated_at), bitácora, bloqueo tras firma (DI-3)
-- y prohibición de borrado físico (DI-10).

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  ip text
);

comment on table public.audit_log is
  'Bitácora de auditoría de solo-agregar (PRD DI-1). Nadie puede modificarla ni borrarla.';

create index audit_log_table_record_idx on public.audit_log (table_name, record_id);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_at_idx on public.audit_log (at);

alter table public.audit_log enable row level security;

-- Solo lectura vía API (la política de lectura se crea en 0004, cuando existen los roles).
revoke all on table public.audit_log from public, anon, authenticated, service_role;
grant select on table public.audit_log to authenticated;
revoke all on sequence public.audit_log_id_seq from public, anon, authenticated, service_role;

-- Defensa adicional: ni siquiera el dueño puede modificar o vaciar la bitácora sin quitar este trigger.
create or replace function app_private.audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'AUDIT_LOG_IMMUTABLE: la bitácora no se puede modificar ni eliminar'
    using errcode = '42501';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function app_private.audit_log_immutable();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function app_private.audit_log_immutable();

-- ---------------------------------------------------------------------------
-- Trigger genérico de bitácora
-- ---------------------------------------------------------------------------
-- Registra quién (auth.uid()), qué (acción, tabla, id, antes/después), cuándo (now() del servidor),
-- motivo (app.audit_reason, lo fijan las RPC) e IP (encabezados de PostgREST).
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_ip text;
  v_reason text := nullif(current_setting('app.audit_reason', true), '');
  v_before jsonb;
  v_after jsonb;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    v_ip := split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1);
  exception when others then
    v_ip := null;
  end;

  if tg_op in ('UPDATE', 'DELETE') then v_before := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_after := to_jsonb(new); end if;

  insert into public.audit_log (actor_id, action, table_name, record_id, before, after, reason, ip)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce((v_after ->> 'id'), (v_before ->> 'id'))::uuid,
    v_before,
    v_after,
    v_reason,
    nullif(trim(v_ip), '')
  );
  return null;
end;
$$;

revoke execute on function public.audit_row_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Metadatos de fila: created_by / updated_by / updated_at con usuario y hora del servidor
-- ---------------------------------------------------------------------------
create or replace function public.set_row_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_at := now();
    new.updated_by := coalesce(new.updated_by, auth.uid());
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$$;

revoke execute on function public.set_row_metadata() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bloqueo tras firma (DI-3) y sin borrado físico (DI-10)
-- ---------------------------------------------------------------------------
-- Un registro con locked_at no se modifica ni se borra: RECORD_LOCKED.
-- Única excepción: la propia RPC de firma, que solo cambia status/locked_at del registro que firma.
create or replace function public.enforce_record_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_volatile text[] := array['status', 'locked_at', 'updated_at', 'updated_by'];
begin
  if (v_old ->> 'locked_at') is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE'
     and current_setting('app.signing_record', true) = tg_table_name || ':' || (v_old ->> 'id')
     and (to_jsonb(new) - v_volatile) = (v_old - v_volatile) then
    return new;
  end if;

  raise exception 'RECORD_LOCKED: el registro % de % está firmado y bloqueado', v_old ->> 'id', tg_table_name
    using errcode = 'P0001';
end;
$$;

revoke execute on function public.enforce_record_lock() from public, anon, authenticated;

create or replace function public.prevent_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'RECORD_LOCKED: no se permite borrar registros de % (PRD DI-10)', tg_table_name
    using errcode = 'P0001';
end;
$$;

revoke execute on function public.prevent_delete() from public, anon, authenticated;

-- Las firmas, correcciones y demás evidencias no se modifican: solo se agregan.
create or replace function public.prevent_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'RECORD_LOCKED: los registros de % no se modifican; solo se agregan', tg_table_name
    using errcode = 'P0001';
end;
$$;

revoke execute on function public.prevent_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registro de tablas de negocio (lo usan todas las migraciones siguientes)
-- ---------------------------------------------------------------------------
-- p_signable: agrega el bloqueo tras firma (la tabla debe tener locked_at).
-- p_no_delete: prohíbe el borrado físico (registros de lote, calidad y firmas).
-- p_append_only: prohíbe además toda modificación.
create or replace function app_private.register_table(
  p_table regclass,
  p_signable boolean default false,
  p_no_delete boolean default false,
  p_append_only boolean default false
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_name text := (select relname from pg_class where oid = p_table);
  v_has_meta boolean;
begin
  select count(*) = 4 into v_has_meta
  from information_schema.columns
  where table_schema = 'public' and table_name = v_name
    and column_name in ('created_at', 'created_by', 'updated_at', 'updated_by');

  if v_has_meta then
    execute format(
      'create trigger %I before insert or update on %s for each row execute function public.set_row_metadata()',
      v_name || '_set_metadata', p_table);
  end if;

  execute format(
    'create trigger %I after insert or update or delete on %s for each row execute function public.audit_row_change()',
    v_name || '_audit', p_table);

  if p_signable then
    execute format(
      'create trigger %I before update or delete on %s for each row execute function public.enforce_record_lock()',
      v_name || '_record_lock', p_table);
  end if;

  if p_no_delete or p_append_only then
    execute format(
      'create trigger %I before delete on %s for each row execute function public.prevent_delete()',
      v_name || '_no_delete', p_table);
  end if;

  if p_append_only then
    execute format(
      'create trigger %I before update on %s for each row execute function public.prevent_update()',
      v_name || '_no_update', p_table);
  end if;
end;
$$;

revoke execute on function app_private.register_table(regclass, boolean, boolean, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reloj de referencia (fecha congelable en pruebas, nunca en producción)
-- ---------------------------------------------------------------------------
-- Las marcas de tiempo de los registros SIEMPRE usan now() (DI-5). reference_now() solo se usa
-- para calcular vigencias, vencimientos y numeración por año. Las pruebas insertan una fila en
-- app_private.test_clock dentro de su transacción (y la revierten); en producción está vacía.
create table app_private.test_clock (
  id boolean primary key default true check (id),
  now_override timestamptz not null
);

alter table app_private.test_clock enable row level security;
revoke all on table app_private.test_clock from public, anon, authenticated, service_role;

create or replace function public.reference_now()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select now_override from app_private.test_clock where id), now());
$$;

comment on function public.reference_now() is
  'Fecha de referencia para vigencias y numeración. Igual a now() salvo en pruebas (app_private.test_clock).';

grant execute on function public.reference_now() to authenticated;
revoke execute on function public.reference_now() from public, anon;

-- Hora del servidor para la interfaz (modal de firma: «Fecha y hora del servidor»).
create or replace function public.server_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

grant execute on function public.server_now() to authenticated;
revoke execute on function public.server_now() from public, anon;
