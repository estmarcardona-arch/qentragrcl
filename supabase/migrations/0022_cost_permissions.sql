-- 0022_cost_permissions.sql · Etapa E4 (PRD F3) · PRD 1.8, decisión del responsable (24/10/2026; RF-17)
-- Los costos de las fórmulas son confidenciales: solo I+D (crea), Dirección técnica y Gerencia (leen). Nueva fila
-- «Costos de fórmula» de la matriz 2.2 (generada desde el PRD con scripts/gen-permission-matrix.ts); la fila
-- «Prototipos, estabilidad y costos» conserva su código y ya no da acceso a los costos.

insert into public.permission_modules (code, name, order_no) values
  ('costos_de_formula', 'Costos de fórmula (hoja de costos; confidencial)', 20);

-- Roles del sistema: celda del PRD (también como línea base, D-40).
insert into public.module_permissions (module_code, role, cell_text, can_read, can_create, can_sign, can_approve, prd_cell_text)
select 'costos_de_formula', v.role, v.cell, v.r, v.c, false, false, v.cell
from (values
  ('comercial', '—', false, false), ('idi', 'C', false, true), ('bodega_aux', '—', false, false),
  ('bodega_jefe', '—', false, false), ('prod_aux', '—', false, false), ('prod_coord', '—', false, false),
  ('lab_aux', '—', false, false), ('cc_jefe', '—', false, false), ('aq_dir', '—', false, false),
  ('dt', 'L', true, false), ('admin', '—', false, false), ('master', '—', false, false),
  ('aq_doc', '—', false, false), ('gerencia', 'L', true, false), ('auditor', '—', false, false)
) as v(role, cell, r, c);

-- Roles adicionales existentes: nacen sin permiso en el módulo nuevo (se configuran con aprobación, D-39).
insert into public.module_permissions (module_code, role, cell_text, can_read, can_create, can_sign, can_approve)
select 'costos_de_formula', r.code, '—', false, false, false, false
from public.roles r where not r.is_system;

create or replace function public.can_read_costs()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_permission('costos_de_formula', 'read');
$$;

-- La hoja de costos la elabora quien tiene «C» en Costos de fórmula (I+D).
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
  if not public.has_module_permission('costos_de_formula', 'create') then
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
