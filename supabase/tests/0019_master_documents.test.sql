-- E4 · Documentos maestros sobre el SGD: fórmula (RF-11, RF-14), especificación (RF-12), instructivo (RF-13),
-- costos (RF-17, AC-09), aprobación de la fórmula solo con estabilidad conforme (AC-13) y AC-07 (parte aplicable).
begin;
select plan(28);

select pg_temp.test_user('sebastian@p.test', 'Sebastián Rojas', '{idi}', p_id => 'b3000000-0000-4000-8000-000000000003');
select pg_temp.test_user('valentina@p.test', 'Valentina Cruz', '{aq_doc}', p_id => 'b3000000-0000-4000-8000-000000000007');
select pg_temp.test_user('lucia@p.test', 'Lucía Barrera', '{aq_dir}', p_id => 'b3000000-0000-4000-8000-000000000008');
select pg_temp.test_user('esteban@p.test', 'Dr. Esteban Gaviria', '{dt}', p_id => 'b3000000-0000-4000-8000-000000000002');
select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'b3000000-0000-4000-8000-000000000009');
select pg_temp.test_user('camila@p.test', 'Camila Ortega', '{comercial}', p_id => 'b3000000-0000-4000-8000-000000000001');

insert into public.products (id, code, name, line_id, sanitary_registration_expires)
values ('f3000000-0000-4000-8000-000000000001', 'PRD-902', 'Loción de prueba 2', (select id from public.product_lines where code = 'COS'), '2030-09-30');
insert into public.product_presentations (id, product_id, code, name, net_content, unit) values
  ('f3000000-0000-4000-8000-000000000011', 'f3000000-0000-4000-8000-000000000001', '200', '200 mL', 200, 'mL'),
  ('f3000000-0000-4000-8000-000000000012', 'f3000000-0000-4000-8000-000000000001', '400', '400 mL', 400, 'mL');
insert into public.materials (id, code, name, type) values
  ('f3000000-0000-4000-8000-000000000101', 'MP-911', 'Agua purificada de prueba', 'mp'),
  ('f3000000-0000-4000-8000-000000000102', 'MP-912', 'Glicerina de prueba', 'mp');

-- Prototipos de partida: P-A aprobado con estudio conforme; P-B seleccionado sin aprobación; P-C sin estudio.
insert into public.briefs (id, code, product_id, project_name, project_type, product_category, status, created_by)
values ('f3000000-0000-4000-8000-000000000201', 'BR-2099-0001', 'f3000000-0000-4000-8000-000000000001', 'Brief de prueba',
        'nuevo_portafolio', 'cosmetico', 'aprobado', 'b3000000-0000-4000-8000-000000000001');
insert into public.formula_prototypes (id, brief_id, code, status, created_by) values
  ('f3000000-0000-4000-8000-000000000301', 'f3000000-0000-4000-8000-000000000201', 'P-9901', 'aprobado', 'b3000000-0000-4000-8000-000000000003'),
  ('f3000000-0000-4000-8000-000000000302', 'f3000000-0000-4000-8000-000000000201', 'P-9902', 'seleccionado', 'b3000000-0000-4000-8000-000000000003');
insert into public.prototype_items (prototype_id, material_id, pct, order_no) values
  ('f3000000-0000-4000-8000-000000000301', 'f3000000-0000-4000-8000-000000000101', 97, 1),
  ('f3000000-0000-4000-8000-000000000301', 'f3000000-0000-4000-8000-000000000102', 3, 2);
insert into public.controlled_documents (id, code, title, type_id, process_id, status)
values ('f3000000-0000-4000-8000-000000000401', 'CC-PC-902', 'Protocolo de prueba', (select id from public.document_types where type_code = 'PC'),
        (select id from public.organizational_areas where code = 'CC'), 'vigente');
insert into public.document_versions (id, document_id, version_no, status, author_id, locked_at)
values ('f3000000-0000-4000-8000-000000000402', 'f3000000-0000-4000-8000-000000000401', 1, 'vigente', 'b3000000-0000-4000-8000-000000000007', now());
insert into public.stability_studies (prototype_id, protocol_document_version_id, start_date, end_date, status, result)
select id, 'f3000000-0000-4000-8000-000000000402', now() - interval '31 days', now() - interval '1 day', 'completo', 'cumple'
from public.formula_prototypes where code in ('P-9901', 'P-9902');

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$ select current_setting('t.' || p_key)::uuid $$;

-- Lleva una versión preliminar del autor por el SGD hasta «en aprobación» (estandarización, código, revisión).
create or replace function pg_temp.to_approval(p_version uuid, p_author uuid, p_title text)
returns void
language plpgsql
as $$
begin
  perform pg_temp.login_as(p_author);
  perform public.save_document_draft(p_version, jsonb_build_object('objetivo', 'Establecer la fórmula de prueba.',
    'responsables', 'I+D.', 'desarrollo', '1. Pesar los ingredientes.', 'documentos_relacionados', 'N.A.', 'control_cambios', 'Creación.'));
  perform public.submit_for_standardization(p_version);
  reset role;
  perform pg_temp.login_as('b3000000-0000-4000-8000-000000000007');
  perform public.run_style_check(p_version);
  perform public.request_document_code(p_version, p_title, null, '2030-09-30');
  reset role;
  perform pg_temp.login_as(p_author);
  perform public.submit_for_review(p_version, 'Clave-Prueba-2026');
  reset role;
  perform pg_temp.login_as('b3000000-0000-4000-8000-000000000008');
  perform public.review_document(p_version, 'Clave-Prueba-2026');
  reset role;
end;
$$;

select ok(exists (select 1 from public.document_types where type_code = 'FM' and validity_rule = 'registro_sanitario'),
  'D-49: la fórmula maestra es un tipo documental con vigencia del registro sanitario');

-- =====================================================================
-- Fórmula (RF-11): suma 100 % para enviar; aprobación solo con prototipo aprobado (AC-13)
-- =====================================================================
select pg_temp.login_as('b3000000-0000-4000-8000-000000000003');
select set_config('t.f1', (public.request_document('creacion', null, (select id from public.organizational_areas where code = 'IDI'),
  (select id from public.document_types where type_code = 'FM'), null, 'Fórmula maestra de prueba', 'Fórmula del prototipo aprobado', '{}') ->> 'version_id'), false);
select is((public.save_formula_draft(pg_temp.v('f1'), 'f3000000-0000-4000-8000-000000000001', 2000,
    '[{"material_id": "f3000000-0000-4000-8000-000000000101", "pct": 96.95}, {"material_id": "f3000000-0000-4000-8000-000000000102", "pct": 3}]',
    'f3000000-0000-4000-8000-000000000301') ->> 'sum')::numeric, 99.95, 'la suma se calcula en vivo (99,95 %)');
select public.save_document_draft(pg_temp.v('f1'), '{"objetivo": "Establecer la fórmula.", "responsables": "I+D.", "desarrollo": "1. Pesar.", "documentos_relacionados": "N.A.", "control_cambios": "Creación."}');
select throws_like($$ select public.submit_for_standardization(pg_temp.v('f1')) $$, '%INVALID_FIELD%99,95%100,00%',
  'RF-11: no se envía a revisión si la suma no es 100 %');
select is((public.save_formula_draft(pg_temp.v('f1'), 'f3000000-0000-4000-8000-000000000001', 2000, null,
    'f3000000-0000-4000-8000-000000000301') ->> 'items')::int, 2, 'sin líneas, la fórmula toma las del prototipo aprobado');
select is((select sum(pct) from public.formula_items i join public.formulas f on f.id = i.formula_id where f.document_version_id = pg_temp.v('f1')),
  100.0000::numeric, 'suma 100,00 %');
select is((select qty from public.formula_quantities((select id from public.formulas where document_version_id = pg_temp.v('f1')))
           where code = 'MP-912'), 60.0000::numeric, 'cantidad = % × tamaño de lote (3 % de 2.000 kg = 60 kg)');
reset role;
select pg_temp.login_as('b3000000-0000-4000-8000-000000000009');
select throws_like($$ select public.save_formula_draft(pg_temp.v('f1'), 'f3000000-0000-4000-8000-000000000001', 2000, '[]') $$,
  '%FORBIDDEN_ROLE%', 'producción no edita fórmulas');
reset role;
select pg_temp.to_approval(pg_temp.v('f1'), 'b3000000-0000-4000-8000-000000000003', 'Fórmula maestra de prueba');
select is((select status from public.document_versions where id = pg_temp.v('f1')), 'en_aprobacion', 'la fórmula recorre el SGD hasta aprobación');
select pg_temp.login_as('b3000000-0000-4000-8000-000000000003');
select throws_like($$ select public.approve_document(pg_temp.v('f1'), 'Clave-Prueba-2026') $$, '%FORBIDDEN_ROLE%', 'quien formuló no aprueba');
reset role;
select pg_temp.login_as('b3000000-0000-4000-8000-000000000002');
select is(public.approve_document(pg_temp.v('f1'), 'Clave-Prueba-2026') ->> 'ok', 'true', 'RF-14: Dirección técnica aprueba la fórmula del prototipo aprobado');
reset role;
select ok((select locked_at is not null from public.formulas where document_version_id = pg_temp.v('f1')), 'la fórmula aprobada queda bloqueada');
select throws_like($$ update public.formula_items set pct = 50 where formula_id = (select id from public.formulas where document_version_id = pg_temp.v('f1')) $$,
  '%RECORD_LOCKED%', 'RF-14: una versión aprobada es inmutable');
select pg_temp.login_as('b3000000-0000-4000-8000-000000000003');
select throws_like($$ select public.save_formula_draft(pg_temp.v('f1'), 'f3000000-0000-4000-8000-000000000001', 1000, null) $$,
  '%RECORD_LOCKED%', 'AC-20: no se edita una versión aprobada; se crea una nueva');
select throws_like($$ select public.assert_approved_formula('f3000000-0000-4000-8000-000000000001') $$, '%NO_APPROVED_VERSION%',
  'AC-07: sin fórmula vigente no hay versión aprobada para una OP');
reset role;
select pg_temp.login_as('b3000000-0000-4000-8000-000000000007');
select public.publish_document(pg_temp.v('f1'), '{}');
select is((public.assert_approved_formula('f3000000-0000-4000-8000-000000000001') ->> 'batch_size')::numeric, 2000.0000::numeric,
  'publicada, la fórmula queda disponible para la OP');
select is((select review_due_date from public.document_versions where id = pg_temp.v('f1')), '2030-09-30'::date,
  'AC-34: la fórmula vence con el registro sanitario');
reset role;

-- Fórmula ligada a un prototipo seleccionado pero no aprobado, y sin prototipo (AC-13).
select pg_temp.login_as('b3000000-0000-4000-8000-000000000003');
select set_config('t.f2', (public.request_document('creacion', null, (select id from public.organizational_areas where code = 'IDI'),
  (select id from public.document_types where type_code = 'FM'), null, 'Fórmula maestra B', 'Prototipo sin aprobar', '{}') ->> 'version_id'), false);
select public.save_formula_draft(pg_temp.v('f2'), 'f3000000-0000-4000-8000-000000000001', 1000,
  '[{"material_id": "f3000000-0000-4000-8000-000000000101", "pct": 100}]', 'f3000000-0000-4000-8000-000000000302');
select set_config('t.f3', (public.request_document('creacion', null, (select id from public.organizational_areas where code = 'IDI'),
  (select id from public.document_types where type_code = 'FM'), null, 'Fórmula maestra C', 'Sin prototipo', '{}') ->> 'version_id'), false);
select public.save_formula_draft(pg_temp.v('f3'), 'f3000000-0000-4000-8000-000000000001', 1000,
  '[{"material_id": "f3000000-0000-4000-8000-000000000101", "pct": 100}]');
reset role;
select pg_temp.to_approval(pg_temp.v('f2'), 'b3000000-0000-4000-8000-000000000003', 'Fórmula maestra B');
select pg_temp.to_approval(pg_temp.v('f3'), 'b3000000-0000-4000-8000-000000000003', 'Fórmula maestra C');
select pg_temp.login_as('b3000000-0000-4000-8000-000000000002');
select throws_like($$ select public.approve_document(pg_temp.v('f2'), 'Clave-Prueba-2026') $$, '%INVALID_TRANSITION%no está aprobado%',
  'AC-13: sin la aprobación de Gerencia y Dirección técnica del prototipo no se aprueba la fórmula');
select throws_like($$ select public.approve_document(pg_temp.v('f3'), 'Clave-Prueba-2026') $$, '%STABILITY_MISSING%',
  'AC-13: una fórmula sin prototipo con estabilidad no se aprueba');
reset role;

-- =====================================================================
-- Especificación (RF-12) e instructivo (RF-13)
-- =====================================================================
select pg_temp.login_as('b3000000-0000-4000-8000-000000000003');
select set_config('t.sp', (public.request_document('creacion', null, (select id from public.organizational_areas where code = 'IDI'),
  (select id from public.document_types where type_code = 'EP'), null, 'Especificación de prueba', 'Especificación PT', '{}') ->> 'version_id'), false);
select throws_like($$ select public.save_specification_draft(pg_temp.v('sp'), 'pt', null, null, '[]') $$, '%violates check%',
  'la especificación de producto terminado exige el producto');
select is((public.save_specification_draft(pg_temp.v('sp'), 'pt', 'f3000000-0000-4000-8000-000000000001', null,
    '[{"name": "pH", "method": "Potenciometría", "min_value": 5.0, "max_value": 6.0}, {"name": "Aspecto", "method": "", "text_limit": "Líquido translúcido"}]')
    ->> 'parameters')::int, 2, 'RF-12: parámetros con método y límites');
select public.save_document_draft(pg_temp.v('sp'), '{"objetivo": "Establecer la especificación.", "alcance": "PT.", "responsables": "CC.", "desarrollo": "1. Analizar.", "documentos_relacionados": "N.A.", "control_cambios": "Creación."}');
select throws_like($$ select public.submit_for_standardization(pg_temp.v('sp')) $$, '%INVALID_FIELD%Aspecto%',
  'RF-12: cada parámetro necesita método');
select set_config('t.in', (public.request_document('creacion', null, (select id from public.organizational_areas where code = 'IDI'),
  (select id from public.document_types where type_code = 'IN'), null, 'Instructivo de prueba', 'Instructivo de envase', '{}') ->> 'version_id'), false);
select throws_like($$ select public.save_instruction_draft(pg_temp.v('in'), 'f3000000-0000-4000-8000-000000000001', 'envase',
    'f3000000-0000-4000-8000-000000000099', '[]') $$, '%INVALID_FIELD%presentación%', 'la presentación debe ser del producto');
select is((public.save_instruction_draft(pg_temp.v('in'), 'f3000000-0000-4000-8000-000000000001', 'envase', 'f3000000-0000-4000-8000-000000000011',
    '[{"text": "Controlar el peso neto", "requires_verification": true, "params": [{"name": "Peso neto", "unit": "g", "min": 197, "max": 203, "frequency": "cada 30 min"}]}]')
    ->> 'steps')::int, 1, 'RF-13: cada paso define equipo, verificación y parámetros');
reset role;

-- =====================================================================
-- Costos (RF-17, AC-09)
-- =====================================================================
select pg_temp.login_as('b3000000-0000-4000-8000-000000000003');
select set_config('t.cs', public.save_cost_sheet((select id from public.formulas where document_version_id = pg_temp.v('f1')), null, null, 1,
  '{"f3000000-0000-4000-8000-000000000101": 150, "f3000000-0000-4000-8000-000000000102": 6800}',
  '[{"presentation_id": "f3000000-0000-4000-8000-000000000011", "kind": "envase", "unit_cost": 650},
    {"presentation_id": "f3000000-0000-4000-8000-000000000011", "kind": "tapa", "unit_cost": 180}]',
  '{"f3000000-0000-4000-8000-000000000011": 5000}', null)::text, false);
select is((select bulk_cost from public.v_cost_sheet_totals where cost_sheet_id = pg_temp.v('cs')), 699000.00::numeric,
  'RF-17: el granel es la suma de líneas (1.940 kg × $150 + 60 kg × $6.800 = $699.000)');
select is((select (p ->> 'finished')::numeric from public.v_cost_sheet_totals, jsonb_array_elements(presentations) p
           where cost_sheet_id = pg_temp.v('cs') and p ->> 'code' = '200'), 900::numeric,
  'producto terminado 200 mL = granel por unidad ($70) + envase ($650) + tapa ($180)');
select throws_like($$ select public.save_cost_sheet((select id from public.formulas where document_version_id = pg_temp.v('f1')), null, null, 1, '{}', '[]', '{}', '') $$,
  '%REASON_REQUIRED%', 'modificar la hoja de costos exige motivo');
reset role;
select pg_temp.login_as('b3000000-0000-4000-8000-000000000009');
select is((select count(*)::int from public.cost_sheet_lines), 0, 'AC-09: producción no ve ninguna cifra de costos');
reset role;
select ok(not has_table_privilege('anon', 'public.cost_sheets', 'SELECT') and not has_table_privilege('anon', 'public.v_cost_sheet_totals', 'SELECT'),
  'AC-09: la página pública (anon) no tiene acceso a los costos');

select * from finish();
rollback;
