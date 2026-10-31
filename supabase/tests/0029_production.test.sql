-- E7 · Producción (PRD F6; RF-30…39): orden con documentos vigentes (AC-07, AC-19), aprobación que genera los
-- documentos (AC-14), despeje (AC-04), dispensación multi-lote (AC-03), equipos válidos (AC-05), capacitación (AC-25),
-- segregación de funciones, control de peso, rendimientos del 0B, inspección de 9 puntos, devolución y aviso de
-- correcciones (AC-35). Lote completo de punta a punta con datos de prueba propios.
begin;
select plan(55);

select pg_temp.test_user('paola@p.test', 'Paola Mejía', '{prod_coord}', p_id => 'b7000000-0000-4000-8000-000000000001');
select pg_temp.test_user('esteban@p.test', 'Dr. Esteban Gaviria', '{dt}', p_id => 'b7000000-0000-4000-8000-000000000002');
select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'b7000000-0000-4000-8000-000000000003');
select pg_temp.test_user('camila@p.test', 'Camila Ortega', '{comercial}', p_id => 'b7000000-0000-4000-8000-000000000004');
select pg_temp.test_user('mixto@p.test', 'Coordinador y director', '{prod_coord,dt}', p_id => 'b7000000-0000-4000-8000-000000000005');

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$ select current_setting('t.' || p_key)::uuid $$;
create or replace function pg_temp.set(p_key text, p_val text) returns void language sql as $$ select set_config('t.' || p_key, p_val, false) $$;
create or replace function pg_temp.stage(p_stage text) returns uuid language sql as $$
  select id from public.stage_orders where batch_id = pg_temp.v('batch') and stage = p_stage $$;
create or replace function pg_temp.line(p_code text) returns uuid language sql as $$
  select l.id from public.material_request_lines l join public.material_requests r on r.id = l.request_id
  join public.materials m on m.id = l.material_id where r.batch_id = pg_temp.v('batch') and m.code = p_code $$;
-- Prealistamiento completo de una etapa: despeje y limpieza ejecutados por Diego y verificados por Paola.
create or replace function pg_temp.prepare(p_stage text, p_equipment uuid) returns void language plpgsql as $$
begin
  perform pg_temp.login_as('b7000000-0000-4000-8000-000000000003');
  perform pg_temp.set('clr', public.execute_line_clearance(pg_temp.stage(p_stage),
    '[{"item": "Área libre", "ok": true}, {"item": "Equipos limpios", "ok": true}]', 'Clave-Prueba-2026') ->> 'clearance_id');
  perform pg_temp.set('cln', public.record_stage_cleaning(pg_temp.stage(p_stage), p_equipment,
    jsonb_build_object('label_verified', true, 'valid_until', public.reference_now() + interval '2 days',
      'utensils', '["Palas de acero"]'::jsonb), 'Clave-Prueba-2026') ->> 'cleaning_id');
  reset role;
  perform pg_temp.login_as('b7000000-0000-4000-8000-000000000001');
  perform public.verify_line_clearance(pg_temp.v('clr'), 'Clave-Prueba-2026');
  perform public.verify_stage_cleaning(pg_temp.v('cln'), 'Clave-Prueba-2026');
  reset role;
end;
$$;

insert into app_private.test_clock (now_override) values ('2026-10-05 08:00-05');
-- AC-25 se prueba con la regla de capacitación activa (D-19: por defecto solo avisa).
update public.app_settings set value = '"bloquear"' where key = 'training_enforcement';

-- ---------------------------------------------------------------------------
-- Datos maestros de prueba: producto, fórmula 97/3, especificación, instructivo, plantillas y equipos
-- ---------------------------------------------------------------------------
insert into public.products (id, code, name, line_id, shelf_life_months)
values ('f7000000-0000-4000-8000-000000000001', 'PRD-907', 'Loción de prueba E7', (select id from public.product_lines where code = 'COS'), 24),
       ('f7000000-0000-4000-8000-000000000002', 'PRD-908', 'Producto sin fórmula', (select id from public.product_lines where code = 'COS'), 24);
insert into public.product_presentations (id, product_id, code, name, net_content, unit)
values ('f7000000-0000-4000-8000-000000000011', 'f7000000-0000-4000-8000-000000000001', '200', '200 mL', 200, 'mL'),
       ('f7000000-0000-4000-8000-000000000012', 'f7000000-0000-4000-8000-000000000002', '200', '200 mL', 200, 'mL');
insert into public.materials (id, code, name, type, unit) values
  ('f7000000-0000-4000-8000-000000000101', 'MP-971', 'Agua de prueba', 'mp', 'kg'),
  ('f7000000-0000-4000-8000-000000000102', 'MP-972', 'Glicerina de prueba', 'mp', 'kg'),
  ('f7000000-0000-4000-8000-000000000103', 'EN-T971', 'Envase de prueba 200 mL', 'envase', 'und'),
  ('f7000000-0000-4000-8000-000000000104', 'EM-T971', 'Etiqueta de prueba 200 mL', 'empaque', 'und');
insert into public.presentation_materials (presentation_id, material_id, stage, qty_per_unit) values
  ('f7000000-0000-4000-8000-000000000011', 'f7000000-0000-4000-8000-000000000103', 'envase', 1),
  ('f7000000-0000-4000-8000-000000000011', 'f7000000-0000-4000-8000-000000000104', 'acondicionamiento', 1);

-- Documentos vigentes: fórmula (FM), especificación (EP), instructivo (IN) y formatos de despeje, fabricación y envase.
insert into public.controlled_documents (id, code, title, type_id, process_id, status)
select v.id, v.code, v.title, (select id from public.document_types where type_code = v.t),
  (select id from public.organizational_areas where code = v.area), 'vigente'
from (values
  ('f7000000-0000-4000-8000-000000000201'::uuid, 'IDI-FM-907', 'Fórmula maestra de prueba', 'FM', 'IDI'),
  ('f7000000-0000-4000-8000-000000000202', 'IDI-EP-907', 'Especificación de prueba', 'EP', 'IDI'),
  ('f7000000-0000-4000-8000-000000000203', 'IDI-IN-907', 'Instructivo de prueba', 'IN', 'IDI'),
  ('f7000000-0000-4000-8000-000000000204', 'PRD-PR-907-FR-01', 'Formato despeje de prueba', 'FR', 'PRD'),
  ('f7000000-0000-4000-8000-000000000205', 'PRD-PR-907-FR-02', 'Formato fabricación de prueba', 'FR', 'PRD'),
  ('f7000000-0000-4000-8000-000000000206', 'PRD-PR-907-FR-03', 'Formato envase de prueba', 'FR', 'PRD')
) as v(id, code, title, t, area);
insert into public.document_versions (id, document_id, version_no, status, author_id, locked_at)
select ('f7000000-0000-4000-8000-0000000003' || right(d.id::text, 2))::uuid, d.id, 1, 'vigente', 'b7000000-0000-4000-8000-000000000001', now()
from public.controlled_documents d where d.code like '%-907%';
update public.controlled_documents d set current_version_id = v.id from public.document_versions v
where v.document_id = d.id and d.code like '%-907%';

insert into public.formulas (id, document_version_id, product_id, batch_size)
values ('f7000000-0000-4000-8000-000000000401', 'f7000000-0000-4000-8000-000000000301', 'f7000000-0000-4000-8000-000000000001', 2000);
insert into public.formula_items (formula_id, material_id, pct, order_no) values
  ('f7000000-0000-4000-8000-000000000401', 'f7000000-0000-4000-8000-000000000101', 97, 1),
  ('f7000000-0000-4000-8000-000000000401', 'f7000000-0000-4000-8000-000000000102', 3, 2);
insert into public.specifications (document_version_id, scope, product_id)
values ('f7000000-0000-4000-8000-000000000302', 'pt', 'f7000000-0000-4000-8000-000000000001');
insert into public.instructions (id, document_version_id, product_id, stage)
values ('f7000000-0000-4000-8000-000000000403', 'f7000000-0000-4000-8000-000000000303', 'f7000000-0000-4000-8000-000000000001', 'fabricacion');
insert into public.instruction_steps (instruction_id, order_no, label, text, requires_equipment, requires_verification, params) values
  ('f7000000-0000-4000-8000-000000000403', 1, '1', 'Cargar agua', 'TQ-971', false, '[{"name": "Cantidad", "unit": "kg", "min": 1940, "max": 1940}]'),
  ('f7000000-0000-4000-8000-000000000403', 2, '2', 'Ajustar pH', null, true, '[{"name": "pH", "unit": "", "min": 5.0, "max": 6.0}]');
insert into public.process_templates (id, stage_id, document_version_id, status) values
  ('f7000000-0000-4000-8000-000000000501', (select id from public.stage_definitions where code = 'despeje'), 'f7000000-0000-4000-8000-000000000304', 'aprobada'),
  ('f7000000-0000-4000-8000-000000000502', (select id from public.stage_definitions where code = 'fabricacion'), 'f7000000-0000-4000-8000-000000000305', 'aprobada'),
  ('f7000000-0000-4000-8000-000000000503', (select id from public.stage_definitions where code = 'envase'), 'f7000000-0000-4000-8000-000000000306', 'aprobada');
insert into public.process_template_steps (template_id, order_no, label, text, params, requires_equipment, checklist_item) values
  ('f7000000-0000-4000-8000-000000000501', 1, '1', 'Área libre', '[]', null, true),
  ('f7000000-0000-4000-8000-000000000501', 2, '2', 'Equipos limpios', '[]', null, true),
  ('f7000000-0000-4000-8000-000000000503', 1, '1', 'Controlar el peso neto de 200 mL',
   '[{"name": "Peso neto", "unit": "g", "min": 197.0, "max": 203.0}]', 'LL-971', false);
update public.stage_definitions set governing_document_id = null;
update public.stage_definitions set governing_document_id = 'f7000000-0000-4000-8000-000000000204' where code = 'despeje';
update public.stage_definitions set governing_document_id = 'f7000000-0000-4000-8000-000000000205' where code = 'fabricacion';
update public.stage_definitions set governing_document_id = 'f7000000-0000-4000-8000-000000000206' where code = 'envase';

-- Equipos: tanque, llenadora y balanza válidos; otra balanza con la calibración vencida.
insert into public.equipment (id, code, name, equipment_type, plant_area, requires_qualification, requires_cleaning) values
  ('f7000000-0000-4000-8000-000000000601', 'TQ-971', 'Tanque de prueba', 'tanque', 'fabricacion', false, true),
  ('f7000000-0000-4000-8000-000000000602', 'LL-971', 'Llenadora de prueba', 'llenadora', 'envase', false, false),
  ('f7000000-0000-4000-8000-000000000603', 'BAL-971', 'Balanza de prueba', 'balanza', 'dispensacion', false, false),
  ('f7000000-0000-4000-8000-000000000604', 'BAL-972', 'Balanza vencida', 'balanza', 'dispensacion', false, false);
insert into public.equipment_events (equipment_id, type, performed_on, result, due_on, locked_at)
select id, e.t, '2026-01-10', 'conforme', e.due, now()
from public.equipment, (values ('calibracion', date '2027-01-10'), ('mantenimiento', date '2027-01-10')) as e(t, due)
where code in ('TQ-971', 'LL-971', 'BAL-971');
insert into public.equipment_events (equipment_id, type, performed_on, result, due_on, locked_at)
select id, e.t, '2025-10-01', 'conforme', e.due, now()
from public.equipment, (values ('calibracion', date '2026-10-01'), ('mantenimiento', date '2027-01-10')) as e(t, due)
where code = 'BAL-972';

-- Lotes de insumo: agua y dos de glicerina aprobados; uno de glicerina en cuarentena.
insert into public.material_lots (id, material_id, internal_code, supplier_lot, expiry_date, qty_received, unit, status) values
  ('f7000000-0000-4000-8000-000000000701', 'f7000000-0000-4000-8000-000000000101', 'MP-2099-0001', 'A-1', '2028-01-01', 2500, 'kg', 'aprobado'),
  ('f7000000-0000-4000-8000-000000000702', 'f7000000-0000-4000-8000-000000000102', 'MP-2099-0002', 'G-1', '2027-09-30', 40, 'kg', 'aprobado'),
  ('f7000000-0000-4000-8000-000000000703', 'f7000000-0000-4000-8000-000000000102', 'MP-2099-0003', 'G-2', '2027-12-31', 120, 'kg', 'aprobado'),
  ('f7000000-0000-4000-8000-000000000704', 'f7000000-0000-4000-8000-000000000102', 'MP-2099-0004', 'G-3', '2028-03-15', 50, 'kg', 'cuarentena');
insert into public.inventory_movements (lot_id, type, qty, to_location_id, reason)
select l.id, 'recepcion', l.qty_received, (select sl.id from public.storage_locations sl join public.warehouses w on w.id = sl.warehouse_id
  where w.code = 'BOD-MP' order by sl.code limit 1), 'Prueba'
from public.material_lots l where l.internal_code like 'MP-2099-%';

-- ---------------------------------------------------------------------------
-- Orden de producción (RF-30, AC-07, AC-19) y aprobación (RF-38, AC-14)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('b7000000-0000-4000-8000-000000000004');
select throws_like($$ select public.create_production_order('f7000000-0000-4000-8000-000000000001', 2000, '2026-10-05',
  '[{"presentation_id": "f7000000-0000-4000-8000-000000000011", "bulk_qty": 1000, "units": 5000}]') $$,
  '%FORBIDDEN_ROLE%', 'Comercial no crea órdenes de producción');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000001');
select throws_like($$ select public.create_production_order('f7000000-0000-4000-8000-000000000002', 2000, '2026-10-05',
  '[{"presentation_id": "f7000000-0000-4000-8000-000000000012", "bulk_qty": 1000, "units": 5000}]') $$,
  '%NO_APPROVED_VERSION%', 'AC-07: sin fórmula aprobada no hay orden');
reset role;
update public.controlled_documents set status = 'en_elaboracion' where code = 'PRD-PR-907-FR-03';
select pg_temp.login_as('b7000000-0000-4000-8000-000000000001');
select throws_like($$ select public.create_production_order('f7000000-0000-4000-8000-000000000001', 2000, '2026-10-05',
  '[{"presentation_id": "f7000000-0000-4000-8000-000000000011", "bulk_qty": 1000, "units": 5000}]') $$,
  '%DOCUMENT_NOT_EFFECTIVE%PRD-PR-907-FR-03%', 'AC-19: un formato no vigente impide la orden');
reset role;
update public.controlled_documents set status = 'vigente' where code = 'PRD-PR-907-FR-03';
select pg_temp.login_as('b7000000-0000-4000-8000-000000000001');
select throws_like($$ select public.create_production_order('f7000000-0000-4000-8000-000000000001', 2000, '2026-10-05',
  '[{"presentation_id": "f7000000-0000-4000-8000-000000000011", "bulk_qty": 2500, "units": 5000}]') $$,
  '%INVALID_FIELD%supera el tamaño del lote%', 'el granel de las presentaciones no supera el lote');
select pg_temp.set('ord', public.create_production_order('f7000000-0000-4000-8000-000000000001', 2000, '2026-10-05',
  '[{"presentation_id": "f7000000-0000-4000-8000-000000000011", "bulk_qty": 2000, "units": 10000}]') ->> 'order_id');
reset role;
select pg_temp.set('batch', (select id::text from public.batches where order_id = pg_temp.v('ord')));
select matches((select code from public.production_orders where id = pg_temp.v('ord')), '^OP-2026-[0-9]{4}$', 'D-11: número OP-AAAA-NNNN');
select matches((select batch_code || ' · ' || to_char(expiry_date, 'MM/YYYY') from public.batches where id = pg_temp.v('batch')),
  '^L-2610-[0-9]{3} · 10/2028$', 'lote L-AAMM-NNN y vencimiento por vida útil (10/2028)');
select is((select jsonb_array_length(frozen_documents) from public.production_orders where id = pg_temp.v('ord')), 6,
  'RF-30: la orden congela fórmula, especificación, instructivo y tres formatos');

select pg_temp.login_as('b7000000-0000-4000-8000-000000000001');
select throws_like($$ select public.approve_production_order(pg_temp.v('ord'), 'Clave-Prueba-2026') $$, '%FORBIDDEN_ROLE%',
  'D-12: la coordinadora no aprueba la orden');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000005');
select pg_temp.set('ord2', public.create_production_order('f7000000-0000-4000-8000-000000000001', 1000, '2026-10-06',
  '[{"presentation_id": "f7000000-0000-4000-8000-000000000011", "bulk_qty": 1000, "units": 5000}]') ->> 'order_id');
select throws_like($$ select public.approve_production_order(pg_temp.v('ord2'), 'Clave-Prueba-2026') $$, '%SOD_VIOLATION%',
  'quien creó la orden no la aprueba');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000002');
select is((public.approve_production_order(pg_temp.v('ord'), 'Clave-Prueba-2026') -> 'generated' ->> 'stage_orders'), '3',
  'AC-14: al aprobar se generan las tres órdenes de etapa');
reset role;
select is((select string_agg(left(code, 2), ',' order by code) from public.material_requests where order_id = pg_temp.v('ord')),
  'SA,SD,SE', 'AC-14: solicitudes de dispensación, envase y acondicionamiento');
select is((select required_qty from public.material_request_lines where id = pg_temp.line('MP-972')), 60.00::numeric,
  'AC-14: glicerina = 3 % × 2.000 kg = 60,00 kg');
select is((select count(*)::int from public.coding_orders where batch_id = pg_temp.v('batch')), 1, 'AC-14: una orden de codificado');
select is((select required_qty from public.material_request_lines where id = pg_temp.line('EM-T971')), 10000::numeric,
  'la etiqueta se pide por unidades planeadas');

-- ---------------------------------------------------------------------------
-- Despeje, limpieza e inicio (RF-32, RF-39, AC-04, AC-25)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('b7000000-0000-4000-8000-000000000003');
select throws_like($$ select public.start_stage(pg_temp.stage('dispensacion')) $$, '%CLEARANCE_MISSING%',
  'AC-04: la etapa no inicia sin despeje');
select throws_like($$ select public.execute_line_clearance(pg_temp.stage('dispensacion'),
    '[{"item": "Área libre", "ok": true}, {"item": "Equipos limpios", "ok": true}]', 'Clave-Prueba-2026') $$,
  '%TRAINING_REQUIRED%PRD-PR-907-FR-01%', 'AC-25: sin la capacitación del formato no se ejecuta');
reset role;
insert into public.document_trainings (id, version_id, trainer_id)
select gen_random_uuid(), v.id, 'b7000000-0000-4000-8000-000000000001' from public.document_versions v
join public.controlled_documents d on d.id = v.document_id where d.code like 'PRD-PR-907-%';
insert into public.training_attempts (training_id, user_id, attempt_no, score, passed, certificate_code)
select t.id, 'b7000000-0000-4000-8000-000000000003', 1, 100, true, 'CT-2099-' || left(t.id::text, 8) from public.document_trainings t
join public.document_versions v on v.id = t.version_id join public.controlled_documents d on d.id = v.document_id
where d.code like 'PRD-PR-907-%';
select pg_temp.login_as('b7000000-0000-4000-8000-000000000003');
select throws_like($$ select public.execute_line_clearance(pg_temp.stage('dispensacion'),
    '[{"item": "Área libre", "ok": true}, {"item": "Equipos limpios", "ok": false}]', 'Clave-Prueba-2026') $$,
  '%INVALID_FIELD%no está conforme%', 'un punto no conforme impide firmar el despeje');
select pg_temp.set('clr', public.execute_line_clearance(pg_temp.stage('dispensacion'),
  '[{"item": "Área libre", "ok": true}, {"item": "Equipos limpios", "ok": true}]', 'Clave-Prueba-2026') ->> 'clearance_id');
select throws_like($$ select public.verify_line_clearance(pg_temp.v('clr'), 'Clave-Prueba-2026') $$, '%SOD_VIOLATION%',
  'SOD-1: quien ejecutó el despeje no lo verifica');
select pg_temp.set('cln', public.record_stage_cleaning(pg_temp.stage('dispensacion'), null,
  jsonb_build_object('label_verified', true, 'valid_until', '2026-10-07 18:00-05', 'utensils', '["Recipientes de acero"]'::jsonb),
  'Clave-Prueba-2026') ->> 'cleaning_id');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.verify_line_clearance(pg_temp.v('clr'), 'Clave-Prueba-2026') $$, 'Paola verifica el despeje');
select lives_ok($$ select public.verify_stage_cleaning(pg_temp.v('cln'), 'Clave-Prueba-2026') $$, 'Paola verifica la limpieza');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000003');
select is(public.start_stage(pg_temp.stage('dispensacion')) ->> 'status', 'en_curso', 'con despeje y limpieza verificados la etapa inicia');

-- ---------------------------------------------------------------------------
-- Dispensación multi-lote (RF-33, AC-03, AC-05, SOD-4)
-- ---------------------------------------------------------------------------
select throws_like($$ select public.dispense_lot(pg_temp.line('MP-972'), 'f7000000-0000-4000-8000-000000000704', 20,
  'f7000000-0000-4000-8000-000000000603', 0.5, 'Clave-Prueba-2026') $$, '%LOT_NOT_APPROVED%', 'AC-03: un lote en cuarentena no se dispensa');
select throws_like($$ select public.dispense_lot(pg_temp.line('MP-972'), 'f7000000-0000-4000-8000-000000000702', 40,
  'f7000000-0000-4000-8000-000000000604', 0.5, 'Clave-Prueba-2026') $$, '%EQUIPMENT_NOT_VALID%BAL-972%',
  'AC-05: una balanza con la calibración vencida no se usa');
select is((public.dispense_lot(pg_temp.line('MP-972'), 'f7000000-0000-4000-8000-000000000702', 40,
  'f7000000-0000-4000-8000-000000000603', 0.5, 'Clave-Prueba-2026') ->> 'dispensed')::numeric, 40::numeric, 'glicerina: 40,00 kg del primer lote');
select throws_like($$ select public.dispense_lot(pg_temp.line('MP-972'), 'f7000000-0000-4000-8000-000000000703', 30,
  'f7000000-0000-4000-8000-000000000603', 0.5, 'Clave-Prueba-2026') $$, '%INVALID_FIELD%supera lo requerido%',
  'la suma no supera lo requerido');
select is((public.dispense_lot(pg_temp.line('MP-972'), 'f7000000-0000-4000-8000-000000000703', 20,
  'f7000000-0000-4000-8000-000000000603', 0.5, 'Clave-Prueba-2026') ->> 'dispensed')::numeric, 60::numeric,
  'RF-33: una línea admite varios lotes (40 + 20 = 60,00 kg)');
select lives_ok($$ select public.dispense_lot(pg_temp.line('MP-971'), 'f7000000-0000-4000-8000-000000000701', 1940,
  'f7000000-0000-4000-8000-000000000603', 1, 'Clave-Prueba-2026') $$, 'agua 1.940,00 kg');
select is((select qty_on_hand from public.v_lot_stock where id = 'f7000000-0000-4000-8000-000000000702'), 0::numeric,
  'el inventario se descuenta de la ubicación');
select throws_like($$ select public.verify_dispensing((select id from public.dispensing_line_lots where qty = 40
  and stage_order_id = pg_temp.stage('dispensacion')), 'Clave-Prueba-2026') $$, '%SOD_VIOLATION%SOD-4%',
  'SOD-4: quien dispensó no verifica');
select throws_like($$ select public.complete_stage(pg_temp.stage('dispensacion'), 'Clave-Prueba-2026') $$,
  '%INVALID_TRANSITION%falta para cerrar%', 'sin verificar la dispensación no se cierra');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.verify_dispensing(id, 'Clave-Prueba-2026') from public.dispensing_line_lots
  where stage_order_id = pg_temp.stage('dispensacion') $$, 'Paola verifica las tres pesadas');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000003');
select is(public.complete_stage(pg_temp.stage('dispensacion'), 'Clave-Prueba-2026') ->> 'status', 'completada', 'dispensación completada');
reset role;

-- ---------------------------------------------------------------------------
-- Fabricación paso a paso (RF-34, AC-05) y granel (RF-37)
-- ---------------------------------------------------------------------------
select pg_temp.prepare('fabricacion', 'f7000000-0000-4000-8000-000000000601');
select pg_temp.set('s1', (select step_key from app_private.stage_steps(pg_temp.stage('fabricacion')) where order_no = 1));
select pg_temp.set('s2', (select step_key from app_private.stage_steps(pg_temp.stage('fabricacion')) where order_no = 2));
select pg_temp.set('s3', (select step_key from app_private.stage_steps(pg_temp.stage('envase')) limit 1));
select pg_temp.login_as('b7000000-0000-4000-8000-000000000003');
select public.start_stage(pg_temp.stage('fabricacion'));
select throws_like($$ select public.complete_step(pg_temp.stage('fabricacion'), current_setting('t.s2'), null, '{"pH": 5.5}', '{}', null,
  'Clave-Prueba-2026') $$, '%INVALID_TRANSITION%primero%', 'los pasos se registran en orden');
select throws_like($$ select public.complete_step(pg_temp.stage('fabricacion'), current_setting('t.s1'), null, '{"Cantidad": 1940}', '{}', null,
  'Clave-Prueba-2026') $$, '%INVALID_FIELD%TQ-971%', 'el paso exige su equipo');
select is((public.complete_step(pg_temp.stage('fabricacion'), current_setting('t.s1'), null, '{"Cantidad": 1940}',
  array['f7000000-0000-4000-8000-000000000601'::uuid], null, 'Clave-Prueba-2026') ->> 'out_of_range'), 'false',
  'RF-34: paso con equipo válido y valor en rango');
select is((public.complete_step(pg_temp.stage('fabricacion'), current_setting('t.s2'), null, '{"pH": 5.6}', '{}', null,
  'Clave-Prueba-2026') ->> 'ok'), 'true', 'el paso con verificación queda pendiente de la segunda persona');
select is((public.record_stage_output(pg_temp.stage('fabricacion'), null, '{"actual": 2004, "remnant": 4}', 'Clave-Prueba-2026') ->> 'pct'),
  '100.2', 'RF-37: granel 2.004,0 kg = 100,2 % del teórico');
select throws_like($$ select public.complete_stage(pg_temp.stage('fabricacion'), 'Clave-Prueba-2026') $$, '%INVALID_TRANSITION%Ajustar pH%',
  'sin la verificación del paso no se cierra la fabricación');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.verify_step((select id from public.step_records where stage_order_id = pg_temp.stage('fabricacion')
  and requires_verification), 'Clave-Prueba-2026') $$, 'Paola verifica el paso');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000003');
select public.complete_stage(pg_temp.stage('fabricacion'), 'Clave-Prueba-2026');
reset role;
select is((select qty || ' ' || unit || ' · ' || label_code from public.bulk_transfers where batch_id = pg_temp.v('batch') and from_stage = 'fabricacion'),
  '2004.0000 kg · GR-' || (select batch_code from public.batches where id = pg_temp.v('batch')), 'el granel pasa a envase con su rótulo');
select ok(exists (select 1 from public.equipment_events where type = 'uso' and equipment_id = 'f7000000-0000-4000-8000-000000000601'),
  'el uso del tanque queda en su hoja de vida');

-- ---------------------------------------------------------------------------
-- Envase: control de peso cada 30 min (RF-35) y rendimiento 98,2 %
-- ---------------------------------------------------------------------------
select pg_temp.prepare('envase', null::uuid);
select pg_temp.login_as('b7000000-0000-4000-8000-000000000003');
select public.start_stage(pg_temp.stage('envase'));
select throws_like($$ select public.record_weight_control(pg_temp.stage('envase'), 'f7000000-0000-4000-8000-000000000011', 203.6, null,
  'Clave-Prueba-2026') $$, '%INVALID_FIELD%fuera del rango 197.0–203.0%', 'RF-35: fuera de rango exige la acción tomada');
select is((public.record_weight_control(pg_temp.stage('envase'), 'f7000000-0000-4000-8000-000000000011', 203.6,
  'Ajuste de la boquilla 2', 'Clave-Prueba-2026') ->> 'in_range'), 'false', 'el control fuera de rango queda con su acción');
select pg_temp.set('wc', (select id::text from public.weight_controls where stage_order_id = pg_temp.stage('envase') and sample_no = 1));
select public.record_weight_control(pg_temp.stage('envase'), 'f7000000-0000-4000-8000-000000000011', 199.8, null, 'Clave-Prueba-2026');
select public.complete_step(pg_temp.stage('envase'), current_setting('t.s3'),
  'f7000000-0000-4000-8000-000000000011', '{"Peso neto": 200.1}', array['f7000000-0000-4000-8000-000000000602'::uuid], null, 'Clave-Prueba-2026');
select is((public.record_stage_output(pg_temp.stage('envase'), 'f7000000-0000-4000-8000-000000000011', '{"actual": 9820}',
  'Clave-Prueba-2026') ->> 'pct'), '98.2', 'rendimiento de envase 98,2 % (0B)');
select is(public.complete_stage(pg_temp.stage('envase'), 'Clave-Prueba-2026') ->> 'status', 'completada', 'envase completado');

-- AC-35: la sexta corrección de un registro avisa al verificador.
select public.record_correction('weight_controls', pg_temp.v('wc'), 'action', to_jsonb('Ajuste ' || n), 'Precisión ' || n)
from generate_series(1, 6) n;
reset role;
select is((select count(*)::int from public.notifications where user_id = 'b7000000-0000-4000-8000-000000000001' and kind = 'correcciones'),
  1, 'AC-35: con 6 correcciones se avisa al verificador');

-- ---------------------------------------------------------------------------
-- Acondicionamiento: codificado, inspección de 9 puntos, rendimiento PT 97,5 % y devolución (RF-36)
-- ---------------------------------------------------------------------------
select pg_temp.prepare('acondicionamiento', null::uuid);
select pg_temp.login_as('b7000000-0000-4000-8000-000000000003');
select public.start_stage(pg_temp.stage('acondicionamiento'));
select public.verify_coding(pg_temp.v('batch'), 'Clave-Prueba-2026');
select throws_like($$ select public.record_pt_inspection(pg_temp.stage('acondicionamiento'), 'f7000000-0000-4000-8000-000000000011',
  '[]', 'Clave-Prueba-2026') $$, '%FORBIDDEN_ROLE%', 'D-47: la inspección la firma el coordinador o el supervisor');
select is((public.record_stage_output(pg_temp.stage('acondicionamiento'), 'f7000000-0000-4000-8000-000000000011',
  '{"received": 9820, "rejected": 50, "retained": 20}', 'Clave-Prueba-2026') ->> 'pct'), '97.5',
  'rendimiento PT = (9.820 − 50 − 20) / 10.000 = 97,5 %, dentro del mínimo de 97 %');
select throws_like($$ select public.record_material_return(pg_temp.line('EM-T971'), '{"used": 9870, "damaged": 30, "returned": 50}',
  'Clave-Prueba-2026') $$, '%INVALID_FIELD%no cuadra%', 'D-48: la devolución debe cuadrar');
select lives_ok($$ select public.record_material_return(pg_temp.line('EM-T971'), '{"used": 9870, "damaged": 30, "returned": 100}',
  'Clave-Prueba-2026') $$, 'devolución: 9.870 + 30 + 100 = 10.000');
select throws_like($$ select public.complete_stage(pg_temp.stage('acondicionamiento'), 'Clave-Prueba-2026') $$,
  '%INVALID_TRANSITION%inspección de producto terminado%', 'sin la inspección de 9 puntos no se completa');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000001');
select throws_like($$ select public.record_pt_inspection(pg_temp.stage('acondicionamiento'), 'f7000000-0000-4000-8000-000000000011',
  '[{"n": 1, "result": "conforme"}]', 'Clave-Prueba-2026') $$, '%INVALID_FIELD%9 puntos%', 'los 9 puntos deben tener resultado');
select is((public.record_pt_inspection(pg_temp.stage('acondicionamiento'), 'f7000000-0000-4000-8000-000000000011',
  (select jsonb_agg(jsonb_build_object('n', n, 'result', 'conforme')) from generate_series(1, 9) n), 'Clave-Prueba-2026') ->> 'result'),
  'conforme', 'Paola firma la inspección de producto terminado');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000003');
select public.complete_stage(pg_temp.stage('acondicionamiento'), 'Clave-Prueba-2026');
reset role;
select is((select b.status || ' · ' || o.status from public.batches b join public.production_orders o on o.id = b.order_id
  where b.id = pg_temp.v('batch')), 'en_revision · cerrada', 'el lote termina en revisión y la orden se cierra');
select throws_like($$ update public.step_records set notes = 'x' where stage_order_id = pg_temp.stage('fabricacion') $$,
  '%RECORD_LOCKED%', 'DI-3: los registros firmados no se modifican');

delete from app_private.test_clock;
select * from finish();
rollback;
