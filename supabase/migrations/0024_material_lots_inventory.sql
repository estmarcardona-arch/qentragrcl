-- 0024_material_lots_inventory.sql · Etapa E5 (PRD F4: bodega y calidad de insumos)
-- Lotes de insumo con recepción en cuarentena (RF-20), kardex por movimientos y existencias por ubicación que
-- nunca quedan negativas (RF-21), reglas de ubicación (RF-24: LOCATION_TYPE_MISMATCH, LOCATION_RULE_VIOLATION;
-- D-16), resultados de análisis y liberación por Control de calidad con firma (RF-22, SOD-5), rótulos (S-14) y
-- la verificación de disponibilidad que usará la dispensación (AC-03: LOT_NOT_APPROVED, en E6/E7).
-- «Vencido» y «agotado» se derivan de la fecha de vencimiento y del saldo (v_lot_stock): no se escriben.

insert into public.numbering_sequences (key, format, description) values
  ('lot_mp', 'MP-{YYYY}-{NNNN}', 'Código interno de lotes de materia prima (Prompt 0B: MP-2026-0198).'),
  ('lot_me', 'ME-{YYYY}-{NNNN}', 'Código interno de lotes de material de envase (supuesto, D-51).'),
  ('lot_em', 'EM-{YYYY}-{NNNN}', 'Código interno de lotes de material de empaque (supuesto, D-51).');

-- ---------------------------------------------------------------------------
-- 1. Lotes de insumo, historia de estado y resultados de análisis
-- ---------------------------------------------------------------------------
create table public.material_lots (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id),
  internal_code text not null unique,
  supplier_id uuid references public.external_parties (id),
  supplier_lot text not null check (length(trim(supplier_lot)) > 0),
  expiry_date date not null,
  qty_received numeric(14, 4) not null check (qty_received > 0),
  unit text not null,
  received_at timestamptz not null default now(),
  received_by uuid references public.profiles (id),
  coa_ref text,
  observations text,
  status text not null default 'cuarentena' check (status in ('cuarentena', 'aprobado', 'rechazado')),
  status_reason text,
  sampled_at timestamptz,
  sampled_by uuid references public.profiles (id),
  released_at timestamptz,
  released_by uuid references public.profiles (id),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.material_lots is
  'Lotes de insumo (PRD 6.3). Estado de calidad: cuarentena → aprobado | rechazado (solo por RPC). Vencido y agotado se derivan en v_lot_stock.';
select app_private.register_table('public.material_lots', p_no_delete => true);
create index material_lots_material_idx on public.material_lots (material_id);
insert into public.signable_tables (table_name, label, kind, is_quality, author_column)
values ('material_lots', 'Lote de insumo', 'lote_insumo', true, 'received_by');

create table public.lot_status_history (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.material_lots (id),
  from_status text,
  to_status text not null,
  reason text,
  signature_id uuid references public.signatures (id),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.lot_status_history is 'Historia inmutable del estado de calidad de cada lote de insumo (PRD 6.3).';
select app_private.register_table('public.lot_status_history', p_append_only => true);

-- Pruebas que exige la liberación: los parámetros de la especificación vigente del material (RF-12, scope mp/envase)
-- o, si no la tiene, la revisión del certificado de análisis del proveedor (D-52).
create table public.lot_tests (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.material_lots (id),
  order_no int not null,
  name text not null,
  method text not null default '',
  acceptance text not null default '',
  spec_parameter_id uuid references public.spec_parameters (id),
  result_value text,
  conforming boolean,
  recorded_by uuid references public.profiles (id),
  recorded_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (lot_id, order_no),
  check ((conforming is null) = (recorded_at is null))
);

comment on table public.lot_tests is 'Resultados de análisis de recepción por lote (RF-22). Pendiente = sin resultado.';
select app_private.register_table('public.lot_tests', p_no_delete => true);

-- ---------------------------------------------------------------------------
-- 2. Kardex: movimientos inmutables y existencias por ubicación
-- ---------------------------------------------------------------------------
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.material_lots (id),
  type text not null check (type in
    ('recepcion', 'dispensacion', 'ajuste', 'devolucion', 'traslado', 'envio_externo', 'recepcion_externa')),
  qty numeric(14, 4) not null check (qty > 0),
  from_location_id uuid references public.storage_locations (id),
  to_location_id uuid references public.storage_locations (id),
  ref_table text,
  ref_id uuid,
  ref_code text,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (from_location_id is not null or to_location_id is not null),
  check (from_location_id is distinct from to_location_id)
);

comment on table public.inventory_movements is
  'Kardex (RF-21): movimientos inmutables. Salida = from_location_id; entrada = to_location_id. El saldo es la suma de movimientos.';
select app_private.register_table('public.inventory_movements', p_append_only => true);
create index inventory_movements_lot_idx on public.inventory_movements (lot_id, created_at);

create table public.stock_by_location (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.material_lots (id),
  location_id uuid not null references public.storage_locations (id),
  qty numeric(14, 4) not null check (qty >= 0),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (lot_id, location_id)
);

comment on table public.stock_by_location is
  'Existencias por lote y ubicación (PRD 6.3). Las mantiene el trigger de inventory_movements; nunca quedan negativas.';
select app_private.register_table('public.stock_by_location');
create index stock_by_location_location_idx on public.stock_by_location (location_id) where qty > 0;

-- Aplica cada movimiento a las existencias. Una salida mayor que el saldo de la ubicación se rechaza.
create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qty numeric;
begin
  if new.from_location_id is not null then
    select qty into v_qty from public.stock_by_location
    where lot_id = new.lot_id and location_id = new.from_location_id for update;
    if coalesce(v_qty, 0) < new.qty then
      raise exception 'INSUFFICIENT_STOCK: la ubicación tiene % y se intentan sacar %', coalesce(v_qty, 0), new.qty;
    end if;
    update public.stock_by_location set qty = qty - new.qty
    where lot_id = new.lot_id and location_id = new.from_location_id;
  end if;
  if new.to_location_id is not null then
    insert into public.stock_by_location (lot_id, location_id, qty) values (new.lot_id, new.to_location_id, new.qty)
    on conflict (lot_id, location_id) do update set qty = public.stock_by_location.qty + excluded.qty;
  end if;
  return new;
end;
$$;

create trigger inventory_movements_apply after insert on public.inventory_movements
  for each row execute function public.apply_inventory_movement();

-- Rótulos impresos (S-14).
create table public.labels (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.material_lots (id),
  qr_payload text not null,
  location_code text,
  status_printed text not null,
  printed_by uuid references public.profiles (id),
  printed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.labels is 'Rótulos impresos (PRD 6.3): quién y cuándo imprimió, con el estado y la ubicación del momento.';
select app_private.register_table('public.labels', p_append_only => true);

-- ---------------------------------------------------------------------------
-- 3. Vistas de existencias y ubicaciones
-- ---------------------------------------------------------------------------
create or replace view public.v_lot_stock
with (security_invoker = true)
as
with today as (select (public.reference_now() at time zone 'America/Bogota')::date as d),
on_hand as (
  select lot_id, sum(qty) as qty from public.stock_by_location group by lot_id
),
-- En tránsito: salidas de un traslado aún no recibidas en el destino (internas o externas).
moves as (
  select lot_id,
    sum(qty) filter (where ref_table = 'stock_transfers' and to_location_id is null) as sent,
    sum(qty) filter (where ref_table = 'stock_transfers' and from_location_id is null) as received_ext
  from public.inventory_movements group by lot_id
)
select l.id, l.internal_code, l.material_id, m.code as material_code, m.name as material_name, m.type as material_type,
  l.supplier_id, s.name as supplier_name, l.supplier_lot, l.expiry_date, l.qty_received, l.unit, l.received_at,
  l.status, l.status_reason,
  coalesce(o.qty, 0) as qty_on_hand,
  greatest(coalesce(mv.sent, 0) - coalesce(mv.received_ext, 0), 0) as qty_in_transit,
  (l.expiry_date - t.d) as days_to_expiry,
  case
    when l.status = 'rechazado' then 'rechazado'
    when l.expiry_date < t.d then 'vencido'
    when l.status = 'aprobado' and coalesce(o.qty, 0) = 0 and coalesce(mv.sent, 0) <= coalesce(mv.received_ext, 0) then 'agotado'
    else l.status
  end as effective_status
from public.material_lots l
join public.materials m on m.id = l.material_id
left join public.external_parties s on s.id = l.supplier_id
left join on_hand o on o.lot_id = l.id
left join moves mv on mv.lot_id = l.id
cross join today t;

comment on view public.v_lot_stock is
  'Saldo por lote (RF-21): existencias en ubicaciones, en tránsito y estado efectivo (vencido y agotado derivados).';

create or replace view public.v_location_status
with (security_invoker = true)
as
select sl.id, sl.code, sl.warehouse_id, w.code as warehouse_code, sl.rack_id, r.code as rack_code, r.zone,
  sl.level_no, sl.position_no, sl.blocked, sl.block_reason, sl.active,
  coalesce(st.lots, 0) as lots, coalesce(st.qty, 0) as qty,
  case when sl.blocked then 'bloqueada' when coalesce(st.lots, 0) > 0 then 'ocupada' else 'libre' end as status
from public.storage_locations sl
join public.warehouses w on w.id = sl.warehouse_id
join public.racks r on r.id = sl.rack_id
left join (select location_id, count(*) as lots, sum(qty) as qty from public.stock_by_location where qty > 0 group by location_id) st
  on st.location_id = sl.id;

comment on view public.v_location_status is 'Estado de cada ubicación (libre, ocupada o bloqueada) derivado de las existencias.';

-- ---------------------------------------------------------------------------
-- 4. Lectura (RLS) y escritura solo por RPC
-- ---------------------------------------------------------------------------
create or replace function public.can_read_inventory()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_permission('recepcion_inventario', 'read')
      or public.has_module_permission('liberacion_de_insumos', 'read')
      or public.has_module_permission('traslados_y_envios_a_bodegas_externas', 'read');
$$;
revoke execute on function public.can_read_inventory() from public, anon;
grant execute on function public.can_read_inventory() to authenticated;

alter table public.material_lots enable row level security;
alter table public.lot_status_history enable row level security;
alter table public.lot_tests enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.stock_by_location enable row level security;
alter table public.labels enable row level security;
create policy "inventory readers" on public.material_lots for select to authenticated using (public.can_read_inventory());
create policy "inventory readers" on public.lot_status_history for select to authenticated using (public.can_read_inventory());
create policy "inventory readers" on public.lot_tests for select to authenticated using (public.can_read_inventory());
create policy "inventory readers" on public.inventory_movements for select to authenticated using (public.can_read_inventory());
create policy "inventory readers" on public.stock_by_location for select to authenticated
  using (public.can_read_inventory() or public.can_read_warehouses());
create policy "inventory readers" on public.labels for select to authenticated using (public.can_read_inventory());
create policy "inventory readers read lot signatures" on public.signatures for select to authenticated
  using (record_table in ('material_lots', 'warehouses') and (public.can_read_inventory() or public.can_read_warehouses()));
revoke all on table public.material_lots, public.lot_status_history, public.lot_tests, public.inventory_movements,
  public.stock_by_location, public.labels, public.v_lot_stock, public.v_location_status from anon;
revoke insert, update, delete, truncate on table public.material_lots, public.lot_status_history, public.lot_tests,
  public.inventory_movements, public.stock_by_location, public.labels from authenticated;
revoke execute on function public.apply_inventory_movement() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Reglas de ubicación (RF-24, D-16)
-- ---------------------------------------------------------------------------
create or replace function app_private.material_class(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_type when 'mp' then 'materia_prima' when 'envase' then 'material_envase' when 'empaque' then 'material_empaque' end;
$$;

-- Valida que un lote (por su estado y tipo de material) pueda quedar en la ubicación.
create or replace function app_private.check_location(p_location uuid, p_status text, p_class text, p_internal_only boolean default true)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v record;
begin
  select sl.code, sl.blocked, sl.active, sl.allowed_types, w.code as wh_code, w.function, w.site_type, w.status as wh_status,
         r.zone, r.active as rack_active, w.id as wh_id
  into v
  from public.storage_locations sl join public.warehouses w on w.id = sl.warehouse_id join public.racks r on r.id = sl.rack_id
  where sl.id = p_location;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la ubicación';
  end if;
  if not v.active or not v.rack_active or v.blocked then
    raise exception 'LOCATION_RULE_VIOLATION: la ubicación % está bloqueada o inactiva', v.code;
  end if;
  if v.wh_status <> 'activa' then
    raise exception 'LOCATION_RULE_VIOLATION: la bodega % no está activa (%)', v.wh_code, v.wh_status;
  end if;
  if p_internal_only and v.site_type = 'externa' then
    raise exception 'LOCATION_RULE_VIOLATION: a una bodega externa solo se llega con un traslado';
  end if;
  if not exists (select 1 from public.warehouse_allowed_types where warehouse_id = v.wh_id and material_class = p_class)
     or (v.allowed_types is not null and not p_class = any(v.allowed_types)) then
    raise exception 'LOCATION_TYPE_MISMATCH: la ubicación % (%) no admite %', v.code, v.wh_code, replace(p_class, '_', ' ');
  end if;
  if p_status = 'rechazado' and v.function <> 'rechazo' then
    raise exception 'LOCATION_RULE_VIOLATION: un lote rechazado solo va a la bodega de rechazo (D-16)';
  end if;
  if v.function = 'rechazo' and p_status <> 'rechazado' and p_status <> 'vencido' then
    raise exception 'LOCATION_RULE_VIOLATION: la bodega de rechazo solo guarda lotes rechazados o vencidos';
  end if;
  if p_status = 'cuarentena' and v.zone = 'aprobado' then
    raise exception 'LOCATION_RULE_VIOLATION: un lote en cuarentena no va a una zona de aprobados (D-16)';
  end if;
  if p_status = 'aprobado' and v.zone = 'cuarentena' then
    raise exception 'LOCATION_RULE_VIOLATION: un lote aprobado no va a la zona de cuarentena (D-16)';
  end if;
end;
$$;
revoke execute on function app_private.check_location(uuid, text, text, boolean) from public, anon, authenticated;

-- Estado que cuenta para las reglas: un lote vencido se trata como «vencido».
create or replace function app_private.lot_rule_status(p_lot uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when l.status = 'rechazado' then 'rechazado'
              when l.expiry_date < (public.reference_now() at time zone 'America/Bogota')::date then 'vencido'
              else l.status end
  from public.material_lots l where l.id = p_lot;
$$;
revoke execute on function app_private.lot_rule_status(uuid) from public, anon, authenticated;

-- RF-20: ubicaciones libres y compatibles que se proponen al recibir: primero la bodega de la función del material y la
-- zona que corresponde al estado; nunca las bodegas de rechazo o devolución para un lote que no lo es (D-16).
create or replace function public.suggest_locations(p_material uuid, p_status text default 'cuarentena', p_limit int default 8)
returns table (location_id uuid, code text, warehouse_code text, zone text)
language sql
stable
security definer
set search_path = ''
as $$
  select sl.id, sl.code, w.code, r.zone
  from public.storage_locations sl
  join public.warehouses w on w.id = sl.warehouse_id
  join public.racks r on r.id = sl.rack_id
  join public.materials m on m.id = p_material
  where public.can_read_inventory()
    and sl.active and not sl.blocked and r.active and w.status = 'activa' and w.site_type = 'interna'
    and exists (select 1 from public.warehouse_allowed_types t where t.warehouse_id = w.id
                  and t.material_class = app_private.material_class(m.type))
    and (sl.allowed_types is null or app_private.material_class(m.type) = any(sl.allowed_types))
    and not exists (select 1 from public.stock_by_location s where s.location_id = sl.id and s.qty > 0)
    and case p_status when 'rechazado' then w.function = 'rechazo'
                      when 'cuarentena' then w.function not in ('rechazo', 'devolucion') and r.zone <> 'aprobado'
                      else w.function not in ('rechazo', 'devolucion') and r.zone <> 'cuarentena' end
  -- Primero la bodega cuya función corresponde al material, luego la zona que corresponde al estado.
  order by case when w.function = case m.type when 'mp' then 'materias_primas' when 'envase' then 'material_envase'
                                              else 'material_empaque' end then 0 else 1 end,
           case when r.zone = case when p_status = 'cuarentena' then 'cuarentena' else 'aprobado' end then 0 else 1 end,
           sl.code
  limit greatest(p_limit, 1);
$$;
revoke execute on function public.suggest_locations(uuid, text, int) from public, anon;
grant execute on function public.suggest_locations(uuid, text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Recepción (RF-20) e importación de recepciones (D-03)
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
  v_lot public.material_lots;
  v_spec uuid;
  v_n int := 0;
begin
  select * into v_mat from public.materials where id = nullif(p_data ->> 'material_id', '')::uuid;
  if not found or not v_mat.active then
    raise exception 'INVALID_FIELD: seleccione un material activo';
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
    received_by, coa_ref, observations)
  values (v_mat.id, public.next_number(case v_mat.type when 'mp' then 'lot_mp' when 'envase' then 'lot_me' else 'lot_em' end),
    v_supplier, trim(p_data ->> 'supplier_lot'), v_expiry, v_qty, coalesce(nullif(p_data ->> 'unit', ''), v_mat.unit),
    auth.uid(), nullif(trim(p_data ->> 'coa_ref'), ''), nullif(trim(p_data ->> 'observations'), ''))
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

create or replace function public.receive_material_lot(p_data jsonb, p_location uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res jsonb;
begin
  if not public.has_module_permission('recepcion_inventario', 'create') then
    raise exception 'FORBIDDEN_ROLE: la recepción la registra el auxiliar de bodega';
  end if;
  perform set_config('app.audit_reason', 'Recepción de lote', true);
  v_res := app_private.receive_lot(p_data, p_location);
  perform set_config('app.audit_reason', '', true);
  return v_res;
end;
$$;

-- D-03: importación de recepciones desde un archivo (CSV) en una sola transacción: todas las filas o ninguna.
-- Cada fila entra en cuarentena como cualquier recepción; Control de calidad las libera.
create or replace function public.import_material_receipts(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_i int := 0;
  v_out jsonb := '[]';
  v_loc uuid;
begin
  if not public.has_module_permission('recepcion_inventario', 'create') then
    raise exception 'FORBIDDEN_ROLE: la recepción la registra el auxiliar de bodega';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'INVALID_FIELD: el archivo no tiene filas';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'INVALID_FIELD: importe hasta 500 filas por archivo';
  end if;
  perform set_config('app.audit_reason', 'Importación de recepciones (CSV)', true);
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_i := v_i + 1;
    select id into v_loc from public.storage_locations where code = upper(trim(v_row ->> 'location_code'));
    begin
      v_out := v_out || jsonb_build_array(app_private.receive_lot(
        v_row || jsonb_build_object(
          'material_id', (select id from public.materials where code = upper(trim(v_row ->> 'material_code'))),
          'supplier_id', (select id from public.external_parties where name = trim(v_row ->> 'supplier_name') and kind = 'proveedor')),
        v_loc));
    exception when others then
      raise exception '%', regexp_replace(sqlerrm, '^([A-Z_]+): ', '\1: fila ' || v_i || ': ');
    end;
  end loop;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('ok', true, 'imported', jsonb_array_length(v_out), 'lots', v_out);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Traslado interno y ajuste (RF-24, RF-21)
-- ---------------------------------------------------------------------------
create or replace function public.relocate_lot(p_lot uuid, p_from uuid, p_to uuid, p_qty numeric, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.material_lots;
  v_type text;
begin
  if not (public.has_module_permission('recepcion_inventario', 'create')
          or public.has_module_permission('traslados_y_envios_a_bodegas_externas', 'create')) then
    raise exception 'FORBIDDEN_ROLE: los traslados internos los hace bodega';
  end if;
  perform app_private.require_reason(p_reason);
  select * into v_lot from public.material_lots where id = p_lot;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el lote';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'INVALID_FIELD: la cantidad debe ser mayor que cero';
  end if;
  if exists (select 1 from public.storage_locations sl join public.warehouses w on w.id = sl.warehouse_id
             where sl.id = p_from and w.site_type = 'externa') then
    raise exception 'LOCATION_RULE_VIOLATION: desde una bodega externa se regresa con un traslado';
  end if;
  select type into v_type from public.materials where id = v_lot.material_id;
  perform app_private.check_location(p_to, app_private.lot_rule_status(p_lot), app_private.material_class(v_type));
  perform set_config('app.audit_reason', trim(p_reason), true);
  insert into public.inventory_movements (lot_id, type, qty, from_location_id, to_location_id, reason)
  values (p_lot, 'traslado', p_qty, p_from, p_to, trim(p_reason));
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('ok', true);
end;
$$;

-- Ajuste con motivo (merma, conteo, muestra): nada se borra; el error se corrige con otro movimiento.
create or replace function public.adjust_lot(p_lot uuid, p_location uuid, p_qty numeric, p_kind text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_module_permission('recepcion_inventario', 'approve') then
    raise exception 'FORBIDDEN_ROLE: los ajustes de inventario los registra el jefe de bodega';
  end if;
  perform app_private.require_reason(p_reason);
  if p_qty is null or p_qty = 0 then
    raise exception 'INVALID_FIELD: el ajuste debe ser distinto de cero';
  end if;
  if p_kind not in ('merma', 'conteo', 'muestra', 'otro') then
    raise exception 'INVALID_FIELD: tipo de ajuste no válido';
  end if;
  if not exists (select 1 from public.material_lots where id = p_lot) then
    raise exception 'RECORD_NOT_FOUND: no existe el lote';
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  insert into public.inventory_movements (lot_id, type, qty, from_location_id, to_location_id, ref_code, reason)
  values (p_lot, 'ajuste', abs(p_qty), case when p_qty < 0 then p_location end, case when p_qty > 0 then p_location end,
          p_kind, trim(p_reason));
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Resultados y liberación por Control de calidad (RF-22, SOD-5)
-- ---------------------------------------------------------------------------
create or replace function public.record_lot_results(p_lot uuid, p_results jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.material_lots;
  v_r jsonb;
  v_n int := 0;
begin
  if not public.has_module_permission('liberacion_de_insumos', 'create') then
    raise exception 'FORBIDDEN_ROLE: los resultados de análisis los registra el laboratorio';
  end if;
  select * into v_lot from public.material_lots where id = p_lot for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el lote';
  end if;
  if v_lot.status <> 'cuarentena' then
    raise exception 'INVALID_TRANSITION: el lote % ya está %', v_lot.internal_code, v_lot.status;
  end if;
  if jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results) = 0 then
    raise exception 'INVALID_FIELD: registre al menos un resultado';
  end if;
  perform set_config('app.audit_reason', 'Resultados de análisis de ' || v_lot.internal_code, true);
  for v_r in select * from jsonb_array_elements(p_results) loop
    if (v_r ->> 'conforming') is null or coalesce(length(trim(v_r ->> 'value')), 0) = 0 then
      raise exception 'INVALID_FIELD: cada resultado lleva valor y conformidad';
    end if;
    update public.lot_tests set result_value = trim(v_r ->> 'value'), conforming = (v_r ->> 'conforming')::boolean,
      recorded_by = auth.uid(), recorded_at = now()
    where id = (v_r ->> 'test_id')::uuid and lot_id = p_lot and recorded_at is null;
    if not found then
      raise exception 'RECORD_LOCKED: el resultado ya se registró o no pertenece al lote; corríjalo con motivo';
    end if;
    v_n := v_n + 1;
  end loop;
  update public.material_lots set sampled_at = coalesce(sampled_at, now()), sampled_by = coalesce(sampled_by, auth.uid())
  where id = p_lot;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('ok', true, 'recorded', v_n,
    'pending', (select count(*) from public.lot_tests where lot_id = p_lot and recorded_at is null));
end;
$$;

create or replace function public.release_material_lot(p_lot uuid, p_decision text, p_reason text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.material_lots;
  v_pending int;
  v_nc int;
  v_res jsonb;
begin
  if not public.has_module_permission('liberacion_de_insumos', 'approve') then
    raise exception 'FORBIDDEN_ROLE: libera o rechaza el jefe de control de calidad';
  end if;
  if p_decision not in ('aprobado', 'rechazado') then
    raise exception 'INVALID_FIELD: la decisión es «aprobado» o «rechazado»';
  end if;
  select * into v_lot from public.material_lots where id = p_lot for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el lote';
  end if;
  if v_lot.status <> 'cuarentena' then
    raise exception 'INVALID_TRANSITION: el lote % ya está %', v_lot.internal_code, v_lot.status;
  end if;
  -- SOD-5: quien analiza no aprueba ni rechaza ese lote.
  if exists (select 1 from public.lot_tests where lot_id = p_lot and recorded_by = auth.uid()) then
    raise exception 'SOD_VIOLATION: usted registró resultados de este lote; la decisión la firma otra persona';
  end if;
  if p_decision = 'aprobado' then
    select count(*) filter (where recorded_at is null), count(*) filter (where conforming is false)
    into v_pending, v_nc from public.lot_tests where lot_id = p_lot;
    if v_pending > 0 then
      raise exception 'RESULTS_PENDING: faltan % resultado(s) de análisis (%)', v_pending,
        (select string_agg(name, ', ' order by order_no) from public.lot_tests where lot_id = p_lot and recorded_at is null);
    end if;
    if v_nc > 0 then
      raise exception 'INVALID_TRANSITION: hay resultados no conformes; el lote se rechaza con motivo';
    end if;
    if v_lot.expiry_date < (public.reference_now() at time zone 'America/Bogota')::date then
      raise exception 'LOT_EXPIRED: el lote venció el %', to_char(v_lot.expiry_date, 'DD/MM/YYYY');
    end if;
  else
    perform app_private.require_reason(p_reason);
  end if;
  v_res := app_private.sign_simple('material_lots', p_lot,
    case when p_decision = 'aprobado' then 'libero' else 'reviso' end::public.signature_meaning, p_password, p_reason, 'cc_jefe');
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  perform set_config('app.audit_reason', coalesce(nullif(trim(p_reason), ''), 'Liberación de insumo'), true);
  update public.material_lots set status = p_decision, status_reason = nullif(trim(p_reason), ''),
    released_at = now(), released_by = auth.uid()
  where id = p_lot;
  insert into public.lot_status_history (lot_id, from_status, to_status, reason, signature_id)
  values (p_lot, 'cuarentena', p_decision, nullif(trim(p_reason), ''), (v_res ->> 'signature_id')::uuid);
  perform set_config('app.audit_reason', '', true);
  return v_res || jsonb_build_object('status', p_decision);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Rótulo (S-14) y disponibilidad para dispensar (AC-03; la usa la dispensación en E6/E7)
-- ---------------------------------------------------------------------------
create or replace function public.log_label_print(p_lot uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_id uuid;
begin
  if not public.can_read_inventory() then
    raise exception 'FORBIDDEN_ROLE: su rol no imprime rótulos';
  end if;
  select l.internal_code, s.effective_status,
    (select string_agg(sl.code, ', ' order by sl.code) from public.stock_by_location b
       join public.storage_locations sl on sl.id = b.location_id where b.lot_id = l.id and b.qty > 0) as loc
  into v from public.material_lots l join public.v_lot_stock s on s.id = l.id where l.id = p_lot;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el lote';
  end if;
  insert into public.labels (lot_id, qr_payload, location_code, status_printed, printed_by)
  values (p_lot, v.internal_code, v.loc, v.effective_status, auth.uid()) returning id into v_id;
  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.assert_lot_available(p_lot uuid, p_qty numeric)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.v_lot_stock;
begin
  select * into v from public.v_lot_stock where id = p_lot;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el lote';
  end if;
  if v.status <> 'aprobado' then
    raise exception 'LOT_NOT_APPROVED: el lote % está %', v.internal_code, v.status;
  end if;
  if v.effective_status = 'vencido' then
    raise exception 'LOT_EXPIRED: el lote % venció el %', v.internal_code, to_char(v.expiry_date, 'DD/MM/YYYY');
  end if;
  if v.qty_on_hand < p_qty then
    raise exception 'INSUFFICIENT_STOCK: el lote % tiene % % y se requieren %', v.internal_code, v.qty_on_hand, v.unit, p_qty;
  end if;
end;
$$;

revoke execute on function public.receive_material_lot(jsonb, uuid) from public, anon;
revoke execute on function public.import_material_receipts(jsonb) from public, anon;
revoke execute on function public.relocate_lot(uuid, uuid, uuid, numeric, text) from public, anon;
revoke execute on function public.adjust_lot(uuid, uuid, numeric, text, text) from public, anon;
revoke execute on function public.record_lot_results(uuid, jsonb) from public, anon;
revoke execute on function public.release_material_lot(uuid, text, text, text) from public, anon;
revoke execute on function public.log_label_print(uuid) from public, anon;
revoke execute on function public.assert_lot_available(uuid, numeric) from public, anon;
grant execute on function public.receive_material_lot(jsonb, uuid) to authenticated;
grant execute on function public.import_material_receipts(jsonb) to authenticated;
grant execute on function public.relocate_lot(uuid, uuid, uuid, numeric, text) to authenticated;
grant execute on function public.adjust_lot(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.record_lot_results(uuid, jsonb) to authenticated;
grant execute on function public.release_material_lot(uuid, text, text, text) to authenticated;
grant execute on function public.log_label_print(uuid) to authenticated;
grant execute on function public.assert_lot_available(uuid, numeric) to authenticated;
