-- 0013_role_change_approvals.sql · Etapa E2 (PRD 1.6, sección 2.6, RF-07; decisiones D-39 y D-40)
-- Todo cambio de un rol pasa por una solicitud con aprobación (nadie lo hace solo):
--   · D-39: crear, modificar, configurar o retirar un rol adicional lo solicita el administrador y lo
--     aprueba el Director de aseguramiento de calidad (aq_dir).
--   · D-40: los permisos de los 15 roles del sistema se pueden ajustar desde la plataforma con DOBLE
--     aprobación: aq_dir y el Director técnico (dt), dos personas distintas de quien solicita (D-41).
--     Las funciones reservadas siguen con candado: su dueño no las pierde y nadie más las recibe.
-- Quien aprueba confirma su identidad con contraseña (mismo contador de intentos que la firma).
-- Las funciones admin_* de 0012 dejan de poder llamarse desde la API: el cambio solo se aplica al
-- aprobarse la solicitud, en la misma transacción que la aprobación y su bitácora.

-- ---------------------------------------------------------------------------
-- 1. Solicitudes y aprobaciones
-- ---------------------------------------------------------------------------
insert into public.numbering_sequences (key, format, description)
values ('role_change_request', 'CR-{YYYY}-{NNNN}', 'Solicitudes de cambio de rol (RF-07). Formato provisional (D-11).');

create table public.role_change_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  kind text not null check (kind in ('create', 'update', 'permissions', 'incompatibilities', 'retire', 'reactivate')),
  role_code text not null,
  role_is_system boolean not null,
  summary text not null,
  payload jsonb not null default '{}',
  before jsonb not null default '{}',
  reason text not null check (length(trim(reason)) > 0),
  required_roles text[] not null check (cardinality(required_roles) between 1 and 2),
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada', 'anulada')),
  requested_by uuid not null references public.profiles (id),
  requested_at timestamptz not null default now(),
  closed_by uuid references public.profiles (id),
  closed_at timestamptz,
  close_reason text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.role_change_requests is
  'Solicitudes de cambio de rol (PRD 2.6, D-39, D-40). Se aplican solo al reunir las aprobaciones de required_roles.';

-- Una sola solicitud pendiente por rol: evita cambios cruzados y reserva el código de un rol nuevo.
create unique index role_change_requests_one_pending on public.role_change_requests (role_code)
  where status = 'pendiente';

alter table public.role_change_requests enable row level security;
select app_private.register_table('public.role_change_requests', p_no_delete => true);

create table public.role_change_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.role_change_requests (id),
  approver uuid not null references public.profiles (id),
  approver_role text not null references public.roles (code),
  approver_name text not null,
  decision text not null check (decision in ('aprobada', 'rechazada')),
  reason text not null check (length(trim(reason)) > 0),
  reauth_method text not null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (request_id, approver),
  unique (request_id, approver_role)
);

comment on table public.role_change_approvals is
  'Decisiones sobre solicitudes de cambio de rol, con reautenticación. Solo se agregan; no se modifican.';

alter table public.role_change_approvals enable row level security;
select app_private.register_table('public.role_change_approvals', p_append_only => true);

create or replace function public.can_see_role_changes()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['admin', 'aq_dir', 'dt', 'auditor']);
$$;

revoke execute on function public.can_see_role_changes() from public, anon;
grant execute on function public.can_see_role_changes() to authenticated;

create policy "role change readers" on public.role_change_requests
  for select to authenticated using (public.can_see_role_changes());
create policy "role change readers" on public.role_change_approvals
  for select to authenticated using (public.can_see_role_changes());
revoke all on table public.role_change_requests, public.role_change_approvals from anon;
revoke insert, update, delete, truncate on table public.role_change_requests, public.role_change_approvals
  from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Matriz: línea base del PRD y candado de los roles del sistema
-- ---------------------------------------------------------------------------
alter table public.module_permissions add column prd_cell_text text;
comment on column public.module_permissions.prd_cell_text is
  'Celda de la línea base del PRD 2.2 (roles del sistema). Si difiere de cell_text, el permiso se ajustó con doble aprobación (D-40).';

alter table public.module_permissions disable trigger module_permissions_protect_system;
alter table public.module_permissions disable trigger module_permissions_audit;
alter table public.module_permissions disable trigger module_permissions_set_metadata;
update public.module_permissions mp set prd_cell_text = mp.cell_text
from public.roles r where r.code = mp.role and r.is_system;
alter table public.module_permissions enable trigger module_permissions_set_metadata;
alter table public.module_permissions enable trigger module_permissions_audit;
alter table public.module_permissions enable trigger module_permissions_protect_system;

-- Los permisos de un rol del sistema solo cambian al aplicarse una solicitud con doble aprobación.
create or replace function app_private.protect_system_permissions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.roles r where r.code = old.role and r.is_system)
     and coalesce(current_setting('app.role_change_request', true), '') = '' then
    raise exception 'SYSTEM_ROLE_LOCKED: los permisos de un rol del sistema solo cambian con una solicitud aprobada por Aseguramiento de calidad y el Director técnico (D-40)';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Aplicación de los cambios (solo desde una solicitud aprobada o su validación previa)
-- ---------------------------------------------------------------------------
-- Las funciones admin_* de 0012 se reemplazan por estas, internas (sin acceso desde la API).
drop function public.admin_create_role(text, text, text, boolean, boolean, text);
drop function public.admin_update_role(text, text, text, boolean, boolean, text);
drop function public.admin_set_role_permissions(text, jsonb, text);
drop function public.admin_set_role_incompatibilities(text, text[], text);
drop function public.admin_set_role_active(text, boolean, text);

create or replace function app_private.role_apply_create(p_code text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_code !~ '^[a-z][a-z0-9_]{2,30}$' then
    raise exception 'INVALID_FIELD: el código debe tener de 3 a 31 caracteres: minúsculas, números o «_», y empezar con letra';
  end if;
  if exists (select 1 from public.roles where code = p_code) then
    raise exception 'INVALID_TRANSITION: ya existe un rol con el código %', p_code;
  end if;
  if coalesce(length(trim(p_payload ->> 'name')), 0) = 0 then
    raise exception 'INVALID_FIELD: el nombre del rol es obligatorio';
  end if;
  insert into public.roles (code, name, description, is_system, requires_expiry, read_only)
  values (p_code, trim(p_payload ->> 'name'), coalesce(trim(p_payload ->> 'description'), ''), false,
          coalesce((p_payload ->> 'requires_expiry')::boolean, false),
          coalesce((p_payload ->> 'read_only')::boolean, false));
  -- El rol nace sin permisos: una celda «—» por módulo.
  insert into public.module_permissions (module_code, role, cell_text, can_read, can_create, can_sign, can_approve)
  select pm.code, p_code, '—', false, false, false, false from public.permission_modules pm;
end;
$$;

create or replace function app_private.role_apply_update(p_code text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.require_custom_role(p_code);
  if coalesce(length(trim(p_payload ->> 'name')), 0) = 0 then
    raise exception 'INVALID_FIELD: el nombre del rol es obligatorio';
  end if;
  if coalesce((p_payload ->> 'read_only')::boolean, false) and exists (
    select 1 from public.module_permissions
    where role = p_code and (can_create or can_sign or can_approve)
  ) then
    raise exception 'INVALID_FIELD: un rol de solo lectura no puede tener permisos C, F o A; quítelos primero';
  end if;
  update public.roles
  set name = trim(p_payload ->> 'name'), description = coalesce(trim(p_payload ->> 'description'), ''),
      requires_expiry = coalesce((p_payload ->> 'requires_expiry')::boolean, false),
      read_only = coalesce((p_payload ->> 'read_only')::boolean, false)
  where code = p_code;
end;
$$;

-- p_payload.permissions: [{"module":"trazabilidad_auditoria","read":true,"create":false,"sign":false,"approve":false}, …]
create or replace function app_private.role_apply_permissions(p_code text, p_payload jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.roles;
  v_item jsonb;
  v_module text;
  v_new jsonb;
  v_reserved public.reserved_permissions;
  v_count int := 0;
begin
  select * into v_role from public.roles where code = p_code;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el rol %', p_code;
  end if;
  if not v_role.active then
    raise exception 'ROLE_RETIRED: el rol % está retirado; reactívelo para configurarlo', p_code;
  end if;
  if jsonb_typeof(p_payload -> 'permissions') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'permissions') = 0 then
    raise exception 'INVALID_FIELD: indique al menos un módulo con sus permisos';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload -> 'permissions') loop
    v_module := v_item ->> 'module';
    v_new := jsonb_build_object(
      'read', coalesce((v_item ->> 'read')::boolean, false),
      'create', coalesce((v_item ->> 'create')::boolean, false),
      'sign', coalesce((v_item ->> 'sign')::boolean, false),
      'approve', coalesce((v_item ->> 'approve')::boolean, false));

    if not exists (select 1 from public.permission_modules where code = v_module) then
      raise exception 'RECORD_NOT_FOUND: no existe el módulo %', v_module;
    end if;
    if v_role.read_only and ((v_new ->> 'create')::boolean or (v_new ->> 'sign')::boolean or (v_new ->> 'approve')::boolean) then
      raise exception 'INVALID_FIELD: el rol % es de solo lectura: solo admite L', p_code;
    end if;
    -- Funciones reservadas con candado: nadie más las recibe y su dueño no las pierde.
    select * into v_reserved from public.reserved_permissions rp
    where rp.module_code = v_module
      and ((rp.owner_role <> p_code and (v_new ->> rp.permission)::boolean)
           or (rp.owner_role = p_code and not (v_new ->> rp.permission)::boolean))
    limit 1;
    if found then
      raise exception 'RESERVED_PERMISSION: %', v_reserved.reason;
    end if;

    update public.module_permissions
    set can_read = (v_new ->> 'read')::boolean, can_create = (v_new ->> 'create')::boolean,
        can_sign = (v_new ->> 'sign')::boolean, can_approve = (v_new ->> 'approve')::boolean,
        -- Si vuelve a la línea base del PRD, se recupera el texto original de la celda.
        cell_text = case
          when prd_cell_text is not null and can_read = (v_new ->> 'read')::boolean
               and can_create = (v_new ->> 'create')::boolean and can_sign = (v_new ->> 'sign')::boolean
               and can_approve = (v_new ->> 'approve')::boolean then cell_text
          else app_private.permission_cell_text((v_new ->> 'read')::boolean, (v_new ->> 'create')::boolean,
                 (v_new ->> 'sign')::boolean, (v_new ->> 'approve')::boolean) end
    where role = p_code and module_code = v_module;
    v_count := v_count + 1;
  end loop;
  -- Nueva versión del rol (la bitácora guarda cada celda con su antes y después).
  update public.roles set updated_at = now() where code = p_code;
  return v_count;
end;
$$;

-- p_payload.others: conjunto completo de roles incompatibles (se activan o desactivan; no se borran).
create or replace function app_private.role_apply_incompatibilities(p_code text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_others text[] := coalesce(array(select jsonb_array_elements_text(p_payload -> 'others')), '{}');
  v_other text;
  v_holders int;
begin
  perform app_private.require_custom_role(p_code);
  if p_code = any(v_others) then
    raise exception 'INVALID_FIELD: un rol no puede ser incompatible consigo mismo';
  end if;

  foreach v_other in array v_others loop
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

  update public.role_incompatibilities
  set active = false
  where not is_system and active and (role_a = p_code or role_b = p_code)
    and (case when role_a = p_code then role_b else role_a end) <> all(v_others);
  foreach v_other in array v_others loop
    insert into public.role_incompatibilities (role_a, role_b, rule_code, message, active, is_system)
    values (least(p_code, v_other), greatest(p_code, v_other), 'RF-07',
            format('Incompatibilidad definida para el rol %s (solicitud aprobada).', p_code), true, false)
    on conflict (role_a, role_b) do update set active = true;
  end loop;
end;
$$;

create or replace function app_private.role_apply_active(p_code text, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_holders int;
begin
  perform app_private.require_custom_role(p_code);
  if not p_active then
    select count(*) into v_holders from public.user_roles
    where role = p_code and revoked_at is null and (expires_at is null or expires_at > now());
    if v_holders > 0 then
      raise exception 'ROLE_IN_USE: % usuario(s) tienen el rol % vigente; revóquelo antes de retirarlo', v_holders, p_code;
    end if;
  end if;
  update public.roles set active = p_active where code = p_code;
end;
$$;

create or replace function app_private.apply_role_change(p_kind text, p_code text, p_payload jsonb, p_request text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.role_change_request', p_request, true);
  case p_kind
    when 'create' then perform app_private.role_apply_create(p_code, p_payload);
    when 'update' then perform app_private.role_apply_update(p_code, p_payload);
    when 'permissions' then perform app_private.role_apply_permissions(p_code, p_payload);
    when 'incompatibilities' then perform app_private.role_apply_incompatibilities(p_code, p_payload);
    when 'retire' then perform app_private.role_apply_active(p_code, false);
    when 'reactivate' then perform app_private.role_apply_active(p_code, true);
    else raise exception 'INVALID_FIELD: tipo de cambio de rol desconocido: %', p_kind;
  end case;
  perform set_config('app.role_change_request', '', true);
end;
$$;

revoke execute on function app_private.role_apply_create(text, jsonb) from public, anon, authenticated;
revoke execute on function app_private.role_apply_update(text, jsonb) from public, anon, authenticated;
revoke execute on function app_private.role_apply_permissions(text, jsonb) from public, anon, authenticated;
revoke execute on function app_private.role_apply_incompatibilities(text, jsonb) from public, anon, authenticated;
revoke execute on function app_private.role_apply_active(text, boolean) from public, anon, authenticated;
revoke execute on function app_private.apply_role_change(text, text, jsonb, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Solicitar, decidir y anular
-- ---------------------------------------------------------------------------
create or replace function public.admin_request_role_change(p_kind text, p_role text, p_payload jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := lower(trim(p_role));
  v_role public.roles;
  v_payload jsonb := coalesce(p_payload, '{}');
  v_before jsonb := '{}';
  v_summary text;
  v_req public.role_change_requests;
  v_pending text;
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  if p_kind is null or p_kind not in ('create', 'update', 'permissions', 'incompatibilities', 'retire', 'reactivate') then
    raise exception 'INVALID_FIELD: tipo de cambio de rol desconocido: %', p_kind;
  end if;

  select * into v_role from public.roles where code = v_code;
  if p_kind = 'create' then
    if found then
      raise exception 'INVALID_TRANSITION: ya existe un rol con el código %', v_code;
    end if;
  elsif not found then
    raise exception 'RECORD_NOT_FOUND: no existe el rol %', v_code;
  elsif v_role.is_system and p_kind <> 'permissions' then
    raise exception 'SYSTEM_ROLE_LOCKED: % es un rol del sistema (PRD 2.1): no se modifica ni se retira; solo sus permisos se ajustan, con doble aprobación (D-40)', v_code;
  end if;

  select request_number into v_pending from public.role_change_requests
  where role_code = v_code and status = 'pendiente';
  if found then
    raise exception 'INVALID_TRANSITION: el rol % ya tiene la solicitud % pendiente; espere la decisión o anúlela', v_code, v_pending;
  end if;

  -- Validación completa: se aplica el cambio y se revierte (nada queda escrito).
  begin
    perform app_private.apply_role_change(p_kind, v_code, v_payload, 'validacion');
    raise exception 'ROLE_CHANGE_DRY_RUN';
  exception when others then
    if sqlerrm <> 'ROLE_CHANGE_DRY_RUN' then
      raise;
    end if;
  end;

  -- Estado anterior, para que quien aprueba vea el antes y el después.
  if p_kind = 'permissions' then
    select jsonb_build_object('permissions', coalesce(jsonb_agg(jsonb_build_object(
             'module', mp.module_code, 'read', mp.can_read, 'create', mp.can_create, 'sign', mp.can_sign,
             'approve', mp.can_approve, 'cell', mp.cell_text, 'prd_cell', mp.prd_cell_text)), '[]'))
    into v_before
    from public.module_permissions mp
    where mp.role = v_code
      and mp.module_code in (select x ->> 'module' from jsonb_array_elements(v_payload -> 'permissions') x);
  elsif p_kind = 'incompatibilities' then
    select jsonb_build_object('others', coalesce(jsonb_agg(case when ri.role_a = v_code then ri.role_b else ri.role_a end), '[]'))
    into v_before
    from public.role_incompatibilities ri
    where ri.active and (ri.role_a = v_code or ri.role_b = v_code);
  elsif p_kind <> 'create' then
    v_before := jsonb_build_object('name', v_role.name, 'description', v_role.description,
      'requires_expiry', v_role.requires_expiry, 'read_only', v_role.read_only, 'active', v_role.active);
  end if;

  v_summary := case p_kind
    when 'create' then format('Crear el rol «%s» (%s)', trim(v_payload ->> 'name'), v_code)
    when 'update' then format('Modificar los datos del rol %s', v_code)
    when 'permissions' then format('Cambiar los permisos de %s módulo(s) del rol %s',
                                   jsonb_array_length(v_payload -> 'permissions'), v_code)
    when 'incompatibilities' then format('Definir los roles incompatibles con %s', v_code)
    when 'retire' then format('Retirar el rol %s', v_code)
    else format('Reactivar el rol %s', v_code) end;

  perform set_config('app.audit_reason', trim(p_reason), true);
  insert into public.role_change_requests (
    request_number, kind, role_code, role_is_system, summary, payload, before, reason, required_roles, requested_by
  ) values (
    public.next_number('role_change_request'), p_kind, v_code, coalesce(v_role.is_system, false), v_summary,
    v_payload, v_before, trim(p_reason),
    case when coalesce(v_role.is_system, false) then array['aq_dir', 'dt'] else array['aq_dir'] end,
    auth.uid()
  ) returning * into v_req;
  perform set_config('app.audit_reason', '', true);

  return jsonb_build_object('id', v_req.id, 'request_number', v_req.request_number,
                            'required_roles', to_jsonb(v_req.required_roles));
end;
$$;

-- Aprobar o rechazar (con contraseña). Un fallo de contraseña devuelve {ok:false} y deja el intento.
create or replace function public.decide_role_change(p_request uuid, p_decision text, p_reason text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.role_change_requests;
  v_as text;
  v_auth jsonb;
  v_name text;
  v_approved int;
  v_status text := 'pendiente';
begin
  if v_uid is null then
    raise exception 'FORBIDDEN_ROLE: se requiere una sesión';
  end if;
  if p_decision is null or p_decision not in ('aprobada', 'rechazada') then
    raise exception 'INVALID_FIELD: la decisión debe ser «aprobada» o «rechazada»';
  end if;
  perform app_private.require_reason(p_reason);

  -- 1. Validaciones (no consumen intentos de contraseña).
  select * into v_req from public.role_change_requests where id = p_request for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la solicitud de cambio de rol';
  end if;
  if v_req.status <> 'pendiente' then
    raise exception 'INVALID_TRANSITION: la solicitud % ya está %', v_req.request_number, v_req.status;
  end if;
  if v_req.requested_by = v_uid then
    raise exception 'SOD_VIOLATION: usted solicitó este cambio de rol; debe aprobarlo otra persona (D-39)';
  end if;
  if exists (select 1 from public.role_change_approvals where request_id = p_request and approver = v_uid) then
    raise exception 'SOD_VIOLATION: usted ya aprobó esta solicitud; la segunda aprobación debe ser de otra persona (D-40)';
  end if;
  select r into v_as from unnest(v_req.required_roles) r
  where public.has_role(r)
    and not exists (select 1 from public.role_change_approvals a where a.request_id = p_request and a.approver_role = r)
  limit 1;
  if v_as is null then
    raise exception 'FORBIDDEN_ROLE: esta solicitud la aprueban: % (falta quien no haya decidido)',
      array_to_string(v_req.required_roles, ', ');
  end if;

  -- 2. Reautenticación.
  v_auth := app_private.verify_reauth(v_uid, p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  -- 3. Decisión, aplicación (si se completan las aprobaciones) y bitácora, en una transacción.
  select full_name into v_name from public.profiles where id = v_uid;
  perform set_config('app.audit_reason', trim(p_reason), true);
  insert into public.role_change_approvals (request_id, approver, approver_role, approver_name, decision, reason, reauth_method)
  values (p_request, v_uid, v_as, v_name, p_decision, trim(p_reason), v_auth ->> 'method');

  if p_decision = 'rechazada' then
    v_status := 'rechazada';
  else
    select count(*) into v_approved from public.role_change_approvals
    where request_id = p_request and decision = 'aprobada';
    if v_approved >= cardinality(v_req.required_roles) then
      perform set_config('app.audit_reason',
        format('%s · %s aprobada', v_req.reason, v_req.request_number), true);
      perform app_private.apply_role_change(v_req.kind, v_req.role_code, v_req.payload, v_req.request_number);
      perform set_config('app.audit_reason', trim(p_reason), true);
      v_status := 'aprobada';
    end if;
  end if;

  if v_status <> 'pendiente' then
    update public.role_change_requests
    set status = v_status, closed_by = v_uid, closed_at = now(), close_reason = trim(p_reason)
    where id = p_request;
  end if;
  perform set_config('app.audit_reason', '', true);

  return jsonb_build_object('ok', true, 'status', v_status, 'approved_as', v_as,
    'approvals', (select count(*) from public.role_change_approvals where request_id = p_request and decision = 'aprobada'),
    'required', cardinality(v_req.required_roles));
end;
$$;

-- Quien solicitó puede anular su solicitud mientras está pendiente.
create or replace function public.admin_cancel_role_change(p_request uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.role_change_requests;
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  select * into v_req from public.role_change_requests where id = p_request for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la solicitud de cambio de rol';
  end if;
  if v_req.status <> 'pendiente' then
    raise exception 'INVALID_TRANSITION: la solicitud % ya está %', v_req.request_number, v_req.status;
  end if;
  if v_req.requested_by <> auth.uid() then
    raise exception 'FORBIDDEN_ROLE: solo quien hizo la solicitud la anula';
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.role_change_requests
  set status = 'anulada', closed_by = auth.uid(), closed_at = now(), close_reason = trim(p_reason)
  where id = p_request;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- Lista para la bandeja de aprobación (con nombres y decisiones).
create or replace function public.get_role_change_requests(p_status text default null, p_role text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_see_role_changes() then
    raise exception 'FORBIDDEN_ROLE: solo Administración, Aseguramiento de calidad, Dirección técnica y el auditor ven las solicitudes de cambio de rol';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'request_number', q.request_number, 'kind', q.kind, 'role_code', q.role_code,
      'role_name', coalesce(r.name, q.payload ->> 'name'), 'role_is_system', q.role_is_system,
      'summary', q.summary, 'payload', q.payload, 'before', q.before, 'reason', q.reason,
      'required_roles', to_jsonb(q.required_roles), 'status', q.status,
      'requested_by', q.requested_by, 'requested_by_name', p.full_name, 'requested_at', q.requested_at,
      'closed_at', q.closed_at, 'close_reason', q.close_reason,
      'approvals', coalesce((
        select jsonb_agg(jsonb_build_object('approver', a.approver, 'approver_name', a.approver_name,
                 'approver_role', a.approver_role, 'decision', a.decision, 'reason', a.reason,
                 'decided_at', a.decided_at) order by a.decided_at)
        from public.role_change_approvals a where a.request_id = q.id), '[]')
    ) order by (q.status = 'pendiente') desc, q.requested_at desc)
    from public.role_change_requests q
    left join public.roles r on r.code = q.role_code
    left join public.profiles p on p.id = q.requested_by
    where (p_status is null or q.status = p_status) and (p_role is null or q.role_code = p_role)
  ), '[]');
end;
$$;

revoke execute on function public.admin_request_role_change(text, text, jsonb, text) from public, anon;
revoke execute on function public.decide_role_change(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_cancel_role_change(uuid, text) from public, anon;
revoke execute on function public.get_role_change_requests(text, text) from public, anon;
grant execute on function public.admin_request_role_change(text, text, jsonb, text) to authenticated;
grant execute on function public.decide_role_change(uuid, text, text, text) to authenticated;
grant execute on function public.admin_cancel_role_change(uuid, text) to authenticated;
grant execute on function public.get_role_change_requests(text, text) to authenticated;
