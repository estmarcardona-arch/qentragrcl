-- 0029_production_orders.sql · Etapa E7 (PRD F6): orden de producción, lote, órdenes de etapa y documentos generados.
-- RF-30 (OP solo con documentos vigentes; versiones congeladas; NO_APPROVED_VERSION, DOCUMENT_NOT_EFFECTIVE), RF-38 y
-- AC-14 (al aprobar: órdenes de etapa, solicitudes SD/SE/SA, orden de codificado, rótulos y registros; cantidad =
-- % × tamaño de lote), D-11 (OP-AAAA-NNNN) y D-12 (aprueba el Director técnico; quien crea no aprueba).

-- ---------------------------------------------------------------------------
-- 1. Numeración y configuración
-- ---------------------------------------------------------------------------
insert into public.numbering_sequences (key, format, description) values
  ('production_order', 'OP-{YYYY}-{NNNN}', 'Órdenes de producción (D-11; Prompt 0B: OP-2026-0042).'),
  ('batch', 'L-{YYMM}-{NNN}', 'Lotes de producto: año y mes de la fecha planeada y consecutivo mensual (D-65; Prompt 0B: L-2610-018).');

insert into public.app_settings (key, value, description) values
  ('in_process_control_interval_minutes', '30', 'Minutos entre controles de peso o volumen en envase (RF-35, D-08).'),
  ('fill_weight_tolerance_pct', '1.5', 'Tolerancia del peso neto en envase, ± % del contenido nominal con densidad 1,00 (D-66; 0B: 197,0–203,0 g en 200 mL).'),
  ('dispensing_tolerance_pct', '0', 'Diferencia admitida entre lo dispensado y lo requerido por línea, en % (RF-33, D-67).'),
  ('yield_min_pt_pct', '97', 'Rendimiento mínimo de producto terminado por presentación, en % (Prompt 0B; RF-37).'),
  ('material_return_tolerance_units', '0', 'Diferencia admitida en la devolución de material de acondicionamiento, en unidades (D-48).');

-- ---------------------------------------------------------------------------
-- 2. Materiales de envase y acondicionamiento por presentación (lista de materiales)
-- ---------------------------------------------------------------------------
create table public.presentation_materials (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.product_presentations (id),
  material_id uuid not null references public.materials (id),
  stage text not null check (stage in ('envase', 'acondicionamiento')),
  qty_per_unit numeric(14, 4) not null check (qty_per_unit > 0),
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (presentation_id, material_id)
);
comment on table public.presentation_materials is
  'Materiales de envase y de acondicionamiento por unidad de cada presentación; base de las solicitudes SE y SA (RF-38, D-68).';
select app_private.register_catalog('public.presentation_materials');

-- ---------------------------------------------------------------------------
-- 3. Orden de producción, lote y órdenes de etapa
-- ---------------------------------------------------------------------------
create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  product_id uuid not null references public.products (id),
  formula_id uuid not null references public.formulas (id),
  batch_size numeric(14, 4) not null check (batch_size > 0),
  batch_unit text not null default 'kg',
  planned_date date not null,
  -- [{presentation_id, code, name, net_content, unit, bulk_qty, units}]
  presentations jsonb not null default '[]',
  -- [{kind, stage, code, title, version_no, version_id, template_id, instruction_id}]
  frozen_documents jsonb not null default '[]',
  document_warnings jsonb not null default '[]',
  regulatory_profile text not null,
  status text not null default 'borrador' check (status in ('borrador', 'aprobada', 'en_ejecucion', 'cerrada', 'anulada')),
  notes text,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  locked_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.production_orders is 'Orden de producción (RF-30): congela las versiones vigentes de sus documentos.';
select app_private.register_table('public.production_orders', p_signable => true, p_no_delete => true);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.production_orders (id),
  batch_code text not null unique,
  product_id uuid not null references public.products (id),
  batch_size numeric(14, 4) not null,
  batch_unit text not null,
  expiry_date date,
  status text not null default 'creado' check (status in ('creado', 'en_proceso', 'en_revision', 'liberado', 'rechazado')),
  frozen_formula_id uuid not null references public.formulas (id),
  frozen_documents jsonb not null default '[]',
  regulatory_profile_snapshot jsonb not null,
  manufacture_order_no text,
  packaging_order_no text,
  conditioning_order_no text,
  started_at timestamptz,
  completed_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.batches is 'Lote de producto (DI-8: versiones congeladas al crear la orden).';
select app_private.register_table('public.batches', p_no_delete => true);

create table public.stage_orders (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id),
  stage text not null check (stage in ('dispensacion', 'fabricacion', 'envase', 'acondicionamiento')),
  order_no int not null,
  code text not null unique,
  governing_version_id uuid references public.document_versions (id),
  template_id uuid references public.process_templates (id),
  instruction_id uuid references public.instructions (id),
  status text not null default 'pendiente' check (status in ('pendiente', 'en_curso', 'completada', 'bloqueada')),
  started_at timestamptz,
  started_by uuid references public.profiles (id),
  completed_at timestamptz,
  completed_by uuid references public.profiles (id),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (batch_id, stage)
);
comment on table public.stage_orders is
  'Órdenes de etapa del lote: dispensación (área de manufactura) y las tres órdenes de fabricación, envase y acondicionamiento (RF-38, D-69).';
select app_private.register_table('public.stage_orders', p_signable => true, p_no_delete => true);

-- ---------------------------------------------------------------------------
-- 4. Solicitudes de materiales, rótulos y orden de codificado (RF-38)
-- ---------------------------------------------------------------------------
create table public.material_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.production_orders (id),
  batch_id uuid not null references public.batches (id),
  type text not null check (type in ('dispensacion', 'envase', 'acondicionamiento')),
  code text not null unique,
  status text not null default 'generada' check (status in ('generada', 'atendida', 'cerrada')),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (order_id, type)
);
select app_private.register_table('public.material_requests', p_no_delete => true);

create table public.material_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.material_requests (id),
  order_no int not null,
  material_id uuid not null references public.materials (id),
  presentation_id uuid references public.product_presentations (id),
  pct numeric(9, 4),
  required_qty numeric(14, 4) not null check (required_qty > 0),
  unit text not null,
  label_text text not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (request_id, order_no)
);
comment on table public.material_request_lines is
  'Líneas de las solicitudes; cada una es también el rótulo de dispensación o alistamiento (RF-38 d).';
select app_private.register_table('public.material_request_lines', p_append_only => true);

create table public.coding_orders (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null unique references public.batches (id),
  code text not null unique,
  batch_code_text text not null,
  expiry_text text not null,
  extra_fields jsonb not null default '{}',
  status text not null default 'generada' check (status in ('generada', 'verificada')),
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
select app_private.register_table('public.coding_orders', p_signable => true, p_no_delete => true);

insert into public.signable_tables (table_name, label, kind, is_execution, author_column, group_column) values
  ('production_orders', 'Orden de producción', 'orden_produccion', false, 'created_by', null),
  ('stage_orders', 'Orden de etapa', 'orden_etapa', true, 'started_by', 'batch_id'),
  ('coding_orders', 'Orden de codificado', 'codificado', true, 'verified_by', 'batch_id');

-- ---------------------------------------------------------------------------
-- 5. Lectura (RLS)
-- ---------------------------------------------------------------------------
create or replace function public.can_read_production()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_permission('orden_de_produccion', 'read')
      or public.has_module_permission('dispensacion_fabricacion_envase_acond', 'read')
      or public.has_module_permission('solicitudes_y_documentos_de_la_op', 'read');
$$;
revoke execute on function public.can_read_production() from public, anon;
grant execute on function public.can_read_production() to authenticated;

alter table public.presentation_materials enable row level security;
alter table public.production_orders enable row level security;
alter table public.batches enable row level security;
alter table public.stage_orders enable row level security;
alter table public.material_requests enable row level security;
alter table public.material_request_lines enable row level security;
alter table public.coding_orders enable row level security;
create policy "production readers" on public.presentation_materials for select to authenticated
  using (public.can_read_production() or public.has_module_permission('maestro_de_materiales_y_productos', 'read'));
create policy "production readers" on public.production_orders for select to authenticated using (public.can_read_production());
create policy "production readers" on public.batches for select to authenticated using (public.can_read_production());
create policy "production readers" on public.stage_orders for select to authenticated using (public.can_read_production());
create policy "production readers" on public.material_requests for select to authenticated
  using (public.can_read_production() or public.has_module_permission('recepcion_inventario', 'read'));
create policy "production readers" on public.material_request_lines for select to authenticated
  using (public.can_read_production() or public.has_module_permission('recepcion_inventario', 'read'));
create policy "production readers" on public.coding_orders for select to authenticated using (public.can_read_production());
create policy "production readers read signatures" on public.signatures for select to authenticated
  using (record_table in ('production_orders', 'stage_orders', 'coding_orders') and public.can_read_production());

-- ---------------------------------------------------------------------------
-- 6. Funciones internas
-- ---------------------------------------------------------------------------
create or replace function app_private.require_production(p_module text, p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_module_permission(p_module, p_permission) then
    raise exception 'FORBIDDEN_ROLE: su rol no tiene el permiso «%» en «%» (matriz 2.2)', p_permission,
      coalesce((select name from public.permission_modules where code = p_module), p_module);
  end if;
end;
$$;
revoke execute on function app_private.require_production(text, text) from public, anon, authenticated;

-- Lote L-AAMM-NNN con consecutivo mensual (D-65); `year` guarda AAMM.
create or replace function app_private.next_batch_code(p_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq public.numbering_sequences;
  v_ym int := to_char(p_date, 'YYMM')::int;
  v_next int;
begin
  select * into v_seq from public.numbering_sequences where key = 'batch' for update;
  v_next := case when v_seq.year is distinct from v_ym then 1 else v_seq.last_value + 1 end;
  update public.numbering_sequences set last_value = v_next, year = v_ym where key = 'batch';
  return 'L-' || to_char(p_date, 'YYMM') || '-' || lpad(v_next::text, 3, '0');
end;
$$;
revoke execute on function app_private.next_batch_code(date) from public, anon, authenticated;

-- Documentos vigentes que rigen la orden (RF-30): fórmula, especificación de producto terminado, instructivo de
-- fabricación y la plantilla vigente de cada etapa con documento rector. Falla con NO_APPROVED_VERSION o
-- DOCUMENT_NOT_EFFECTIVE (AC-07, AC-19); las revisiones vencidas solo avisan (overdue_review_blocks_orders).
create or replace function app_private.order_documents(p_product uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_formula jsonb := public.assert_approved_formula(p_product);
  v_docs jsonb := '[]';
  v_ids uuid[] := '{}';
  v_row record;
  v_stage public.stage_definitions;
  v_doc public.controlled_documents;
  v_tpl uuid;
  v_check jsonb;
begin
  v_docs := v_docs || jsonb_build_object('kind', 'formula', 'stage', null, 'code', v_formula ->> 'code',
    'version_no', (v_formula ->> 'version_no')::int, 'version_id', v_formula ->> 'version_id', 'title', 'Fórmula maestra');
  v_ids := v_ids || (v_formula ->> 'version_id')::uuid;

  select s.id, dv.id as version_id, dv.version_no, d.code, d.title into v_row
  from public.specifications s join public.document_versions dv on dv.id = s.document_version_id
  join public.controlled_documents d on d.id = dv.document_id
  where s.product_id = p_product and s.scope = 'pt' and d.current_version_id = dv.id
  order by dv.version_no desc limit 1;
  if not found then
    raise exception 'NO_APPROVED_VERSION: el producto no tiene especificación de producto terminado vigente';
  end if;
  v_docs := v_docs || jsonb_build_object('kind', 'especificacion', 'stage', null, 'code', v_row.code,
    'version_no', v_row.version_no, 'version_id', v_row.version_id, 'title', v_row.title);
  v_ids := v_ids || v_row.version_id;

  select i.id, dv.id as version_id, dv.version_no, d.code, d.title into v_row
  from public.instructions i join public.document_versions dv on dv.id = i.document_version_id
  join public.controlled_documents d on d.id = dv.document_id
  where i.product_id = p_product and i.stage = 'fabricacion' and d.current_version_id = dv.id
  order by dv.version_no desc limit 1;
  if not found then
    raise exception 'NO_APPROVED_VERSION: el producto no tiene instructivo de fabricación vigente';
  end if;
  v_docs := v_docs || jsonb_build_object('kind', 'instructivo', 'stage', 'fabricacion', 'code', v_row.code,
    'version_no', v_row.version_no, 'version_id', v_row.version_id, 'title', v_row.title, 'instruction_id', v_row.id);
  v_ids := v_ids || v_row.version_id;

  -- Plantillas (formatos de registro) de las etapas con documento rector: la versión vigente del documento.
  for v_stage in select * from public.stage_definitions where active and governing_document_id is not null order by order_no loop
    select * into v_doc from public.controlled_documents where id = v_stage.governing_document_id;
    if v_doc.current_version_id is null then
      raise exception 'DOCUMENT_NOT_EFFECTIVE: % (%) no tiene versión vigente', v_doc.code, v_stage.name;
    end if;
    select t.id into v_tpl from public.process_templates t where t.document_version_id = v_doc.current_version_id;
    v_docs := v_docs || jsonb_build_object('kind', 'plantilla', 'stage', v_stage.code, 'code', v_doc.code,
      'version_no', (select version_no from public.document_versions where id = v_doc.current_version_id),
      'version_id', v_doc.current_version_id, 'title', v_doc.title, 'template_id', v_tpl);
    v_ids := v_ids || v_doc.current_version_id;
  end loop;

  v_check := public.assert_document_effective(v_ids);
  return jsonb_build_object('formula_id', v_formula ->> 'formula_id', 'formula_batch_size', v_formula -> 'batch_size',
    'documents', v_docs, 'warnings', v_check -> 'warnings');
end;
$$;
revoke execute on function app_private.order_documents(uuid) from public, anon, authenticated;

-- Genera, al aprobar, las órdenes de etapa, las solicitudes con sus líneas (rótulos) y la orden de codificado.
create or replace function app_private.generate_order_documents(p_order uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.production_orders;
  b public.batches;
  v_n text;
  v_req uuid;
  v_p jsonb;
  v_doc jsonb;
  v_stage text;
  v_i int := 0;
begin
  select * into o from public.production_orders where id = p_order;
  select * into b from public.batches where order_id = p_order;
  v_n := substring(o.code from 4);  -- AAAA-NNNN de la OP

  foreach v_stage in array array['dispensacion', 'fabricacion', 'envase', 'acondicionamiento'] loop
    v_i := v_i + 1;
    select d into v_doc from jsonb_array_elements(o.frozen_documents) d
    where d ->> 'kind' = 'plantilla' and d ->> 'stage' = v_stage limit 1;
    insert into public.stage_orders (batch_id, stage, order_no, code, governing_version_id, template_id, instruction_id)
    values (b.id, v_stage, v_i,
      case v_stage when 'dispensacion' then 'SD-' when 'fabricacion' then 'OF-' when 'envase' then 'OE-' else 'OA-' end || v_n,
      nullif(v_doc ->> 'version_id', '')::uuid, nullif(v_doc ->> 'template_id', '')::uuid,
      case when v_stage = 'fabricacion' then (select (d ->> 'instruction_id')::uuid from jsonb_array_elements(o.frozen_documents) d
        where d ->> 'kind' = 'instructivo' limit 1) end);
  end loop;
  update public.batches set manufacture_order_no = 'OF-' || v_n, packaging_order_no = 'OE-' || v_n,
    conditioning_order_no = 'OA-' || v_n where id = b.id;

  -- Solicitud de dispensación: % de la fórmula × tamaño del lote (AC-14).
  insert into public.material_requests (order_id, batch_id, type, code) values (o.id, b.id, 'dispensacion', 'SD-' || v_n)
  returning id into v_req;
  insert into public.material_request_lines (request_id, order_no, material_id, pct, required_qty, unit, label_text)
  select v_req, i.order_no, i.material_id, i.pct, round(i.pct * o.batch_size / 100, 2), o.batch_unit,
    m.name || ' · ' || to_char(round(i.pct * o.batch_size / 100, 2), 'FM999G999G990D00') || ' ' || o.batch_unit || ' · ' || o.code
  from public.formula_items i join public.materials m on m.id = i.material_id
  where i.formula_id = o.formula_id;

  -- Solicitudes de envase y de acondicionamiento: unidades planeadas × material por unidad de la presentación.
  foreach v_stage in array array['envase', 'acondicionamiento'] loop
    insert into public.material_requests (order_id, batch_id, type, code)
    values (o.id, b.id, v_stage, case v_stage when 'envase' then 'SE-' else 'SA-' end || v_n)
    returning id into v_req;
    insert into public.material_request_lines (request_id, order_no, material_id, presentation_id, required_qty, unit, label_text)
    select v_req, row_number() over (order by p.ord, m.code), pm.material_id, pm.presentation_id,
      round(pm.qty_per_unit * (p.v ->> 'units')::numeric, 0), m.unit,
      m.name || ' · ' || to_char(round(pm.qty_per_unit * (p.v ->> 'units')::numeric, 0), 'FM999G999G990') || ' ' || m.unit || ' · ' || o.code
    from jsonb_array_elements(o.presentations) with ordinality as p(v, ord)
    join public.presentation_materials pm on pm.presentation_id = (p.v ->> 'presentation_id')::uuid
      and pm.stage = v_stage and pm.active
    join public.materials m on m.id = pm.material_id;
  end loop;

  insert into public.coding_orders (batch_id, code, batch_code_text, expiry_text)
  values (b.id, 'CO-' || v_n, 'Lote ' || b.batch_code,
    'Vence ' || coalesce(to_char(b.expiry_date, 'MM/YYYY'), 'N.A.'));

  return jsonb_build_object(
    'stage_orders', (select count(*) from public.stage_orders where batch_id = b.id and stage <> 'dispensacion'),
    'requests', (select count(*) from public.material_requests where order_id = o.id),
    'labels', (select count(*) from public.material_request_lines l join public.material_requests r on r.id = l.request_id
               where r.order_id = o.id),
    'coding_orders', 1);
end;
$$;
revoke execute on function app_private.generate_order_documents(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC
-- ---------------------------------------------------------------------------
-- Crea la OP en borrador y su lote (S-15). p_presentations: [{presentation_id, bulk_qty, units}].
create or replace function public.create_production_order(
  p_product uuid, p_batch_size numeric, p_planned_date date, p_presentations jsonb, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prod public.products;
  v_docs jsonb;
  v_pres jsonb := '[]';
  v_p jsonb;
  v_row public.product_presentations;
  v_total numeric := 0;
  v_order public.production_orders;
  v_batch public.batches;
  v_profile public.regulatory_profile_kind;
begin
  perform app_private.require_production('orden_de_produccion', 'create');
  select * into v_prod from public.products where id = p_product and active;
  if not found then
    raise exception 'RECORD_NOT_FOUND: el producto no existe o está inactivo';
  end if;
  if p_batch_size is null or p_batch_size <= 0 then
    raise exception 'INVALID_FIELD: indique el tamaño del lote';
  end if;
  if p_planned_date is null then
    raise exception 'INVALID_FIELD: indique la fecha planeada';
  end if;
  v_docs := app_private.order_documents(p_product);

  if jsonb_typeof(p_presentations) <> 'array' or jsonb_array_length(p_presentations) = 0 then
    raise exception 'INVALID_FIELD: indique al menos una presentación a envasar';
  end if;
  for v_p in select * from jsonb_array_elements(p_presentations) loop
    select * into v_row from public.product_presentations
    where id = (v_p ->> 'presentation_id')::uuid and product_id = p_product and active;
    if not found then
      raise exception 'INVALID_FIELD: la presentación no pertenece al producto';
    end if;
    if coalesce((v_p ->> 'bulk_qty')::numeric, 0) <= 0 or coalesce((v_p ->> 'units')::numeric, 0) <= 0
       or (v_p ->> 'units')::numeric <> trunc((v_p ->> 'units')::numeric) then
      raise exception 'INVALID_FIELD: indique el granel y las unidades enteras de %', v_row.name;
    end if;
    v_total := v_total + (v_p ->> 'bulk_qty')::numeric;
    v_pres := v_pres || jsonb_build_object('presentation_id', v_row.id, 'code', v_row.code, 'name', v_row.name,
      'net_content', v_row.net_content, 'unit', v_row.unit, 'bulk_qty', (v_p ->> 'bulk_qty')::numeric,
      'units', (v_p ->> 'units')::int);
  end loop;
  if v_total > p_batch_size then
    raise exception 'INVALID_FIELD: el granel asignado a las presentaciones (%) supera el tamaño del lote (%)', v_total, p_batch_size;
  end if;

  select regulatory_profile into v_profile from public.product_lines where id = v_prod.line_id;
  perform set_config('app.audit_reason', 'Creación de la orden de producción', true);
  insert into public.production_orders (code, product_id, formula_id, batch_size, batch_unit, planned_date, presentations,
    frozen_documents, document_warnings, regulatory_profile, notes)
  values (public.next_number('production_order'), p_product, (v_docs ->> 'formula_id')::uuid, p_batch_size,
    coalesce((select batch_unit from public.formulas where id = (v_docs ->> 'formula_id')::uuid), 'kg'), p_planned_date, v_pres,
    v_docs -> 'documents', coalesce(v_docs -> 'warnings', '[]'), v_profile::text, nullif(trim(p_notes), ''))
  returning * into v_order;
  insert into public.batches (order_id, batch_code, product_id, batch_size, batch_unit, expiry_date, frozen_formula_id,
    frozen_documents, regulatory_profile_snapshot)
  values (v_order.id, app_private.next_batch_code(p_planned_date), p_product, p_batch_size, v_order.batch_unit,
    case when v_prod.shelf_life_months is not null
      then (date_trunc('month', p_planned_date) + make_interval(months => v_prod.shelf_life_months + 1) - interval '1 day')::date end,
    v_order.formula_id, v_order.frozen_documents, public.regulatory_profile_snapshot(v_profile))
  returning * into v_batch;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('order_id', v_order.id, 'code', v_order.code, 'batch_id', v_batch.id,
    'batch_code', v_batch.batch_code, 'warnings', v_order.document_warnings);
end;
$$;

-- Aprueba la OP con firma («Aprobé») y genera los documentos (RF-38, AC-14). Quien creó la orden no la aprueba.
create or replace function public.approve_production_order(p_order uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  o public.production_orders;
  v_res jsonb;
  v_gen jsonb;
begin
  perform app_private.require_production('solicitudes_y_documentos_de_la_op', 'approve');
  select * into o from public.production_orders where id = p_order for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la orden de producción';
  end if;
  if o.status <> 'borrador' then
    raise exception 'INVALID_TRANSITION: la orden % ya está %', o.code, o.status;
  end if;
  if o.created_by = v_uid then
    raise exception 'SOD_VIOLATION: quien creó la orden no puede aprobarla';
  end if;
  -- Las versiones congeladas deben seguir vigentes al aprobar (AC-19).
  perform public.assert_document_effective(array(select (d ->> 'version_id')::uuid from jsonb_array_elements(o.frozen_documents) d));
  perform public.check_sod(v_uid, 'production_orders', o.id, 'aprobo', to_jsonb(o));
  v_res := app_private.sign_simple('production_orders', o.id, 'aprobo', p_password, null,
    app_private.first_role(array['dt', 'aq_dir']));
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  perform set_config('app.audit_reason', 'Aprobación de la orden ' || o.code, true);
  update public.production_orders set status = 'aprobada', approved_by = v_uid, approved_at = now() where id = o.id;
  v_gen := app_private.generate_order_documents(o.id);
  update public.production_orders set locked_at = now() where id = o.id;
  perform set_config('app.audit_reason', '', true);
  return v_res || jsonb_build_object('generated', v_gen);
end;
$$;

revoke execute on function public.create_production_order(uuid, numeric, date, jsonb, text) from public, anon;
revoke execute on function public.approve_production_order(uuid, text) from public, anon;
grant execute on function public.create_production_order(uuid, numeric, date, jsonb, text) to authenticated;
grant execute on function public.approve_production_order(uuid, text) to authenticated;

-- Vista previa de las versiones que se congelarán (S-15), sin crear nada.
create or replace function public.preview_production_order(p_product uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_production('orden_de_produccion', 'create');
  return app_private.order_documents(p_product);
end;
$$;
revoke execute on function public.preview_production_order(uuid) from public, anon;
grant execute on function public.preview_production_order(uuid) to authenticated;
