-- 0012_configurable_roles.sql · Etapa E2 (PRD 1.5, sección 2.6, RF-07)
-- Roles configurables: los roles pasan de un tipo enumerado cerrado a la tabla public.roles.
-- Los 15 roles del PRD 2.1 son «roles del sistema» (protegidos: no se retiran y su matriz es de solo
-- lectura). El administrador crea, configura (permisos por módulo, incompatibilidades, vencimiento
-- obligatorio, solo lectura) y retira roles adicionales. Funciones reservadas: admin, dt, aq_doc.

-- ---------------------------------------------------------------------------
-- 1. Catálogo de roles
-- ---------------------------------------------------------------------------
create table public.roles (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  is_system boolean not null default false,
  requires_expiry boolean not null default false,
  read_only boolean not null default false,
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.roles is
  'Roles (PRD 2.1 y 2.6). is_system = rol del PRD (protegido). Un rol retirado (active = false) no se asigna ni da permisos.';

select app_private.register_catalog('public.roles');

insert into public.roles (code, name, description, is_system, requires_expiry, read_only) values
  ('comercial', 'Comercial', 'Crea el brief de producto.', true, false, false),
  ('idi', 'Químico formulador (I+D)', 'Crea fórmulas, especificaciones e instructivos.', true, false, false),
  ('bodega_aux', 'Auxiliar de bodega', 'Recibe insumos, imprime rótulos y deja los lotes en cuarentena.', true, false, false),
  ('bodega_jefe', 'Jefe de bodega', 'Supervisa inventarios, ajustes y vencimientos.', true, false, false),
  ('prod_aux', 'Auxiliar de producción', 'Dispensa, fabrica, envasa y acondiciona; registra parámetros.', true, false, false),
  ('prod_coord', 'Coordinador de producción', 'Crea órdenes, verifica registros y planifica.', true, false, false),
  ('lab_aux', 'Auxiliar de laboratorio', 'Toma muestras y captura resultados.', true, false, false),
  ('cc_jefe', 'Jefe de control de calidad', 'Libera materias primas y certifica producto terminado.', true, false, false),
  ('aq_dir', 'Director de aseguramiento de calidad', 'Revisa expedientes, gestiona desviaciones y CAPA.', true, false, false),
  ('dt', 'Director técnico', 'Aprueba fórmulas e instructivos y libera el lote.', true, false, false),
  ('admin', 'Administrador del sistema', 'Usuarios, catálogos y configuración; no firma registros de calidad.', true, false, false),
  ('master', 'Usuario master', 'Crea versiones nuevas en borrador de fórmulas, especificaciones y plantillas.', true, false, false),
  ('aq_doc', 'Analista de gestión documental', 'Estandariza, codifica, publica y custodia los documentos controlados.', true, false, false),
  ('gerencia', 'Gerente general', 'Aprueba documentos administrativos, fórmulas y prototipos.', true, false, false),
  ('auditor', 'Auditor invitado', 'Acceso de solo lectura con fecha de vencimiento.', true, true, true);

-- ---------------------------------------------------------------------------
-- 2. Quitar dependencias del tipo enumerado
-- ---------------------------------------------------------------------------
drop policy "users read own roles; admin and auditor read all" on public.user_roles;
drop policy "admin can update settings" on public.app_settings;
drop policy "audit readers can read audit log" on public.audit_log;
drop policy "own signatures or audit readers" on public.signatures;

drop function public.has_role(public.app_role);
drop function public.has_any_role(public.app_role[]);
drop function public.admin_grant_role(uuid, public.app_role, timestamptz, text);
drop function public.current_user_roles();
drop function public.user_active_roles(uuid);
drop function public.can_read_audit();

alter table public.user_roles alter column role type text using role::text;
alter table public.user_roles add constraint user_roles_role_fk foreign key (role) references public.roles (code);

alter table public.sign_permissions alter column role type text using role::text;
alter table public.sign_permissions add constraint sign_permissions_role_fk foreign key (role) references public.roles (code);

alter table public.signatures alter column signed_as type text using signed_as::text;
alter table public.signatures add constraint signatures_signed_as_fk foreign key (signed_as) references public.roles (code);

alter table public.module_permissions alter column role type text using role::text;
alter table public.module_permissions add constraint module_permissions_role_fk foreign key (role) references public.roles (code);

-- Incompatibilidades: texto, pares ordenados alfabéticamente y desactivables (nunca se borran).
alter table public.role_incompatibilities drop constraint role_incompatibilities_check;
alter table public.role_incompatibilities alter column role_a type text using role_a::text;
alter table public.role_incompatibilities alter column role_b type text using role_b::text;
update public.role_incompatibilities
set role_a = least(role_a, role_b), role_b = greatest(role_a, role_b)
where role_a > role_b;
alter table public.role_incompatibilities add constraint role_incompatibilities_order check (role_a < role_b);
alter table public.role_incompatibilities add constraint role_incompatibilities_a_fk foreign key (role_a) references public.roles (code);
alter table public.role_incompatibilities add constraint role_incompatibilities_b_fk foreign key (role_b) references public.roles (code);
alter table public.role_incompatibilities add column active boolean not null default true;
alter table public.role_incompatibilities add column is_system boolean not null default false;
update public.role_incompatibilities set is_system = true;

drop type public.app_role;

-- ---------------------------------------------------------------------------
-- 3. Funciones de rol (texto); solo cuentan los roles activos (no retirados)
-- ---------------------------------------------------------------------------
create or replace function public.user_active_roles(p_user uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct ur.role order by ur.role), '{}')
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id and p.active
  join public.roles r on r.code = ur.role and r.active
  where ur.user_id = p_user
    and ur.revoked_at is null
    and (ur.expires_at is null or ur.expires_at > now());
$$;

revoke execute on function public.user_active_roles(uuid) from public, anon, authenticated;

create or replace function public.current_user_roles()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select public.user_active_roles(auth.uid());
$$;

create or replace function public.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_role = any(public.current_user_roles());
$$;

create or replace function public.has_any_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_roles() && p_roles;
$$;

-- Lectura de trazabilidad y bitácora = permiso de lectura en el módulo «Trazabilidad / Auditoría»
-- de la matriz (PRD 2.2): así un rol adicional con ese permiso obtiene exactamente ese acceso.
create or replace function public.can_read_audit()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_permission('trazabilidad_auditoria', 'read');
$$;

revoke execute on function public.current_user_roles() from public, anon;
revoke execute on function public.has_role(text) from public, anon;
revoke execute on function public.has_any_role(text[]) from public, anon;
revoke execute on function public.can_read_audit() from public, anon;
grant execute on function public.current_user_roles() to authenticated;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.has_any_role(text[]) to authenticated;
grant execute on function public.can_read_audit() to authenticated;

-- check_sod con roles en texto (mismas reglas SOD-1…SOD-10).
create or replace function public.check_sod(
  p_user uuid,
  p_table text,
  p_record_id uuid,
  p_meaning public.signature_meaning,
  p_row jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cfg public.signable_tables;
  v_roles text[] := public.user_active_roles(p_user);
  v_group text;
  v_rule public.sod_cross_rules;
begin
  select * into v_cfg from public.signable_tables where table_name = p_table;
  if not found then
    raise exception 'RECORD_NOT_FOUND: % no es una tabla firmable', p_table;
  end if;

  if v_cfg.is_quality and 'admin' = any(v_roles) then
    raise exception 'FORBIDDEN_ROLE: SOD-7: el administrador del sistema no puede firmar registros de calidad';
  end if;

  if v_cfg.is_execution and v_roles && array['master', 'aq_doc'] then
    raise exception 'FORBIDDEN_ROLE: SOD-9: el usuario master y la analista de gestión documental no firman registros de ejecución';
  end if;

  if p_meaning = 'verifico' and exists (
    select 1 from public.signatures s
    where s.record_table = p_table and s.record_id = p_record_id and s.user_id = p_user and s.meaning = 'ejecuto'
  ) then
    raise exception 'SOD_VIOLATION: SOD-1: usted ejecutó este registro; la verificación debe hacerla otra persona';
  end if;

  if p_meaning = 'aprobo' and exists (
    select 1 from public.signatures s
    where s.record_table = p_table and s.record_id = p_record_id and s.user_id = p_user and s.meaning = 'verifico'
  ) then
    raise exception 'SOD_VIOLATION: SOD-2: usted verificó este registro; la aprobación debe hacerla otra persona';
  end if;

  if v_cfg.is_document and p_meaning in ('reviso', 'aprobo') and (
    (p_row ->> v_cfg.author_column) = p_user::text
    or exists (
      select 1 from public.signatures s
      where s.record_table = p_table and s.record_id = p_record_id and s.user_id = p_user and s.meaning = 'actualizo'
    )
  ) then
    raise exception 'SOD_VIOLATION: %: usted elaboró esta versión y no puede revisarla ni aprobarla',
      case when p_meaning = 'aprobo' then 'SOD-3/SOD-8' else 'SOD-8' end;
  end if;

  if v_cfg.group_column is not null then
    v_group := p_row ->> v_cfg.group_column;
    if v_group is not null then
      for v_rule in
        select * from public.sod_cross_rules r
        where r.meaning = p_meaning and (r.kind is null or r.kind = v_cfg.kind)
        order by r.code
      loop
        if exists (
          select 1
          from public.signatures s
          join public.signable_tables st on st.table_name = s.record_table
          where s.group_key = v_group
            and s.user_id = p_user
            and s.meaning = v_rule.prior_meaning
            and (v_rule.prior_kind is null or st.kind = v_rule.prior_kind)
        ) then
          raise exception 'SOD_VIOLATION: %: %', v_rule.code, v_rule.description;
        end if;
      end loop;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Políticas (recreadas con roles en texto)
-- ---------------------------------------------------------------------------
create policy "users read own roles; admin and auditor read all" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(array['admin', 'auditor']));
create policy "admin can update settings" on public.app_settings
  for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "audit readers can read audit log" on public.audit_log
  for select to authenticated using (public.can_read_audit());
create policy "own signatures or audit readers" on public.signatures
  for select to authenticated using (user_id = auth.uid() or public.can_read_audit());

-- ---------------------------------------------------------------------------
-- 5. Funciones reservadas (no se pueden dar a un rol adicional)
-- ---------------------------------------------------------------------------
create table public.reserved_permissions (
  id uuid primary key default gen_random_uuid(),
  module_code text not null references public.permission_modules (code),
  permission text not null check (permission in ('read', 'create', 'sign', 'approve')),
  owner_role text not null references public.roles (code),
  reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (module_code, permission)
);

alter table public.reserved_permissions enable row level security;
select app_private.register_table('public.reserved_permissions', p_append_only => true);
create policy "authenticated can read reserved permissions" on public.reserved_permissions
  for select to authenticated using (true);
revoke all on table public.reserved_permissions from anon;
revoke insert, update, delete, truncate on table public.reserved_permissions from authenticated;

insert into public.reserved_permissions (module_code, permission, owner_role, reason) values
  ('usuarios_catalogos_perfiles', 'create', 'admin', 'Administrar usuarios, catálogos y perfiles es exclusivo del administrador (PRD 2.2).'),
  ('usuarios_catalogos_perfiles', 'sign', 'admin', 'Administrar usuarios, catálogos y perfiles es exclusivo del administrador (PRD 2.2).'),
  ('usuarios_catalogos_perfiles', 'approve', 'admin', 'Administrar usuarios, catálogos y perfiles es exclusivo del administrador (PRD 2.2).'),
  ('liberacion_final_del_lote', 'approve', 'dt', 'Aprobar la liberación final del lote es exclusivo del director técnico (PRD 2.2).');

-- ---------------------------------------------------------------------------
-- 6. Matriz: editable solo para roles adicionales
-- ---------------------------------------------------------------------------
drop trigger module_permissions_no_update on public.module_permissions;

create or replace function app_private.protect_system_permissions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.roles r where r.code = old.role and r.is_system) then
    raise exception 'SYSTEM_ROLE_LOCKED: los permisos de los roles del sistema son la línea base del PRD 2.2 y no se modifican';
  end if;
  return new;
end;
$$;

create trigger module_permissions_protect_system
  before update on public.module_permissions
  for each row execute function app_private.protect_system_permissions();

create or replace function app_private.permission_cell_text(p_read boolean, p_create boolean, p_sign boolean, p_approve boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(concat_ws(' ',
    case when p_read then 'L' end,
    case when p_create then 'C' end,
    case when p_sign then 'F' end,
    case when p_approve then 'A' end), ''), '—');
$$;

-- ---------------------------------------------------------------------------
-- 7. Administración de roles
-- ---------------------------------------------------------------------------
create or replace function app_private.require_custom_role(p_code text)
returns public.roles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.roles;
begin
  select * into v_role from public.roles where code = p_code;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el rol %', p_code;
  end if;
  if v_role.is_system then
    raise exception 'SYSTEM_ROLE_LOCKED: % es un rol del sistema (PRD 2.1); no se modifica ni se retira', p_code;
  end if;
  return v_role;
end;
$$;

create or replace function public.admin_create_role(
  p_code text,
  p_name text,
  p_description text,
  p_requires_expiry boolean,
  p_read_only boolean,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := lower(trim(p_code));
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  if v_code !~ '^[a-z][a-z0-9_]{2,30}$' then
    raise exception 'INVALID_FIELD: el código debe tener de 3 a 31 caracteres: minúsculas, números o «_», y empezar con letra';
  end if;
  if exists (select 1 from public.roles where code = v_code) then
    raise exception 'INVALID_TRANSITION: ya existe un rol con el código %', v_code;
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'INVALID_FIELD: el nombre del rol es obligatorio';
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);
  insert into public.roles (code, name, description, is_system, requires_expiry, read_only)
  values (v_code, trim(p_name), coalesce(trim(p_description), ''), false,
          coalesce(p_requires_expiry, false), coalesce(p_read_only, false));
  -- El rol nace sin permisos: una celda «—» por módulo.
  insert into public.module_permissions (module_code, role, cell_text, can_read, can_create, can_sign, can_approve)
  select pm.code, v_code, '—', false, false, false, false from public.permission_modules pm;
  perform set_config('app.audit_reason', '', true);
  return v_code;
end;
$$;

create or replace function public.admin_update_role(
  p_code text,
  p_name text,
  p_description text,
  p_requires_expiry boolean,
  p_read_only boolean,
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
  perform app_private.require_custom_role(p_code);
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'INVALID_FIELD: el nombre del rol es obligatorio';
  end if;
  if coalesce(p_read_only, false) and exists (
    select 1 from public.module_permissions
    where role = p_code and (can_create or can_sign or can_approve)
  ) then
    raise exception 'INVALID_FIELD: un rol de solo lectura no puede tener permisos C, F o A; quítelos primero';
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.roles
  set name = trim(p_name), description = coalesce(trim(p_description), ''),
      requires_expiry = coalesce(p_requires_expiry, false), read_only = coalesce(p_read_only, false)
  where code = p_code;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- Permisos por módulo de un rol adicional, en una sola transacción.
-- p_permissions: [{"module":"trazabilidad_auditoria","read":true,"create":false,"sign":false,"approve":false}, …]
create or replace function public.admin_set_role_permissions(p_code text, p_permissions jsonb, p_reason text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.roles;
  v_item jsonb;
  v_module text;
  v_read boolean;
  v_create boolean;
  v_sign boolean;
  v_approve boolean;
  v_reserved public.reserved_permissions;
  v_count int := 0;
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  v_role := app_private.require_custom_role(p_code);
  if not v_role.active then
    raise exception 'ROLE_RETIRED: el rol % está retirado; reactívelo para configurarlo', p_code;
  end if;
  if jsonb_typeof(p_permissions) <> 'array' then
    raise exception 'INVALID_FIELD: los permisos deben enviarse como lista';
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);
  for v_item in select * from jsonb_array_elements(p_permissions) loop
    v_module := v_item ->> 'module';
    v_read := coalesce((v_item ->> 'read')::boolean, false);
    v_create := coalesce((v_item ->> 'create')::boolean, false);
    v_sign := coalesce((v_item ->> 'sign')::boolean, false);
    v_approve := coalesce((v_item ->> 'approve')::boolean, false);

    if not exists (select 1 from public.permission_modules where code = v_module) then
      raise exception 'RECORD_NOT_FOUND: no existe el módulo %', v_module;
    end if;
    if v_role.read_only and (v_create or v_sign or v_approve) then
      raise exception 'INVALID_FIELD: el rol % es de solo lectura: solo admite L', p_code;
    end if;
    select * into v_reserved from public.reserved_permissions rp
    where rp.module_code = v_module
      and ((rp.permission = 'read' and v_read) or (rp.permission = 'create' and v_create)
           or (rp.permission = 'sign' and v_sign) or (rp.permission = 'approve' and v_approve))
    limit 1;
    if found then
      raise exception 'RESERVED_PERMISSION: %', v_reserved.reason;
    end if;

    update public.module_permissions
    set can_read = v_read, can_create = v_create, can_sign = v_sign, can_approve = v_approve,
        cell_text = app_private.permission_cell_text(v_read, v_create, v_sign, v_approve)
    where role = p_code and module_code = v_module;
    v_count := v_count + 1;
  end loop;
  -- Nueva versión del rol (la bitácora guarda cada celda con su antes y después).
  update public.roles set updated_at = now() where code = p_code;
  perform set_config('app.audit_reason', '', true);
  return v_count;
end;
$$;

-- Incompatibilidades de un rol adicional: define el conjunto completo (se activan o desactivan; no se borran).
create or replace function public.admin_set_role_incompatibilities(p_code text, p_others text[], p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other text;
  v_holders int;
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  perform app_private.require_custom_role(p_code);
  p_others := coalesce(p_others, '{}');
  if p_code = any(p_others) then
    raise exception 'INVALID_FIELD: un rol no puede ser incompatible consigo mismo';
  end if;

  foreach v_other in array p_others loop
    if not exists (select 1 from public.roles where code = v_other) then
      raise exception 'RECORD_NOT_FOUND: no existe el rol %', v_other;
    end if;
    select count(distinct a.user_id) into v_holders
    from public.user_roles a
    join public.user_roles b on b.user_id = a.user_id and b.role = v_other and b.revoked_at is null
      and (b.expires_at is null or b.expires_at > now())
    where a.role = p_code and a.revoked_at is null and (a.expires_at is null or a.expires_at > now());
    if v_holders > 0 then
      raise exception 'ROLE_INCOMPATIBLE: % usuario(s) tienen hoy los roles % y %; retire uno antes de declararlos incompatibles',
        v_holders, p_code, v_other;
    end if;
  end loop;

  perform set_config('app.audit_reason', trim(p_reason), true);
  -- Desactiva las que salen del conjunto.
  update public.role_incompatibilities
  set active = false
  where not is_system and active and (role_a = p_code or role_b = p_code)
    and (case when role_a = p_code then role_b else role_a end) <> all(p_others);
  -- Activa o crea las del conjunto.
  foreach v_other in array p_others loop
    insert into public.role_incompatibilities (role_a, role_b, rule_code, message, active, is_system)
    values (least(p_code, v_other), greatest(p_code, v_other), 'RF-07',
            format('Incompatibilidad definida por el administrador para el rol %s.', p_code), true, false)
    on conflict (role_a, role_b) do update set active = true;
  end loop;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- Retirar o reactivar un rol adicional («eliminar» = retirar: nada se borra).
create or replace function public.admin_set_role_active(p_code text, p_active boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_holders int;
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  perform app_private.require_custom_role(p_code);
  if not p_active then
    select count(*) into v_holders from public.user_roles
    where role = p_code and revoked_at is null and (expires_at is null or expires_at > now());
    if v_holders > 0 then
      raise exception 'ROLE_IN_USE: % usuario(s) tienen el rol % vigente; revóquelo antes de retirarlo', v_holders, p_code;
    end if;
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.roles set active = p_active where code = p_code;
  perform set_config('app.audit_reason', '', true);
end;
$$;

revoke execute on function public.admin_create_role(text, text, text, boolean, boolean, text) from public, anon;
revoke execute on function public.admin_update_role(text, text, text, boolean, boolean, text) from public, anon;
revoke execute on function public.admin_set_role_permissions(text, jsonb, text) from public, anon;
revoke execute on function public.admin_set_role_incompatibilities(text, text[], text) from public, anon;
revoke execute on function public.admin_set_role_active(text, boolean, text) from public, anon;
grant execute on function public.admin_create_role(text, text, text, boolean, boolean, text) to authenticated;
grant execute on function public.admin_update_role(text, text, text, boolean, boolean, text) to authenticated;
grant execute on function public.admin_set_role_permissions(text, jsonb, text) to authenticated;
grant execute on function public.admin_set_role_incompatibilities(text, text[], text) to authenticated;
grant execute on function public.admin_set_role_active(text, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Asignación de roles: rol activo, vencimiento según el rol, incompatibilidades activas
-- ---------------------------------------------------------------------------
create or replace function public.admin_grant_role(
  p_user uuid,
  p_role text,
  p_expires_at timestamptz,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.roles;
  v_conflict public.role_incompatibilities;
  v_id uuid;
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'RECORD_NOT_FOUND: no existe el usuario %', p_user;
  end if;
  select * into v_role from public.roles where code = p_role;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el rol %', p_role;
  end if;
  if not v_role.active then
    raise exception 'ROLE_RETIRED: el rol % está retirado y no se puede asignar', p_role;
  end if;
  if v_role.requires_expiry and p_expires_at is null then
    raise exception 'INVALID_FIELD: el rol «%» exige fecha de vencimiento (RF-03)', v_role.name;
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
  where ri.active
    and ((ri.role_a = p_role and ri.role_b = ur.role) or (ri.role_b = p_role and ri.role_a = ur.role))
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

revoke execute on function public.admin_grant_role(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.admin_grant_role(uuid, text, timestamptz, text) to authenticated;

create or replace function public.admin_set_role_expiry(p_user_role uuid, p_expires_at timestamptz, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ur public.user_roles;
  v_requires boolean;
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  select * into v_ur from public.user_roles where id = p_user_role and revoked_at is null;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el rol asignado %', p_user_role;
  end if;
  select requires_expiry into v_requires from public.roles where code = v_ur.role;
  if v_requires and p_expires_at is null then
    raise exception 'INVALID_FIELD: este rol exige fecha de vencimiento (RF-03)';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'INVALID_FIELD: la fecha de vencimiento debe ser futura';
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.user_roles set expires_at = p_expires_at where id = p_user_role;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Contexto del usuario: módulos visibles por roles adicionales (menú)
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
    'custom_modules', coalesce((
      select jsonb_agg(distinct mp.module_code)
      from public.module_permissions mp
      join public.roles r on r.code = mp.role and not r.is_system and r.active
      where mp.role = any(public.user_active_roles(p.id))
        and (mp.can_read or mp.can_create or mp.can_sign or mp.can_approve)
    ), '[]'::jsonb),
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
