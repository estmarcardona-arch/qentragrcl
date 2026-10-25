-- 0026_item_master.sql · Etapa E5B (PRD 1.9, fase F4B: maestro de materiales y productos)
-- RF-26: toda materia prima, material de envase, material de empaque y producto terminado se crea antes en el maestro
-- con código, unidad de almacenamiento (catálogo de unidades), condiciones de almacenamiento, vida útil o reanálisis y
-- unidad de empaque de compra. Lo mantienen I+D, el jefe de bodega y Aseguramiento de la calidad (fila nueva de la
-- matriz 2.2), con motivo en todo cambio; un ítem no se borra, se inactiva. RF-20 (v1.9): la recepción técnica
-- registra la orden de compra y las unidades de empaque (AC-43) y solo admite ítems activos (AC-42).

-- ---------------------------------------------------------------------------
-- 1. Permisos: fila «Maestro de materiales y productos» de la matriz 2.2 (PRD 1.9)
-- ---------------------------------------------------------------------------
insert into public.permission_modules (code, name, order_no) values
  ('maestro_de_materiales_y_productos', 'Maestro de materiales y productos (código, unidad, almacenamiento, vida útil)', 21);

insert into public.module_permissions (module_code, role, cell_text, can_read, can_create, can_sign, can_approve, prd_cell_text)
select 'maestro_de_materiales_y_productos', v.role, v.cell, v.cell = 'L', v.cell = 'C', false, false, v.cell
from (values
  ('comercial', 'L'), ('idi', 'C'), ('bodega_aux', 'L'), ('bodega_jefe', 'C'), ('prod_aux', 'L'), ('prod_coord', 'L'),
  ('lab_aux', 'L'), ('cc_jefe', 'L'), ('aq_dir', 'C'), ('dt', 'L'), ('admin', '—'), ('master', 'L'), ('aq_doc', '—'),
  ('gerencia', 'L'), ('auditor', 'L')
) as v(role, cell);

insert into public.module_permissions (module_code, role, cell_text, can_read, can_create, can_sign, can_approve)
select 'maestro_de_materiales_y_productos', r.code, '—', false, false, false, false
from public.roles r where not r.is_system;

-- ---------------------------------------------------------------------------
-- 2. Campos nuevos del maestro y de la recepción
-- ---------------------------------------------------------------------------
alter table public.materials
  add column storage_conditions text,
  add column shelf_life_months int check (shelf_life_months is null or shelf_life_months between 1 and 120),
  add column shelf_life_kind text not null default 'vencimiento' check (shelf_life_kind in ('vencimiento', 'reanalisis')),
  add column default_package_type text,
  add column default_package_qty numeric(14, 4) check (default_package_qty is null or default_package_qty > 0);
comment on column public.materials.storage_conditions is 'Condiciones de almacenamiento (temperatura, humedad, luz); se imprimen en el rótulo (RF-26).';
comment on column public.materials.shelf_life_months is 'Vida útil o período de reanálisis en meses desde la recepción; sugiere el vencimiento al recibir.';
comment on column public.materials.default_package_type is 'Unidad de empaque de compra (caja, saco, tambor…) con su contenido por defecto.';

alter table public.products add column storage_conditions text;

alter table public.material_lots
  add column purchase_order text,
  add column package_type text,
  add column package_count numeric(14, 4) check (package_count is null or package_count > 0),
  add column qty_per_package numeric(14, 4) check (qty_per_package is null or qty_per_package > 0),
  add constraint material_lots_packages_check check ((package_count is null) = (qty_per_package is null));
comment on column public.material_lots.purchase_order is 'Número de la orden de compra de la recepción técnica (RF-20, v1.9).';

-- ---------------------------------------------------------------------------
-- 3. Reglas del maestro y RPC (RF-26)
-- ---------------------------------------------------------------------------
create or replace function app_private.require_item_editor()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_module_permission('maestro_de_materiales_y_productos', 'create') then
    raise exception 'FORBIDDEN_ROLE: el maestro de materiales y productos lo mantienen I+D, el jefe de bodega y Aseguramiento de la calidad';
  end if;
end;
$$;
revoke execute on function app_private.require_item_editor() from public, anon, authenticated;

create or replace function app_private.check_unit(p_unit text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.catalog_items where catalog = 'unidades' and code = p_unit and active) then
    raise exception 'INVALID_FIELD: la unidad «%» no está en el catálogo de unidades', coalesce(p_unit, '');
  end if;
end;
$$;
revoke execute on function app_private.check_unit(text) from public, anon, authenticated;

-- Un ítem ya usado (I+D o bodega) conserva su código y su tipo: identifican la trazabilidad.
create or replace function app_private.material_in_use(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.material_lots where material_id = p_id)
      or exists (select 1 from public.formula_items where material_id = p_id)
      or exists (select 1 from public.prototype_items where material_id = p_id);
$$;
revoke execute on function app_private.material_in_use(uuid) from public, anon, authenticated;

create or replace function public.save_material(p_id uuid, p_data jsonb, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.materials;
  v_code text := upper(trim(p_data ->> 'code'));
  v_unit text := coalesce(nullif(trim(p_data ->> 'unit'), ''), 'kg');
  v_id uuid;
begin
  perform app_private.require_item_editor();
  if coalesce(length(trim(p_data ->> 'name')), 0) = 0 then
    raise exception 'INVALID_FIELD: escriba el nombre del ítem';
  end if;
  if coalesce(p_data ->> 'type', '') not in ('mp', 'envase', 'empaque') then
    raise exception 'INVALID_FIELD: el tipo es materia prima, material de envase o material de empaque';
  end if;
  perform app_private.check_unit(v_unit);
  if p_id is null then
    if v_code is null or v_code !~ '^[A-Z]{2,4}-[A-Z0-9-]{2,12}$' then
      raise exception 'INVALID_FIELD: el código sigue el formato AAA-999 (p. ej. MP-031, EN-PET-400)';
    end if;
    if exists (select 1 from public.materials where code = v_code) then
      raise exception 'INVALID_FIELD: ya existe un ítem con el código %', v_code;
    end if;
    perform set_config('app.audit_reason', coalesce(nullif(trim(p_reason), ''), 'Creación del ítem ' || v_code), true);
    insert into public.materials (code, name, type, unit, inci_name, default_function, requires_coa, storage_conditions,
      shelf_life_months, shelf_life_kind, default_package_type, default_package_qty)
    values (v_code, trim(p_data ->> 'name'), p_data ->> 'type', v_unit, nullif(trim(p_data ->> 'inci_name'), ''),
      nullif(trim(p_data ->> 'default_function'), ''), coalesce((p_data ->> 'requires_coa')::boolean, true),
      nullif(trim(p_data ->> 'storage_conditions'), ''), nullif(p_data ->> 'shelf_life_months', '')::int,
      coalesce(nullif(p_data ->> 'shelf_life_kind', ''), 'vencimiento'), nullif(trim(p_data ->> 'default_package_type'), ''),
      nullif(p_data ->> 'default_package_qty', '')::numeric)
    returning id into v_id;
  else
    perform app_private.require_reason(p_reason);
    select * into v_old from public.materials where id = p_id for update;
    if not found then
      raise exception 'RECORD_NOT_FOUND: no existe el ítem';
    end if;
    if (v_code is not null and v_code <> v_old.code) or (p_data ->> 'type') <> v_old.type then
      if app_private.material_in_use(p_id) then
        raise exception 'INVALID_FIELD: el ítem ya se usa en I+D o en bodega; su código y su tipo no cambian (cree un ítem nuevo)';
      end if;
      if exists (select 1 from public.materials where code = v_code and id <> p_id) then
        raise exception 'INVALID_FIELD: ya existe un ítem con el código %', v_code;
      end if;
    end if;
    perform set_config('app.audit_reason', trim(p_reason), true);
    update public.materials set
      code = coalesce(v_code, code), name = trim(p_data ->> 'name'), type = p_data ->> 'type', unit = v_unit,
      inci_name = nullif(trim(p_data ->> 'inci_name'), ''), default_function = nullif(trim(p_data ->> 'default_function'), ''),
      requires_coa = coalesce((p_data ->> 'requires_coa')::boolean, requires_coa),
      storage_conditions = nullif(trim(p_data ->> 'storage_conditions'), ''),
      shelf_life_months = nullif(p_data ->> 'shelf_life_months', '')::int,
      shelf_life_kind = coalesce(nullif(p_data ->> 'shelf_life_kind', ''), shelf_life_kind),
      default_package_type = nullif(trim(p_data ->> 'default_package_type'), ''),
      default_package_qty = nullif(p_data ->> 'default_package_qty', '')::numeric,
      active = coalesce((p_data ->> 'active')::boolean, active)
    where id = p_id returning id into v_id;
  end if;
  perform set_config('app.audit_reason', '', true);
  return v_id;
end;
$$;

create or replace function public.save_product(p_id uuid, p_data jsonb, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(p_data ->> 'code'));
  v_id uuid;
begin
  perform app_private.require_item_editor();
  if coalesce(length(trim(p_data ->> 'name')), 0) = 0 then
    raise exception 'INVALID_FIELD: escriba el nombre del producto';
  end if;
  if not exists (select 1 from public.product_lines where id = nullif(p_data ->> 'line_id', '')::uuid) then
    raise exception 'INVALID_FIELD: seleccione la línea (cosmético o medicamento)';
  end if;
  if p_id is null then
    if v_code is null or v_code !~ '^PRD-[0-9]{3}$' then
      raise exception 'INVALID_FIELD: el código del producto sigue el formato PRD-001';
    end if;
    if exists (select 1 from public.products where code = v_code) then
      raise exception 'INVALID_FIELD: ya existe un producto con el código %', v_code;
    end if;
    perform set_config('app.audit_reason', coalesce(nullif(trim(p_reason), ''), 'Creación del producto ' || v_code), true);
    insert into public.products (code, name, line_id, titular, sanitary_registration, sanitary_registration_expires,
      shelf_life_months, storage_conditions)
    values (v_code, trim(p_data ->> 'name'), (p_data ->> 'line_id')::uuid, nullif(trim(p_data ->> 'titular'), ''),
      nullif(trim(p_data ->> 'sanitary_registration'), ''), nullif(p_data ->> 'sanitary_registration_expires', '')::date,
      nullif(p_data ->> 'shelf_life_months', '')::int, nullif(trim(p_data ->> 'storage_conditions'), ''))
    returning id into v_id;
  else
    perform app_private.require_reason(p_reason);
    perform set_config('app.audit_reason', trim(p_reason), true);
    update public.products set
      name = trim(p_data ->> 'name'), line_id = (p_data ->> 'line_id')::uuid, titular = nullif(trim(p_data ->> 'titular'), ''),
      sanitary_registration = nullif(trim(p_data ->> 'sanitary_registration'), ''),
      sanitary_registration_expires = nullif(p_data ->> 'sanitary_registration_expires', '')::date,
      shelf_life_months = nullif(p_data ->> 'shelf_life_months', '')::int,
      storage_conditions = nullif(trim(p_data ->> 'storage_conditions'), ''),
      active = coalesce((p_data ->> 'active')::boolean, active)
    where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'RECORD_NOT_FOUND: no existe el producto';
    end if;
  end if;
  perform set_config('app.audit_reason', '', true);
  return v_id;
end;
$$;

create or replace function public.save_presentation(p_id uuid, p_product uuid, p_data jsonb, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit text := coalesce(nullif(trim(p_data ->> 'unit'), ''), 'mL');
  v_id uuid;
begin
  perform app_private.require_item_editor();
  perform app_private.check_unit(v_unit);
  if coalesce(length(trim(p_data ->> 'code')), 0) = 0 or coalesce(length(trim(p_data ->> 'name')), 0) = 0 then
    raise exception 'INVALID_FIELD: escriba el código y el nombre de la presentación';
  end if;
  if nullif(p_data ->> 'net_content', '')::numeric is null or (p_data ->> 'net_content')::numeric <= 0 then
    raise exception 'INVALID_FIELD: el contenido neto debe ser mayor que cero';
  end if;
  if p_id is null then
    if exists (select 1 from public.product_presentations where product_id = p_product and code = trim(p_data ->> 'code')) then
      raise exception 'INVALID_FIELD: el producto ya tiene la presentación %', trim(p_data ->> 'code');
    end if;
    perform set_config('app.audit_reason', coalesce(nullif(trim(p_reason), ''), 'Nueva presentación'), true);
    insert into public.product_presentations (product_id, code, name, net_content, unit)
    values (p_product, trim(p_data ->> 'code'), trim(p_data ->> 'name'), (p_data ->> 'net_content')::numeric, v_unit)
    returning id into v_id;
  else
    perform app_private.require_reason(p_reason);
    perform set_config('app.audit_reason', trim(p_reason), true);
    update public.product_presentations set name = trim(p_data ->> 'name'), net_content = (p_data ->> 'net_content')::numeric,
      unit = v_unit, active = coalesce((p_data ->> 'active')::boolean, active)
    where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'RECORD_NOT_FOUND: no existe la presentación';
    end if;
  end if;
  perform set_config('app.audit_reason', '', true);
  return v_id;
end;
$$;

revoke execute on function public.save_material(uuid, jsonb, text) from public, anon;
revoke execute on function public.save_product(uuid, jsonb, text) from public, anon;
revoke execute on function public.save_presentation(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.save_material(uuid, jsonb, text) to authenticated;
grant execute on function public.save_product(uuid, jsonb, text) to authenticated;
grant execute on function public.save_presentation(uuid, uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Recepción técnica (RF-20, v1.9): orden de compra y unidades de empaque (AC-43); solo ítems activos (AC-42)
-- ---------------------------------------------------------------------------
create or replace function app_private.receive_lot(p_data jsonb, p_location uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mat public.materials;
  v_expiry date := nullif(p_data ->> 'expiry_date', '')::date;
  v_qty numeric := nullif(p_data ->> 'qty', '')::numeric;
  v_supplier uuid := nullif(p_data ->> 'supplier_id', '')::uuid;
  v_pcount numeric := nullif(p_data ->> 'package_count', '')::numeric;
  v_pqty numeric := nullif(p_data ->> 'qty_per_package', '')::numeric;
  v_lot public.material_lots;
  v_spec uuid;
  v_n int := 0;
begin
  select * into v_mat from public.materials where id = nullif(p_data ->> 'material_id', '')::uuid;
  if not found or not v_mat.active then
    raise exception 'INVALID_FIELD: seleccione un ítem activo del maestro de materiales (AC-42)';
  end if;
  if v_supplier is null or not exists (select 1 from public.external_parties where id = v_supplier and active and kind = 'proveedor') then
    raise exception 'INVALID_FIELD: seleccione el proveedor';
  end if;
  if coalesce(length(trim(p_data ->> 'supplier_lot')), 0) = 0 then
    raise exception 'INVALID_FIELD: escriba el lote del proveedor';
  end if;
  if v_expiry is null then
    raise exception 'INVALID_FIELD: falta fecha de vencimiento';
  end if;
  if v_expiry < (public.reference_now() at time zone 'America/Bogota')::date then
    raise exception 'LOT_EXPIRED: el lote venció el %; no se recibe', to_char(v_expiry, 'DD/MM/YYYY');
  end if;
  -- v1.9 (AC-43): unidades de empaque; la cantidad recibida = número de empaques × contenido por empaque.
  if (v_pcount is null) <> (v_pqty is null) then
    raise exception 'INVALID_FIELD: indique el número de empaques y el contenido de cada uno';
  end if;
  if v_pcount is not null then
    if v_pcount <= 0 or v_pqty <= 0 then
      raise exception 'INVALID_FIELD: el número de empaques y su contenido deben ser mayores que cero';
    end if;
    if v_qty is null then
      v_qty := v_pcount * v_pqty;
    elsif abs(v_qty - v_pcount * v_pqty) > 0.0001 then
      raise exception 'INVALID_FIELD: la cantidad (%) no coincide con % × %', v_qty, v_pcount, v_pqty;
    end if;
  end if;
  if v_qty is null or v_qty <= 0 then
    raise exception 'INVALID_FIELD: la cantidad recibida debe ser mayor que cero';
  end if;
  if v_mat.requires_coa and coalesce(length(trim(p_data ->> 'coa_ref')), 0) = 0 then
    raise exception 'INVALID_FIELD: este material exige el certificado de análisis del proveedor (CoA)';
  end if;
  if p_location is null then
    raise exception 'INVALID_FIELD: asigne una ubicación';
  end if;
  perform app_private.check_location(p_location, 'cuarentena', app_private.material_class(v_mat.type));

  insert into public.material_lots (material_id, internal_code, supplier_id, supplier_lot, expiry_date, qty_received, unit,
    received_by, coa_ref, observations, purchase_order, package_type, package_count, qty_per_package)
  values (v_mat.id, public.next_number(case v_mat.type when 'mp' then 'lot_mp' when 'envase' then 'lot_me' else 'lot_em' end),
    v_supplier, trim(p_data ->> 'supplier_lot'), v_expiry, v_qty, coalesce(nullif(p_data ->> 'unit', ''), v_mat.unit),
    auth.uid(), nullif(trim(p_data ->> 'coa_ref'), ''), nullif(trim(p_data ->> 'observations'), ''),
    nullif(trim(p_data ->> 'purchase_order'), ''), nullif(trim(p_data ->> 'package_type'), ''), v_pcount, v_pqty)
  returning * into v_lot;

  -- Pruebas de liberación: especificación vigente del material o revisión del CoA (D-52).
  select s.id into v_spec
  from public.specifications s join public.document_versions dv on dv.id = s.document_version_id
  where s.material_id = v_mat.id and s.scope in ('mp', 'envase') and dv.status = 'vigente'
  order by dv.effective_at desc nulls last limit 1;
  if v_spec is not null then
    insert into public.lot_tests (lot_id, order_no, name, method, acceptance, spec_parameter_id)
    select v_lot.id, row_number() over (order by p.order_no), p.name, p.method,
      coalesce(nullif(p.text_limit, ''),
        case when p.min_value is not null and p.max_value is not null then p.min_value || ' – ' || p.max_value
             when p.min_value is not null then '≥ ' || p.min_value
             when p.max_value is not null then '≤ ' || p.max_value else '' end || coalesce(' ' || p.unit, '')),
      p.id
    from public.spec_parameters p where p.specification_id = v_spec;
    get diagnostics v_n = row_count;
  end if;
  if v_n = 0 then
    insert into public.lot_tests (lot_id, order_no, name, method, acceptance)
    values (v_lot.id, 1, 'Certificado de análisis del proveedor', 'Revisión documental del CoA',
            'Conforme con la especificación del proveedor');
  end if;

  insert into public.lot_status_history (lot_id, from_status, to_status, reason)
  values (v_lot.id, null, 'cuarentena', 'Recepción');
  insert into public.inventory_movements (lot_id, type, qty, to_location_id, ref_table, ref_id, ref_code, reason)
  values (v_lot.id, 'recepcion', v_qty, p_location, 'material_lots', v_lot.id, v_lot.internal_code,
          nullif(trim(p_data ->> 'observations'), ''));
  return jsonb_build_object('id', v_lot.id, 'code', v_lot.internal_code,
    'location', (select code from public.storage_locations where id = p_location));
end;
$$;
revoke execute on function app_private.receive_lot(jsonb, uuid) from public, anon, authenticated;
