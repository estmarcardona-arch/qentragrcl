-- 0023_warehouses.sql · Etapa E5 (PRD F4: bodega y calidad de insumos)
-- Terceros (proveedores y maquiladores con calificación, D-17), bodegas por función, internas o externas
-- (RF-23, D-20), estantes con zona (D-16) y ubicaciones generadas estante × piso × posición (AC-27).
-- Las existencias y las reglas de ubicación por lote viven en 0024; los traslados, en 0025.

-- ---------------------------------------------------------------------------
-- 1. Terceros: proveedores, maquiladores y almacenamiento externo
-- ---------------------------------------------------------------------------
create table public.external_parties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  kind text not null check (kind in ('proveedor', 'maquilador', 'almacenamiento', 'otro')),
  tax_id text,
  contact text,
  address text,
  qualified boolean not null default false,
  qualification_expires date,
  qualification_ref text,
  qualified_by uuid references public.profiles (id),
  qualified_at timestamptz,
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (not qualified or qualification_expires is not null)
);

comment on table public.external_parties is
  'Terceros (PRD 6.3 external_parties): proveedores de insumos, maquiladores y almacenamiento externo. La calificación la registra Aseguramiento de la calidad (D-17).';
select app_private.register_table('public.external_parties', p_no_delete => true);
create trigger external_parties_version before update on public.external_parties
  for each row execute function public.bump_version();

-- ---------------------------------------------------------------------------
-- 2. Bodegas, tipos de material permitidos, estantes y ubicaciones
-- ---------------------------------------------------------------------------
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^BOD-[A-Z0-9-]{2,10}$'),
  name text not null check (length(trim(name)) > 0),
  function text not null check (function in
    ('materias_primas', 'material_envase', 'material_empaque', 'granel', 'producto_terminado', 'rechazo', 'devolucion')),
  site_type text not null check (site_type in ('interna', 'externa')),
  external_party_id uuid references public.external_parties (id),
  location_prefix text not null unique check (location_prefix ~ '^[A-Z]{2,3}(-[0-9]{2})?$'),
  address text,
  secured boolean not null default false,
  status text not null default 'activa' check (status in ('pendiente_aprobacion', 'activa', 'rechazada', 'inactiva')),
  decision_reason text,
  locked_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check ((site_type = 'externa') = (external_party_id is not null))
);

comment on table public.warehouses is
  'Bodegas (RF-23): función, sitio interno o externo (con tercero) y prefijo de ubicaciones. Una externa nace pendiente de aprobación de Aseguramiento de la calidad (D-20).';
comment on column public.warehouses.secured is 'Bodega bajo llave (p. ej. rechazo).';
select app_private.register_table('public.warehouses', p_no_delete => true);
create trigger warehouses_version before update on public.warehouses
  for each row execute function public.bump_version();
insert into public.signable_tables (table_name, label, kind, author_column)
values ('warehouses', 'Bodega externa', 'bodega', 'created_by');

create table public.warehouse_allowed_types (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id),
  material_class text not null check (material_class in
    ('materia_prima', 'material_envase', 'material_empaque', 'granel', 'producto_terminado')),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (warehouse_id, material_class)
);

comment on table public.warehouse_allowed_types is 'Tipos de material que admite cada bodega (RF-23, RF-24).';
select app_private.register_table('public.warehouse_allowed_types');

create table public.racks (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id),
  rack_no int not null check (rack_no between 1 and 99),
  code text not null check (code ~ '^E[0-9]{2}$'),
  levels_count int not null check (levels_count between 1 and 12),
  positions_per_level int not null check (positions_per_level between 1 and 12),
  zone text not null default 'general' check (zone in ('cuarentena', 'aprobado', 'general')),
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (warehouse_id, rack_no)
);

comment on table public.racks is 'Estantes (RF-23) con pisos, posiciones por piso y zona (cuarentena, aprobado o general; D-16).';
select app_private.register_table('public.racks', p_no_delete => true);
create trigger racks_version before update on public.racks for each row execute function public.bump_version();

create table public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id),
  rack_id uuid not null references public.racks (id),
  level_no int not null check (level_no between 1 and 12),
  position_no int not null check (position_no between 1 and 12),
  code text not null unique,
  allowed_types text[],
  blocked boolean not null default false,
  block_reason text,
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (rack_id, level_no, position_no),
  check (not blocked or block_reason is not null)
);

comment on table public.storage_locations is
  'Ubicaciones (RF-23): código único PREFIJO-Eee-Pp-nn (p. ej. MP-E03-P2-01). «Ocupada» se deriva de las existencias (0024).';
select app_private.register_table('public.storage_locations', p_no_delete => true);
create trigger storage_locations_version before update on public.storage_locations
  for each row execute function public.bump_version();
create index storage_locations_warehouse_idx on public.storage_locations (warehouse_id);

-- ---------------------------------------------------------------------------
-- 3. Lectura (RLS) y escritura solo por RPC
-- ---------------------------------------------------------------------------
create or replace function public.can_read_warehouses()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_permission('bodegas_estantes_y_ubicaciones', 'read')
      or public.has_module_permission('recepcion_inventario', 'read')
      or public.has_module_permission('traslados_y_envios_a_bodegas_externas', 'read')
      or public.has_module_permission('liberacion_de_insumos', 'read');
$$;
revoke execute on function public.can_read_warehouses() from public, anon;
grant execute on function public.can_read_warehouses() to authenticated;

alter table public.external_parties enable row level security;
alter table public.warehouses enable row level security;
alter table public.warehouse_allowed_types enable row level security;
alter table public.racks enable row level security;
alter table public.storage_locations enable row level security;
create policy "warehouse readers" on public.external_parties for select to authenticated using (public.can_read_warehouses());
create policy "warehouse readers" on public.warehouses for select to authenticated using (public.can_read_warehouses());
create policy "warehouse readers" on public.warehouse_allowed_types for select to authenticated using (public.can_read_warehouses());
create policy "warehouse readers" on public.racks for select to authenticated using (public.can_read_warehouses());
create policy "warehouse readers" on public.storage_locations for select to authenticated using (public.can_read_warehouses());
revoke all on table public.external_parties, public.warehouses, public.warehouse_allowed_types, public.racks,
  public.storage_locations from anon;
revoke insert, update, delete, truncate on table public.external_parties, public.warehouses, public.warehouse_allowed_types,
  public.racks, public.storage_locations from authenticated;

-- ---------------------------------------------------------------------------
-- 4. Reglas y funciones de apoyo
-- ---------------------------------------------------------------------------
-- Tercero con calificación vigente a la fecha de referencia (RF-25, AC-24).
create or replace function public.party_is_qualified(p_party uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.active and p.qualified
                     and p.qualification_expires >= (public.reference_now() at time zone 'America/Bogota')::date
                   from public.external_parties p where p.id = p_party), false);
$$;
revoke execute on function public.party_is_qualified(uuid) from public, anon;
grant execute on function public.party_is_qualified(uuid) to authenticated;

create or replace function app_private.require_structure_editor()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_module_permission('bodegas_estantes_y_ubicaciones', 'create') then
    raise exception 'FORBIDDEN_ROLE: la estructura de bodegas la administran el jefe de bodega y el administrador';
  end if;
end;
$$;
revoke execute on function app_private.require_structure_editor() from public, anon, authenticated;

-- Genera estantes y ubicaciones a continuación de los existentes (AC-27: 6 × 4 × 2 = 48 ubicaciones únicas).
create or replace function app_private.generate_locations(p_warehouse uuid, p_racks int, p_levels int, p_positions int,
  p_zone text default 'general')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wh public.warehouses;
  v_first int;
  v_rack uuid;
  v_n int := 0;
begin
  if p_racks not between 1 and 99 or p_levels not between 1 and 12 or p_positions not between 1 and 12 then
    raise exception 'INVALID_FIELD: estantes (1 a 99), pisos por estante (1 a 12) y posiciones por piso (1 a 12)';
  end if;
  select * into v_wh from public.warehouses where id = p_warehouse;
  select coalesce(max(rack_no), 0) + 1 into v_first from public.racks where warehouse_id = p_warehouse;
  if v_first + p_racks - 1 > 99 then
    raise exception 'INVALID_FIELD: una bodega admite hasta 99 estantes';
  end if;
  for r in v_first .. v_first + p_racks - 1 loop
    insert into public.racks (warehouse_id, rack_no, code, levels_count, positions_per_level, zone)
    values (p_warehouse, r, 'E' || lpad(r::text, 2, '0'), p_levels, p_positions, p_zone)
    returning id into v_rack;
    insert into public.storage_locations (warehouse_id, rack_id, level_no, position_no, code)
    select p_warehouse, v_rack, l, p,
           v_wh.location_prefix || '-E' || lpad(r::text, 2, '0') || '-P' || l || '-' || lpad(p::text, 2, '0')
    from generate_series(1, p_levels) l, generate_series(1, p_positions) p;
    v_n := v_n + p_levels * p_positions;
  end loop;
  return v_n;
end;
$$;
revoke execute on function app_private.generate_locations(uuid, int, int, int, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC de terceros
-- ---------------------------------------------------------------------------
create or replace function public.save_external_party(p_id uuid, p_data jsonb, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_kind text := p_data ->> 'kind';
begin
  if not (public.has_module_permission('bodegas_estantes_y_ubicaciones', 'create')
          or public.has_module_permission('bodegas_estantes_y_ubicaciones', 'approve')) then
    raise exception 'FORBIDDEN_ROLE: registran terceros bodega, administración o Aseguramiento de la calidad';
  end if;
  if coalesce(length(trim(p_data ->> 'name')), 0) = 0 then
    raise exception 'INVALID_FIELD: escriba el nombre del tercero';
  end if;
  if p_id is not null then
    perform app_private.require_reason(p_reason);
  end if;
  perform set_config('app.audit_reason', coalesce(trim(p_reason), ''), true);
  if p_id is null then
    insert into public.external_parties (name, kind, tax_id, contact, address)
    values (trim(p_data ->> 'name'), coalesce(v_kind, 'otro'), nullif(trim(p_data ->> 'tax_id'), ''),
            nullif(trim(p_data ->> 'contact'), ''), nullif(trim(p_data ->> 'address'), ''))
    returning id into v_id;
  else
    update public.external_parties set
      name = coalesce(nullif(trim(p_data ->> 'name'), ''), name),
      kind = coalesce(v_kind, kind),
      tax_id = case when p_data ? 'tax_id' then nullif(trim(p_data ->> 'tax_id'), '') else tax_id end,
      contact = case when p_data ? 'contact' then nullif(trim(p_data ->> 'contact'), '') else contact end,
      address = case when p_data ? 'address' then nullif(trim(p_data ->> 'address'), '') else address end,
      active = coalesce((p_data ->> 'active')::boolean, active)
    where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'RECORD_NOT_FOUND: no existe el tercero';
    end if;
  end if;
  perform set_config('app.audit_reason', '', true);
  return v_id;
end;
$$;

-- D-17: la calificación del tercero (y su vencimiento) la registra Aseguramiento de la calidad.
create or replace function public.qualify_external_party(p_id uuid, p_qualified boolean, p_expires date,
  p_reference text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_module_permission('bodegas_estantes_y_ubicaciones', 'approve') then
    raise exception 'FORBIDDEN_ROLE: la calificación de terceros la registra Aseguramiento de la calidad';
  end if;
  perform app_private.require_reason(p_reason);
  if p_qualified and p_expires is null then
    raise exception 'INVALID_FIELD: indique hasta cuándo es vigente la calificación';
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.external_parties set
    qualified = p_qualified, qualification_expires = p_expires, qualification_ref = nullif(trim(p_reference), ''),
    qualified_by = auth.uid(), qualified_at = now()
  where id = p_id;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el tercero';
  end if;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('ok', true, 'qualified', public.party_is_qualified(p_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC de bodegas y ubicaciones
-- ---------------------------------------------------------------------------
-- RF-23: crea la bodega con sus tipos permitidos y, si se indica, su estructura. Una bodega externa queda
-- pendiente de aprobación de Aseguramiento de la calidad (D-20) y no recibe envíos hasta entonces.
create or replace function public.create_warehouse(p_data jsonb, p_allowed text[], p_racks int default null,
  p_levels int default null, p_positions int default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site text := coalesce(p_data ->> 'site_type', 'interna');
  v_party uuid := nullif(p_data ->> 'external_party_id', '')::uuid;
  v_wh public.warehouses;
  v_n int := 0;
begin
  perform app_private.require_structure_editor();
  if v_site = 'externa' then
    if v_party is null then
      raise exception 'INVALID_FIELD: una bodega externa se vincula a un tercero';
    end if;
    if not exists (select 1 from public.external_parties where id = v_party and active and kind in ('maquilador', 'almacenamiento')) then
      raise exception 'INVALID_FIELD: el tercero de una bodega externa es un maquilador o un almacenamiento externo';
    end if;
  else
    v_party := null;
  end if;
  if coalesce(cardinality(p_allowed), 0) = 0 then
    raise exception 'INVALID_FIELD: marque al menos un tipo de material permitido';
  end if;
  perform set_config('app.audit_reason', 'Creación de la bodega ' || coalesce(p_data ->> 'code', ''), true);
  insert into public.warehouses (code, name, function, site_type, external_party_id, location_prefix, address, secured, status)
  values (upper(trim(p_data ->> 'code')), trim(p_data ->> 'name'), p_data ->> 'function', v_site, v_party,
          upper(trim(p_data ->> 'location_prefix')), nullif(trim(p_data ->> 'address'), ''),
          coalesce((p_data ->> 'secured')::boolean, false),
          case when v_site = 'externa' then 'pendiente_aprobacion' else 'activa' end)
  returning * into v_wh;
  insert into public.warehouse_allowed_types (warehouse_id, material_class)
  select v_wh.id, t from unnest(p_allowed) t;
  if p_racks is not null then
    v_n := app_private.generate_locations(v_wh.id, p_racks, p_levels, p_positions);
  end if;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('id', v_wh.id, 'code', v_wh.code, 'status', v_wh.status, 'locations', v_n);
end;
$$;

-- Agrega estantes y ubicaciones a una bodega existente (RF-23).
create or replace function public.generate_locations(p_warehouse uuid, p_racks int, p_levels int, p_positions int,
  p_zone text default 'general')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  perform app_private.require_structure_editor();
  if not exists (select 1 from public.warehouses where id = p_warehouse and status in ('activa', 'pendiente_aprobacion')) then
    raise exception 'INVALID_TRANSITION: la bodega no está activa';
  end if;
  perform set_config('app.audit_reason', 'Generación de ubicaciones', true);
  v_n := app_private.generate_locations(p_warehouse, p_racks, p_levels, p_positions, p_zone);
  perform set_config('app.audit_reason', '', true);
  return v_n;
end;
$$;

-- D-20: Aseguramiento de la calidad aprueba o rechaza una bodega externa, con firma.
create or replace function public.decide_external_warehouse(p_id uuid, p_approve boolean, p_reason text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wh public.warehouses;
  v_res jsonb;
begin
  if not public.has_module_permission('bodegas_estantes_y_ubicaciones', 'approve') then
    raise exception 'FORBIDDEN_ROLE: las bodegas externas las aprueba Aseguramiento de la calidad';
  end if;
  select * into v_wh from public.warehouses where id = p_id for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la bodega';
  end if;
  if v_wh.status <> 'pendiente_aprobacion' then
    raise exception 'INVALID_TRANSITION: la bodega % está %', v_wh.code, v_wh.status;
  end if;
  if v_wh.created_by = auth.uid() then
    raise exception 'SOD_VIOLATION: quien crea la bodega externa no la aprueba';
  end if;
  if not p_approve then
    perform app_private.require_reason(p_reason);
  end if;
  v_res := app_private.sign_simple('warehouses', p_id, case when p_approve then 'aprobo' else 'reviso' end::public.signature_meaning,
    p_password, p_reason, 'aq_dir');
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  perform set_config('app.audit_reason', coalesce(nullif(trim(p_reason), ''), 'Aprobación de bodega externa'), true);
  update public.warehouses set status = case when p_approve then 'activa' else 'rechazada' end,
    decision_reason = nullif(trim(p_reason), '')
  where id = p_id;
  perform set_config('app.audit_reason', '', true);
  return v_res || jsonb_build_object('status', case when p_approve then 'activa' else 'rechazada' end);
end;
$$;

-- D-16: zona del estante (cuarentena, aprobado o general).
create or replace function public.set_rack_zone(p_rack uuid, p_zone text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.require_structure_editor();
  perform app_private.require_reason(p_reason);
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.racks set zone = p_zone where id = p_rack;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el estante';
  end if;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- Bloquea o desbloquea una ubicación con motivo (una ubicación bloqueada no recibe material).
create or replace function public.set_location_blocked(p_location uuid, p_blocked boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.require_structure_editor();
  perform app_private.require_reason(p_reason);
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.storage_locations set blocked = p_blocked, block_reason = case when p_blocked then trim(p_reason) end
  where id = p_location;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la ubicación';
  end if;
  perform set_config('app.audit_reason', '', true);
end;
$$;

revoke execute on function public.save_external_party(uuid, jsonb, text) from public, anon;
revoke execute on function public.qualify_external_party(uuid, boolean, date, text, text) from public, anon;
revoke execute on function public.create_warehouse(jsonb, text[], int, int, int) from public, anon;
revoke execute on function public.generate_locations(uuid, int, int, int, text) from public, anon;
revoke execute on function public.decide_external_warehouse(uuid, boolean, text, text) from public, anon;
revoke execute on function public.set_rack_zone(uuid, text, text) from public, anon;
revoke execute on function public.set_location_blocked(uuid, boolean, text) from public, anon;
grant execute on function public.save_external_party(uuid, jsonb, text) to authenticated;
grant execute on function public.qualify_external_party(uuid, boolean, date, text, text) to authenticated;
grant execute on function public.create_warehouse(jsonb, text[], int, int, int) to authenticated;
grant execute on function public.generate_locations(uuid, int, int, int, text) to authenticated;
grant execute on function public.decide_external_warehouse(uuid, boolean, text, text) to authenticated;
grant execute on function public.set_rack_zone(uuid, text, text) to authenticated;
grant execute on function public.set_location_blocked(uuid, boolean, text) to authenticated;
