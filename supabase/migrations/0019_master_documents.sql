-- 0019_master_documents.sql · Etapa E4 (PRD F3)
-- Fórmula cualicuantitativa (RF-11), especificaciones (RF-12), instructivos por etapa y presentación
-- (RF-13) y hoja de costos (RF-17). El contenido vive aquí; código, versión, estado y firmas viven en
-- document_versions (SGD, PRD 6.3): se crean, revisan, aprueban y publican con el flujo de la etapa E3.
-- Al enviar a estandarización se valida el contenido (suma 100 %, límites, pasos); al aprobar, la
-- fórmula exige un prototipo aprobado con estabilidad conforme (AC-13) y el contenido queda bloqueado.

-- Tipo documental para la fórmula maestra (PRD 2.5.8 la nombra, 2.5.1 no le da sigla): supuesto D-49.
insert into public.document_types (type_code, name, level, is_subdocument, requires_scope, validity_rule, review_period_months,
  stamp_required, default_route_id, requires_training, requires_assessment)
values ('FM', 'Fórmula maestra', 4, false, false, 'registro_sanitario', 36, true,
  (select id from public.approval_routes where code = 'tecnica'), true, false);

-- ---------------------------------------------------------------------------
-- 1. Contenido de los documentos maestros
-- ---------------------------------------------------------------------------
create table public.formulas (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null unique references public.document_versions (id),
  product_id uuid not null references public.products (id),
  prototype_id uuid references public.formula_prototypes (id),
  batch_size numeric(14, 4) not null check (batch_size > 0),
  batch_unit text not null default 'kg',
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.formula_items (
  id uuid primary key default gen_random_uuid(),
  formula_id uuid not null references public.formulas (id),
  material_id uuid not null references public.materials (id),
  pct numeric(9, 4) not null check (pct > 0 and pct <= 100),
  phase text,
  function text,
  order_no int not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (formula_id, order_no)
);

create table public.specifications (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null unique references public.document_versions (id),
  scope text not null check (scope in ('mp', 'envase', 'granel', 'pt')),
  product_id uuid references public.products (id),
  material_id uuid references public.materials (id),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check ((scope in ('mp', 'envase') and material_id is not null) or (scope in ('granel', 'pt') and product_id is not null))
);

create table public.spec_parameters (
  id uuid primary key default gen_random_uuid(),
  specification_id uuid not null references public.specifications (id),
  order_no int not null,
  name text not null check (length(trim(name)) > 0),
  method text not null default '',
  min_value numeric(14, 4),
  max_value numeric(14, 4),
  unit text,
  text_limit text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (specification_id, order_no),
  check (min_value is null or max_value is null or min_value <= max_value)
);

create table public.instructions (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null unique references public.document_versions (id),
  product_id uuid not null references public.products (id),
  stage text not null check (stage in ('fabricacion', 'envase', 'acondicionamiento')),
  presentation_id uuid references public.product_presentations (id),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.instruction_steps (
  id uuid primary key default gen_random_uuid(),
  instruction_id uuid not null references public.instructions (id),
  order_no int not null,
  label text not null,
  text text not null check (length(trim(text)) > 0),
  requires_equipment text,
  requires_verification boolean not null default false,
  params jsonb not null default '[]',
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (instruction_id, order_no)
);

-- Hoja de costos de una fórmula (o de un prototipo).
create table public.cost_sheets (
  id uuid primary key default gen_random_uuid(),
  formula_id uuid references public.formulas (id),
  prototype_id uuid references public.formula_prototypes (id),
  batch_size numeric(14, 4) not null check (batch_size > 0),
  density numeric(8, 4) not null default 1 check (density > 0),
  industrial_lot_units jsonb not null default '{}',
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (formula_id is not null or prototype_id is not null)
);

comment on column public.cost_sheets.industrial_lot_units is 'Unidades del lote industrial por presentación {"<presentation_id>": 5000}.';

create table public.cost_sheet_lines (
  id uuid primary key default gen_random_uuid(),
  cost_sheet_id uuid not null references public.cost_sheets (id),
  kind text not null check (kind in ('ingrediente', 'envase', 'tapa', 'etiqueta', 'plegadiza', 'caja', 'otro')),
  material_id uuid references public.materials (id),
  presentation_id uuid references public.product_presentations (id),
  description text not null,
  unit_cost numeric(14, 2) not null check (unit_cost >= 0),
  qty numeric(14, 4) not null check (qty >= 0),
  unit text not null,
  line_cost numeric(16, 2) generated always as (round(unit_cost * qty, 2)) stored,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (kind = 'ingrediente' or presentation_id is not null)
);

comment on table public.cost_sheet_lines is
  'Ingredientes: qty = kg por lote y unit_cost = $/kg. Envase, tapa, etiqueta, plegadiza y caja: por unidad de presentación.';

alter table public.formulas enable row level security;
alter table public.formula_items enable row level security;
alter table public.specifications enable row level security;
alter table public.spec_parameters enable row level security;
alter table public.instructions enable row level security;
alter table public.instruction_steps enable row level security;
alter table public.cost_sheets enable row level security;
alter table public.cost_sheet_lines enable row level security;
select app_private.register_table('public.formulas', p_signable => true, p_no_delete => true);
select app_private.register_table('public.formula_items');
select app_private.register_table('public.specifications', p_signable => true, p_no_delete => true);
select app_private.register_table('public.spec_parameters');
select app_private.register_table('public.instructions', p_signable => true, p_no_delete => true);
select app_private.register_table('public.instruction_steps');
select app_private.register_table('public.cost_sheets', p_no_delete => true);
select app_private.register_table('public.cost_sheet_lines');

-- Las líneas de un contenido aprobado (bloqueado) no cambian.
create or replace function app_private.protect_master_children()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent uuid := coalesce(case when tg_op = 'DELETE' then null else (to_jsonb(new) ->> tg_argv[1])::uuid end,
                            (to_jsonb(old) ->> tg_argv[1])::uuid);
  v_locked timestamptz;
begin
  execute format('select locked_at from public.%I where id = $1', tg_argv[0]) into v_locked using v_parent;
  if v_locked is not null then
    raise exception 'RECORD_LOCKED: el documento está aprobado; cree una versión nueva en borrador';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger formula_items_protect before insert or update or delete on public.formula_items
  for each row execute function app_private.protect_master_children('formulas', 'formula_id');
create trigger spec_parameters_protect before insert or update or delete on public.spec_parameters
  for each row execute function app_private.protect_master_children('specifications', 'specification_id');
create trigger instruction_steps_protect before insert or update or delete on public.instruction_steps
  for each row execute function app_private.protect_master_children('instructions', 'instruction_id');

create or replace function public.can_read_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_permission('formula_especificacion_instructivo', 'read') or public.can_read_documents();
$$;

create or replace function public.can_read_costs()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_permission('prototipos_estabilidad_y_costos', 'read');
$$;

revoke execute on function public.can_read_master() from public, anon;
revoke execute on function public.can_read_costs() from public, anon;
grant execute on function public.can_read_master() to authenticated;
grant execute on function public.can_read_costs() to authenticated;

create policy "master readers" on public.formulas for select to authenticated using (public.can_read_master());
create policy "master readers" on public.formula_items for select to authenticated using (public.can_read_master());
create policy "master readers" on public.specifications for select to authenticated using (public.can_read_master());
create policy "master readers" on public.spec_parameters for select to authenticated using (public.can_read_master());
create policy "master readers" on public.instructions for select to authenticated using (public.can_read_master());
create policy "master readers" on public.instruction_steps for select to authenticated using (public.can_read_master());
-- RF-17 / AC-09: los costos solo los leen los roles autorizados; nunca la página pública (anon).
create policy "cost readers" on public.cost_sheets for select to authenticated using (public.can_read_costs());
create policy "cost readers" on public.cost_sheet_lines for select to authenticated using (public.can_read_costs());

revoke all on table public.formulas, public.formula_items, public.specifications, public.spec_parameters,
  public.instructions, public.instruction_steps, public.cost_sheets, public.cost_sheet_lines from anon;
revoke insert, update, delete, truncate on table public.formulas, public.formula_items, public.specifications,
  public.spec_parameters, public.instructions, public.instruction_steps, public.cost_sheets, public.cost_sheet_lines
  from authenticated;

-- Totales de la hoja de costos (RF-17): granel, $/kg, producto terminado por presentación y lote industrial.
create or replace view public.v_cost_sheet_totals
with (security_invoker = true)
as
with bulk as (
  select cs.id, cs.batch_size, cs.density, cs.industrial_lot_units,
         coalesce(sum(l.line_cost) filter (where l.kind = 'ingrediente'), 0) as bulk_cost
  from public.cost_sheets cs left join public.cost_sheet_lines l on l.cost_sheet_id = cs.id
  group by cs.id
), pres as (
  select b.id as cost_sheet_id, p.id as presentation_id, p.code, p.name, p.net_content, p.unit,
         round(b.bulk_cost / b.batch_size * p.net_content / 1000 * b.density, 2) as bulk_per_unit,
         coalesce((select sum(l.line_cost) from public.cost_sheet_lines l
                   where l.cost_sheet_id = b.id and l.presentation_id = p.id and l.kind <> 'ingrediente'), 0) as packaging_per_unit,
         coalesce((b.industrial_lot_units ->> p.id::text)::numeric, 0) as units
  from bulk b
  join public.cost_sheet_lines l0 on l0.cost_sheet_id = b.id and l0.presentation_id is not null
  join public.product_presentations p on p.id = l0.presentation_id
  group by b.id, b.bulk_cost, b.batch_size, b.density, b.industrial_lot_units, p.id
)
select b.id as cost_sheet_id, b.bulk_cost, round(b.bulk_cost / b.batch_size, 2) as bulk_cost_per_unit,
  coalesce(jsonb_agg(jsonb_build_object('presentation_id', pr.presentation_id, 'code', pr.code, 'name', pr.name,
    'bulk', round(pr.bulk_per_unit), 'packaging', pr.packaging_per_unit,
    'finished', round(pr.bulk_per_unit) + pr.packaging_per_unit, 'units', pr.units,
    'lot_cost', (round(pr.bulk_per_unit) + pr.packaging_per_unit) * pr.units) order by pr.net_content)
    filter (where pr.presentation_id is not null), '[]') as presentations,
  coalesce(sum((round(pr.bulk_per_unit) + pr.packaging_per_unit) * pr.units), 0) as industrial_lot_cost
from bulk b left join pres pr on pr.cost_sheet_id = b.id
group by b.id, b.bulk_cost, b.batch_size;

comment on view public.v_cost_sheet_totals is
  'Totales de costos (RF-17). El granel por unidad = $/kg × contenido neto × densidad, redondeado al peso (Prompt 0B).';

revoke all on public.v_cost_sheet_totals from anon;
grant select on public.v_cost_sheet_totals to authenticated;
-- Las vistas del SGD tampoco se exponen al rol anónimo.
revoke all on public.v_master_list, public.v_documents_overdue_by_process from anon;

-- ---------------------------------------------------------------------------
-- 2. Edición del contenido (versión en borrador del autor; SOD-10)
-- ---------------------------------------------------------------------------
create or replace function app_private.require_editable_master(p_version uuid)
returns public.document_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.document_versions;
begin
  if not public.has_module_permission('formula_especificacion_instructivo', 'create') then
    raise exception 'FORBIDDEN_ROLE: los documentos maestros los elaboran I+D, el usuario master o Aseguramiento de la calidad';
  end if;
  select * into v from public.document_versions where id = p_version for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la versión del documento';
  end if;
  if v.status not in ('solicitado', 'preliminar') or v.locked_at is not null then
    raise exception 'RECORD_LOCKED: la versión no es un borrador; cree una versión nueva en borrador';
  end if;
  if v.author_id <> auth.uid() then
    raise exception 'FORBIDDEN_ROLE: solo el autor de la versión edita su contenido';
  end if;
  update public.document_versions set status = 'preliminar' where id = p_version;
  return v;
end;
$$;

revoke execute on function app_private.require_editable_master(uuid) from public, anon, authenticated;

-- p_items: [{material_id, pct, phase, function}]; con p_prototype y sin ítems copia los del prototipo aprobado.
create or replace function public.save_formula_draft(p_version uuid, p_product uuid, p_batch_size numeric, p_items jsonb,
  p_prototype uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.document_versions := app_private.require_editable_master(p_version);
  v_f public.formulas;
  v_it jsonb;
  v_i int := 0;
  v_items jsonb := p_items;
begin
  if not exists (select 1 from public.products where id = p_product and active) then
    raise exception 'INVALID_FIELD: indique un producto activo';
  end if;
  if p_prototype is not null and not exists (select 1 from public.formula_prototypes where id = p_prototype) then
    raise exception 'RECORD_NOT_FOUND: no existe el prototipo';
  end if;
  if coalesce(jsonb_array_length(v_items), 0) = 0 and p_prototype is not null then
    select jsonb_agg(jsonb_build_object('material_id', material_id, 'pct', pct, 'phase', phase, 'function', function) order by order_no)
    into v_items from public.prototype_items where prototype_id = p_prototype;
  end if;
  select * into v_f from public.formulas where document_version_id = p_version;
  if not found then
    insert into public.formulas (document_version_id, product_id, prototype_id, batch_size)
    values (p_version, p_product, p_prototype, p_batch_size) returning * into v_f;
  else
    update public.formulas set product_id = p_product, prototype_id = coalesce(p_prototype, prototype_id), batch_size = p_batch_size
    where id = v_f.id;
  end if;
  delete from public.formula_items where formula_id = v_f.id;
  for v_it in select * from jsonb_array_elements(coalesce(v_items, '[]')) loop
    v_i := v_i + 1;
    if not exists (select 1 from public.materials where id = (v_it ->> 'material_id')::uuid and type = 'mp' and active) then
      raise exception 'INVALID_FIELD: la línea % no es una materia prima activa', v_i;
    end if;
    insert into public.formula_items (formula_id, material_id, pct, phase, function, order_no)
    values (v_f.id, (v_it ->> 'material_id')::uuid, (v_it ->> 'pct')::numeric, nullif(v_it ->> 'phase', ''), nullif(v_it ->> 'function', ''), v_i);
  end loop;
  return jsonb_build_object('formula_id', v_f.id, 'items', v_i,
    'sum', (select coalesce(sum(pct), 0) from public.formula_items where formula_id = v_f.id));
end;
$$;

-- p_params: [{name, method, min_value, max_value, unit, text_limit}]
create or replace function public.save_specification_draft(p_version uuid, p_scope text, p_product uuid, p_material uuid, p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.document_versions := app_private.require_editable_master(p_version);
  v_s public.specifications;
  v_p jsonb;
  v_i int := 0;
begin
  if p_scope not in ('mp', 'envase', 'granel', 'pt') then
    raise exception 'INVALID_FIELD: la especificación es de materia prima, envase, granel o producto terminado';
  end if;
  select * into v_s from public.specifications where document_version_id = p_version;
  if not found then
    insert into public.specifications (document_version_id, scope, product_id, material_id)
    values (p_version, p_scope, case when p_scope in ('granel', 'pt') then p_product end,
            case when p_scope in ('mp', 'envase') then p_material end)
    returning * into v_s;
  else
    update public.specifications set scope = p_scope, product_id = case when p_scope in ('granel', 'pt') then p_product end,
      material_id = case when p_scope in ('mp', 'envase') then p_material end
    where id = v_s.id;
  end if;
  delete from public.spec_parameters where specification_id = v_s.id;
  for v_p in select * from jsonb_array_elements(coalesce(p_params, '[]')) loop
    v_i := v_i + 1;
    insert into public.spec_parameters (specification_id, order_no, name, method, min_value, max_value, unit, text_limit)
    values (v_s.id, v_i, trim(v_p ->> 'name'), coalesce(trim(v_p ->> 'method'), ''), (v_p ->> 'min_value')::numeric,
            (v_p ->> 'max_value')::numeric, nullif(trim(v_p ->> 'unit'), ''), nullif(trim(v_p ->> 'text_limit'), ''));
  end loop;
  return jsonb_build_object('specification_id', v_s.id, 'parameters', v_i);
end;
$$;

-- p_steps: [{label, text, requires_equipment, requires_verification, params: [{name, unit, min, max, frequency}]}]
create or replace function public.save_instruction_draft(p_version uuid, p_product uuid, p_stage text, p_presentation uuid, p_steps jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.document_versions := app_private.require_editable_master(p_version);
  v_in public.instructions;
  v_st jsonb;
  v_i int := 0;
begin
  if p_stage not in ('fabricacion', 'envase', 'acondicionamiento') then
    raise exception 'INVALID_FIELD: la etapa es fabricación, envase o acondicionamiento';
  end if;
  if p_presentation is not null and not exists (
    select 1 from public.product_presentations where id = p_presentation and product_id = p_product) then
    raise exception 'INVALID_FIELD: la presentación no es del producto';
  end if;
  select * into v_in from public.instructions where document_version_id = p_version;
  if not found then
    insert into public.instructions (document_version_id, product_id, stage, presentation_id)
    values (p_version, p_product, p_stage, p_presentation) returning * into v_in;
  else
    update public.instructions set product_id = p_product, stage = p_stage, presentation_id = p_presentation where id = v_in.id;
  end if;
  delete from public.instruction_steps where instruction_id = v_in.id;
  for v_st in select * from jsonb_array_elements(coalesce(p_steps, '[]')) loop
    v_i := v_i + 1;
    insert into public.instruction_steps (instruction_id, order_no, label, text, requires_equipment, requires_verification, params)
    values (v_in.id, v_i, coalesce(nullif(trim(v_st ->> 'label'), ''), v_i::text), trim(v_st ->> 'text'),
            nullif(trim(v_st ->> 'requires_equipment'), ''), coalesce((v_st ->> 'requires_verification')::boolean, false),
            coalesce(v_st -> 'params', '[]'));
  end loop;
  return jsonb_build_object('instruction_id', v_in.id, 'steps', v_i);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Validación al enviar, controles al aprobar y bloqueo (RF-11…RF-14; AC-13)
-- ---------------------------------------------------------------------------
create or replace function app_private.validate_master_content(p_version uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_f public.formulas;
  v_sum numeric;
  v_s public.specifications;
  v_bad text;
  v_in public.instructions;
begin
  select * into v_f from public.formulas where document_version_id = p_version;
  if found then
    select coalesce(sum(pct), 0) into v_sum from public.formula_items where formula_id = v_f.id;
    if abs(v_sum - 100) > 0.001 then
      raise exception 'INVALID_FIELD: la suma de la fórmula es % %%; debe ser 100,00 %% para enviarla a revisión (RF-11)',
        replace(to_char(v_sum, 'FM990.00'), '.', ',');
    end if;
  end if;
  select * into v_s from public.specifications where document_version_id = p_version;
  if found then
    if not exists (select 1 from public.spec_parameters where specification_id = v_s.id) then
      raise exception 'INVALID_FIELD: la especificación no tiene parámetros';
    end if;
    select string_agg(name, ', ') into v_bad from public.spec_parameters
    where specification_id = v_s.id and (length(trim(method)) = 0 or (min_value is null and max_value is null and text_limit is null));
    if v_bad is not null then
      raise exception 'INVALID_FIELD: cada parámetro necesita método y límites (RF-12): revise %', v_bad;
    end if;
  end if;
  select * into v_in from public.instructions where document_version_id = p_version;
  if found and not exists (select 1 from public.instruction_steps where instruction_id = v_in.id) then
    raise exception 'INVALID_FIELD: el instructivo no tiene pasos';
  end if;
end;
$$;

create or replace function app_private.approve_master_checks(p_version uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_f public.formulas;
  v_p public.formula_prototypes;
begin
  select * into v_f from public.formulas where document_version_id = p_version;
  if not found then
    return;
  end if;
  if v_f.prototype_id is null then
    raise exception 'STABILITY_MISSING: la fórmula no está ligada a un prototipo con estudio de estabilidad';
  end if;
  select * into v_p from public.formula_prototypes where id = v_f.prototype_id;
  perform app_private.require_min_prototypes(v_p.brief_id);
  perform app_private.require_conforming_study(v_p.id);
  if v_p.status <> 'aprobado' then
    raise exception 'INVALID_TRANSITION: el prototipo % no está aprobado como fórmula por Gerencia y Dirección técnica', v_p.code;
  end if;
end;
$$;

create or replace function app_private.lock_master_content(p_version uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.formulas set locked_at = now() where document_version_id = p_version and locked_at is null;
  update public.specifications set locked_at = now() where document_version_id = p_version and locked_at is null;
  update public.instructions set locked_at = now() where document_version_id = p_version and locked_at is null;
end;
$$;

revoke execute on function app_private.validate_master_content(uuid) from public, anon, authenticated;
revoke execute on function app_private.approve_master_checks(uuid) from public, anon, authenticated;
revoke execute on function app_private.lock_master_content(uuid) from public, anon, authenticated;

-- Ganchos del SGD: validación del contenido al enviar y controles de la fórmula al aprobar.
create or replace function public.submit_for_standardization(p_version uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.document_versions := app_private.lock_version(p_version);
begin
  if v.author_id <> auth.uid() then
    raise exception 'FORBIDDEN_ROLE: solo el autor envía el preliminar a estandarización';
  end if;
  if v.status <> 'preliminar' then
    raise exception 'INVALID_TRANSITION: la versión está %; solo un preliminar se envía a estandarización', v.status;
  end if;
  if v.version_no > 1 and length(trim(v.change_description)) = 0 then
    raise exception 'INVALID_FIELD: describa el cambio (control de cambios) antes de enviar';
  end if;
  -- Contenido de un documento maestro (fórmula, especificación, instructivo): se valida al enviar.
  perform app_private.validate_master_content(p_version);
  update public.document_versions set status = 'en_estandarizacion' where id = p_version;
  update public.document_requests set status = 'en_curso' where id = v.request_id and status = 'abierta';
  update public.document_change_requests set status = 'en_elaboracion' where id = v.change_request_id and status = 'abierta';
end;
$$;

create or replace function public.approve_document(p_version uuid, p_password text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v public.document_versions := app_private.lock_version(p_version);
  v_doc public.controlled_documents;
  v_route public.approval_routes;
  v_step public.approval_route_steps;
  v_as text;
  v_res jsonb;
begin
  if v.status <> 'en_aprobacion' or v.locked_at is not null then
    raise exception 'INVALID_TRANSITION: la versión % no está pendiente de aprobación', app_private.version_label(v);
  end if;
  if not exists (select 1 from public.signatures where record_table = 'document_versions' and record_id = p_version and meaning = 'reviso') then
    raise exception 'ROUTE_INCOMPLETE: falta la firma de revisión';
  end if;
  select * into v_doc from public.controlled_documents where id = v.document_id;
  select * into v_route from public.approval_routes where id = v_doc.route_id;
  select * into v_step from public.approval_route_steps where route_id = v_route.id and step = 'aprobacion';
  select r into v_as from unnest(v_step.roles) r where public.has_role(r) limit 1;
  if v_as is null then
    raise exception 'FORBIDDEN_ROLE: aprueba % (%)', array_to_string(v_step.roles, ' o '), v_route.name;
  end if;
  perform public.check_sod(v_uid, 'document_versions', p_version, 'aprobo', to_jsonb(v));
  -- Fórmula: solo con prototipo aprobado y estabilidad conforme (AC-13).
  perform app_private.approve_master_checks(p_version);
  if not v_route.allow_reviewer_as_approver and exists (
    select 1 from public.signatures where record_table = 'document_versions' and record_id = p_version
      and meaning = 'reviso' and user_id = v_uid) then
    raise exception 'SOD_VIOLATION: en esta ruta quien revisa no aprueba';
  end if;
  v_res := app_private.sign_document_version(p_version, 'aprobo', p_password, p_reason, v_as);
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  -- SOD-10: la versión aprobada queda bloqueada, y también su plantilla de proceso.
  update public.document_versions set locked_at = now() where id = p_version;
  update public.process_templates set locked_at = now(), status = 'aprobada' where document_version_id = p_version;
  perform app_private.lock_master_content(p_version);
  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Fórmula aprobada de un producto (AC-07, parte aplicable; la usará la OP en E7)
-- ---------------------------------------------------------------------------
create or replace function public.assert_approved_formula(p_product uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select f.id as formula_id, dv.id as version_id, dv.version_no, d.code, f.batch_size into v_row
  from public.formulas f
  join public.document_versions dv on dv.id = f.document_version_id
  join public.controlled_documents d on d.id = dv.document_id
  where f.product_id = p_product and dv.status = 'vigente' and d.status = 'vigente'
  order by dv.version_no desc limit 1;
  if not found then
    raise exception 'NO_APPROVED_VERSION: el producto no tiene una fórmula aprobada y vigente';
  end if;
  return to_jsonb(v_row);
end;
$$;

-- Cantidades por lote: % de la fórmula × tamaño de lote (RF-38).
create or replace function public.formula_quantities(p_formula uuid, p_batch_size numeric default null)
returns table (material_id uuid, code text, name text, pct numeric, qty numeric, unit text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.code, m.name, i.pct, round(i.pct * coalesce(p_batch_size, f.batch_size) / 100, 4), f.batch_unit
  from public.formulas f join public.formula_items i on i.formula_id = f.id join public.materials m on m.id = i.material_id
  where f.id = p_formula and public.can_read_master()
  order by i.order_no;
$$;

-- ---------------------------------------------------------------------------
-- 5. Hoja de costos (RF-17)
-- ---------------------------------------------------------------------------
-- p_ingredient_costs: {"<material_id>": 6800}; p_packaging: [{presentation_id, kind, description, unit_cost, qty, unit}];
-- p_units: {"<presentation_id>": 5000}
create or replace function public.save_cost_sheet(p_formula uuid, p_prototype uuid, p_batch_size numeric, p_density numeric,
  p_ingredient_costs jsonb, p_packaging jsonb, p_units jsonb, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cs public.cost_sheets;
  v_it record;
  v_p jsonb;
  v_batch numeric := p_batch_size;
  v_exists boolean;
begin
  if not public.has_module_permission('prototipos_estabilidad_y_costos', 'create') then
    raise exception 'FORBIDDEN_ROLE: la hoja de costos la elabora I+D';
  end if;
  if (p_formula is null) = (p_prototype is null) then
    raise exception 'INVALID_FIELD: la hoja de costos es de una fórmula o de un prototipo';
  end if;
  if v_batch is null and p_formula is not null then
    select batch_size into v_batch from public.formulas where id = p_formula;
  end if;
  if v_batch is null or v_batch <= 0 then
    raise exception 'INVALID_FIELD: indique el tamaño de lote';
  end if;
  select * into v_cs from public.cost_sheets
  where (p_formula is not null and formula_id = p_formula) or (p_prototype is not null and prototype_id = p_prototype);
  v_exists := found;
  if v_exists then
    perform app_private.require_reason(p_reason);
  end if;
  perform set_config('app.audit_reason', coalesce(trim(p_reason), ''), true);
  if not v_exists then
    insert into public.cost_sheets (formula_id, prototype_id, batch_size, density, industrial_lot_units)
    values (p_formula, p_prototype, v_batch, coalesce(p_density, 1), coalesce(p_units, '{}')) returning * into v_cs;
  else
    update public.cost_sheets set batch_size = v_batch, density = coalesce(p_density, density),
      industrial_lot_units = coalesce(p_units, industrial_lot_units), version = version + 1
    where id = v_cs.id;
  end if;
  delete from public.cost_sheet_lines where cost_sheet_id = v_cs.id;
  for v_it in
    select i.material_id, m.name, i.pct from public.formula_items i join public.materials m on m.id = i.material_id
    where p_formula is not null and i.formula_id = p_formula
    union all
    select i.material_id, m.name, i.pct from public.prototype_items i join public.materials m on m.id = i.material_id
    where p_prototype is not null and i.prototype_id = p_prototype
  loop
    insert into public.cost_sheet_lines (cost_sheet_id, kind, material_id, description, unit_cost, qty, unit)
    values (v_cs.id, 'ingrediente', v_it.material_id, v_it.name, coalesce((p_ingredient_costs ->> v_it.material_id::text)::numeric, 0),
            round(v_it.pct * v_batch / 100, 4), 'kg');
  end loop;
  for v_p in select * from jsonb_array_elements(coalesce(p_packaging, '[]')) loop
    insert into public.cost_sheet_lines (cost_sheet_id, kind, presentation_id, description, unit_cost, qty, unit)
    values (v_cs.id, v_p ->> 'kind', (v_p ->> 'presentation_id')::uuid, coalesce(v_p ->> 'description', v_p ->> 'kind'),
            (v_p ->> 'unit_cost')::numeric, coalesce((v_p ->> 'qty')::numeric, 1), coalesce(v_p ->> 'unit', 'und'));
  end loop;
  perform set_config('app.audit_reason', '', true);
  return v_cs.id;
end;
$$;

revoke execute on function public.save_formula_draft(uuid, uuid, numeric, jsonb, uuid) from public, anon;
revoke execute on function public.save_specification_draft(uuid, text, uuid, uuid, jsonb) from public, anon;
revoke execute on function public.save_instruction_draft(uuid, uuid, text, uuid, jsonb) from public, anon;
revoke execute on function public.assert_approved_formula(uuid) from public, anon;
revoke execute on function public.formula_quantities(uuid, numeric) from public, anon;
revoke execute on function public.save_cost_sheet(uuid, uuid, numeric, numeric, jsonb, jsonb, jsonb, text) from public, anon;
grant execute on function public.save_formula_draft(uuid, uuid, numeric, jsonb, uuid) to authenticated;
grant execute on function public.save_specification_draft(uuid, text, uuid, uuid, jsonb) to authenticated;
grant execute on function public.save_instruction_draft(uuid, uuid, text, uuid, jsonb) to authenticated;
grant execute on function public.assert_approved_formula(uuid) to authenticated;
grant execute on function public.formula_quantities(uuid, numeric) to authenticated;
grant execute on function public.save_cost_sheet(uuid, uuid, numeric, numeric, jsonb, jsonb, jsonb, text) to authenticated;
