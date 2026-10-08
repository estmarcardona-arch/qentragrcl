-- 0004_identity.sql · Etapa E1 (núcleo GxP)
-- Roles (PRD 2.1), perfiles vinculados a auth.users, roles por usuario con vigencia,
-- registro de firmas cortas (DI-11) y configuración del sistema.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'comercial', 'idi', 'bodega_aux', 'bodega_jefe', 'prod_aux', 'prod_coord', 'lab_aux',
  'cc_jefe', 'aq_dir', 'dt', 'admin', 'master', 'aq_doc', 'gerencia', 'auditor'
);

comment on type public.app_role is 'Roles del PRD 2.1. Un usuario puede tener varios.';

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null check (length(trim(full_name)) > 0),
  email text not null,
  job_title text,
  document_id text,
  area_id uuid, -- FK a organizational_areas en E2
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.profiles is 'Perfil de cada usuario (id = auth.users.id).';

alter table public.profiles enable row level security;
select app_private.register_table('public.profiles', p_no_delete => true);

-- ---------------------------------------------------------------------------
-- Roles por usuario (con vigencia)
-- ---------------------------------------------------------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  role public.app_role not null,
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (expires_at is null or expires_at > granted_at)
);

comment on table public.user_roles is
  'Roles asignados. Activo si revoked_at es nulo y expires_at es nulo o futuro (auditor con vencimiento).';

create unique index user_roles_active_unique on public.user_roles (user_id, role) where revoked_at is null;
create index user_roles_user_idx on public.user_roles (user_id);

alter table public.user_roles enable row level security;
select app_private.register_table('public.user_roles', p_no_delete => true);

-- ---------------------------------------------------------------------------
-- Funciones de roles (security definer: evitan recursión de RLS)
-- ---------------------------------------------------------------------------
create or replace function public.user_active_roles(p_user uuid)
returns public.app_role[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct ur.role order by ur.role), '{}')
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id and p.active
  where ur.user_id = p_user
    and ur.revoked_at is null
    and (ur.expires_at is null or ur.expires_at > now());
$$;

revoke execute on function public.user_active_roles(uuid) from public, anon, authenticated;

create or replace function public.current_user_roles()
returns public.app_role[]
language sql
stable
security definer
set search_path = ''
as $$
  select public.user_active_roles(auth.uid());
$$;

create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_role = any(public.current_user_roles());
$$;

create or replace function public.has_any_role(p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_roles() && p_roles;
$$;

revoke execute on function public.current_user_roles() from public, anon;
revoke execute on function public.has_role(public.app_role) from public, anon;
revoke execute on function public.has_any_role(public.app_role[]) from public, anon;
grant execute on function public.current_user_roles() to authenticated;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;

-- Roles con lectura de trazabilidad y auditoría (PRD 2.2: todos menos comercial).
create or replace function public.can_read_audit()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array[
    'idi', 'bodega_aux', 'bodega_jefe', 'prod_aux', 'prod_coord', 'lab_aux', 'cc_jefe',
    'aq_dir', 'dt', 'admin', 'master', 'aq_doc', 'gerencia', 'auditor'
  ]::public.app_role[]);
$$;

revoke execute on function public.can_read_audit() from public, anon;
grant execute on function public.can_read_audit() to authenticated;

-- ---------------------------------------------------------------------------
-- Registro de firmas cortas (DI-11): inicial del primer nombre, punto y primer apellido
-- ---------------------------------------------------------------------------
create or replace function public.short_signature_of(p_full_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_parts text[];
  v_first text;
  v_last text;
begin
  -- Quita tratamientos al inicio (Dr., Dra., Ing., Q.F.).
  v_parts := regexp_split_to_array(
    regexp_replace(trim(p_full_name), '^((dr|dra|ing|q\.?f)\.?\s+)+', '', 'i'), '\s+');
  v_first := v_parts[1];
  v_last := coalesce(v_parts[2], '');
  if v_first is null or v_first = '' then
    return null;
  end if;
  return trim(upper(left(v_first, 1)) || '. ' || v_last);
end;
$$;

comment on function public.short_signature_of(text) is
  'Firma corta (DI-11): «Lucía Barrera» → «L. Barrera»; «Dr. Esteban Gaviria» → «E. Gaviria».';

create table public.signature_registry (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  short_signature text not null check (length(trim(short_signature)) > 0),
  specimen_file text,
  registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.signature_registry is 'Registro de firmas cortas (PRD DI-11, 2.5.11).';

alter table public.signature_registry enable row level security;
select app_private.register_table('public.signature_registry', p_no_delete => true);

-- Perfil y firma corta al crear el usuario en Supabase Auth.
create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, full_name, email, job_title)
  values (new.id, v_name, new.email, nullif(trim(new.raw_user_meta_data ->> 'job_title'), ''));

  insert into public.signature_registry (user_id, short_signature)
  values (new.id, coalesce(public.short_signature_of(v_name), v_name));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Configuración del sistema (valores por defecto del PRD; los cambia el administrador)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.app_settings enable row level security;
select app_private.register_table('public.app_settings', p_no_delete => true);

insert into public.app_settings (key, value, description) values
  ('session_idle_minutes', '15', 'Minutos de inactividad antes de cerrar la sesión (RF-01).'),
  ('login_max_failed_attempts', '5', 'Intentos fallidos de inicio de sesión antes del bloqueo.'),
  ('login_lockout_minutes', '15', 'Minutos de bloqueo de la cuenta tras superar los intentos fallidos.'),
  ('reauth_method', '"password"', 'Reautenticación de la firma: «password» o «password_mfa» (D-09, D-29).'),
  ('sign_max_failed_attempts', '3', 'Intentos fallidos de contraseña al firmar antes del bloqueo de firma.'),
  ('sign_lockout_minutes', '15', 'Minutos de bloqueo de la firma tras superar los intentos fallidos.'),
  ('corrections_warning_threshold', '5', 'Correcciones por registro a partir de las cuales se avisa (DI-12, D-25).');

create or replace function public.get_setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.app_settings where key = p_key;
$$;

revoke execute on function public.get_setting(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Políticas RLS
-- ---------------------------------------------------------------------------
create policy "authenticated can read profiles" on public.profiles
  for select to authenticated using (true);

create policy "users read own roles; admin and auditor read all" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(array['admin', 'auditor']::public.app_role[]));

create policy "authenticated can read signature registry" on public.signature_registry
  for select to authenticated using (true);

create policy "authenticated can read settings" on public.app_settings
  for select to authenticated using (true);

create policy "admin can update settings" on public.app_settings
  for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "audit readers can read audit log" on public.audit_log
  for select to authenticated using (public.can_read_audit());

-- Permisos de tabla: lectura por API; las escrituras de identidad pasan por RPC (E2).
revoke all on table public.profiles, public.user_roles, public.signature_registry, public.app_settings
  from anon;
revoke insert, update, delete, truncate on table public.profiles, public.user_roles, public.signature_registry
  from authenticated;
revoke insert, delete, truncate on table public.app_settings from authenticated;

-- ---------------------------------------------------------------------------
-- Contexto del usuario actual (perfil, roles activos, firma corta, configuración de sesión)
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
    'active', p.active,
    'short_signature', sr.short_signature,
    'roles', to_jsonb(public.user_active_roles(p.id)),
    'session_idle_minutes', (public.get_setting('session_idle_minutes'))::int,
    'reauth_method', public.get_setting('reauth_method') #>> '{}'
  )
  from public.profiles p
  left join public.signature_registry sr on sr.user_id = p.id
  where p.id = auth.uid();
$$;

revoke execute on function public.get_my_context() from public, anon;
grant execute on function public.get_my_context() to authenticated;
