-- E4 · Brief (RF-10), prototipos (RF-15) y estabilidad preliminar (RF-16): AC-13, AC-16, AC-17, AC-18.
begin;
select plan(46);

select pg_temp.test_user('camila@p.test', 'Camila Ortega', '{comercial}', p_id => 'b2000000-0000-4000-8000-000000000001');
select pg_temp.test_user('esteban@p.test', 'Dr. Esteban Gaviria', '{dt}', p_id => 'b2000000-0000-4000-8000-000000000002');
select pg_temp.test_user('sebastian@p.test', 'Sebastián Rojas', '{idi}', p_id => 'b2000000-0000-4000-8000-000000000003');
select pg_temp.test_user('natalia@p.test', 'Natalia Ruiz', '{lab_aux}', p_id => 'b2000000-0000-4000-8000-000000000004');
select pg_temp.test_user('ricardo@p.test', 'Ricardo Peña', '{cc_jefe}', p_id => 'b2000000-0000-4000-8000-000000000005');
select pg_temp.test_user('marcela@p.test', 'Marcela Duarte', '{gerencia}', p_id => 'b2000000-0000-4000-8000-000000000006');
select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'b2000000-0000-4000-8000-000000000009');

-- Datos de partida: producto, materias primas y protocolo de estabilidad vigente.
insert into public.products (id, code, name, line_id, titular, sanitary_registration, sanitary_registration_expires, shelf_life_months)
values ('f2000000-0000-4000-8000-000000000001', 'PRD-901', 'Loción de prueba', (select id from public.product_lines where code = 'COS'),
        'GRUFARCOL S.A.S.', 'NSO-FICT-0001', '2030-09-30', 24);
insert into public.materials (id, code, name, type, unit) values
  ('f2000000-0000-4000-8000-000000000101', 'MP-901', 'Agua de prueba', 'mp', 'kg'),
  ('f2000000-0000-4000-8000-000000000102', 'MP-902', 'Glicerina de prueba', 'mp', 'kg'),
  ('f2000000-0000-4000-8000-000000000103', 'EN-901', 'Envase de prueba', 'envase', 'und');
update public.app_settings set value = '"CC-PC-901"' where key = 'stability_protocol_code';
insert into public.controlled_documents (id, code, title, type_id, process_id, status)
values ('f2000000-0000-4000-8000-000000000201', 'CC-PC-901', 'Protocolo de estabilidad de prueba',
        (select id from public.document_types where type_code = 'PC'), (select id from public.organizational_areas where code = 'CC'), 'vigente');
insert into public.document_versions (id, document_id, version_no, status, author_id, issue_date, review_due_date, locked_at)
values ('f2000000-0000-4000-8000-000000000202', 'f2000000-0000-4000-8000-000000000201', 1, 'vigente',
        'b2000000-0000-4000-8000-000000000005', '2026-02-15', '2029-02-15', now());
update public.controlled_documents set current_version_id = 'f2000000-0000-4000-8000-000000000202'
where id = 'f2000000-0000-4000-8000-000000000201';

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$ select current_setting('t.' || p_key)::uuid $$;

-- Registra todas las lecturas pendientes del estudio salvo una (prueba, tiempo, repetición).
create or replace function pg_temp.record_all(p_study uuid, p_skip_test text default null, p_skip_tp text default null, p_skip_rep int default null)
returns int
language plpgsql
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select t.id as test_id, t.test_type, x.time_point, x.replicate
    from public.stability_tests t join public.stability_readings x on x.test_id = t.id
    where t.study_id = p_study and t.required and x.recorded_at is null
    order by t.test_type, x.time_point, x.replicate
  loop
    continue when r.test_type = p_skip_test and r.time_point = p_skip_tp and r.replicate = p_skip_rep;
    perform public.record_stability_reading(r.test_id, r.time_point, r.replicate, case r.test_type
      when 'calentamiento' then jsonb_build_object('temperature', 45 + r.replicate * 0.1, 'ph', 5.5 + r.replicate * 0.05,
        'organoleptic', jsonb_build_object('aspecto', 'líquido translúcido', 'color', 'incoloro', 'olor', 'característico', 'cambio', false))
      when 'enfriamiento' then jsonb_build_object('temperature', 4 + r.replicate * 0.1, 'ph', 5.6,
        'organoleptic', jsonb_build_object('aspecto', 'líquido translúcido', 'color', 'incoloro', 'olor', 'característico', 'cambio', false))
      when 'microbiologica' then jsonb_build_object('report_ref', 'IM-2026-0188', 'lab_name', 'Laboratorio Externo Andino',
        'analytes', jsonb_build_object('mesofilos', jsonb_build_object('qualifier', '<', 'value', 10), 'pseudomonas', 'ausente',
                                       'staphylococcus', 'ausente', 'ecoli', 'ausente'))
      when 'viscosidad' then jsonb_build_object('value', 11.8, 'sample_volume_ml', 300)
      else jsonb_build_object('value', 1.004) end);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- =====================================================================
-- Brief (RF-10)
-- =====================================================================
select pg_temp.login_as('b2000000-0000-4000-8000-000000000001');
select lives_ok($$ select set_config('t.brief', (public.save_brief(null,
    '{"project_name": "Loción micelar 400 mL", "product_category": "cosmetico"}', '[]') ->> 'id'), false) $$,
  'RF-10: Comercial crea el brief en borrador');
select matches((select code from public.briefs where id = pg_temp.v('brief')), '^BR-2026-[0-9]{4}$', 'código BR-AAAA-NNNN');
select throws_like($$ select public.submit_brief(pg_temp.v('brief'), 'Clave-Prueba-2026') $$, '%INVALID_FIELD%faltan campos obligatorios%',
  'RF-10: no se envía con campos obligatorios vacíos');
select lives_ok($$ select public.save_brief(pg_temp.v('brief'),
    '{"product_id": "f2000000-0000-4000-8000-000000000001", "execution_date": "2026-06-15", "project_name": "Loción micelar 400 mL",
      "project_type": "nuevo_portafolio", "product_category": "cosmetico", "justification": "Ampliar la línea de higiene facial",
      "channels": ["cadenas", "subtiendas"], "margin_pct": 45, "target": {"rango_edad": "25–45"}}',
    '[{"manufacturer": "Lumia", "product_name": "Agua micelar sensible", "price": 32500, "net_content_ml": 400},
      {"manufacturer": "Dermia", "product_name": "Solución micelar", "price": 26900, "net_content_ml": 400}]') $$,
  'Comercial completa el brief con dos competidores');
select is((select price_per_ml from public.brief_competitors where brief_id = pg_temp.v('brief') and order_no = 1), 81.25::numeric,
  'el precio por mL se calcula ($81,25/mL)');
select is(public.submit_brief(pg_temp.v('brief'), 'Clave-Prueba-2026') ->> 'ok', 'true', 'RF-10: Comercial envía el brief a I+D con firma');
reset role;
select pg_temp.login_as('b2000000-0000-4000-8000-000000000003');
select throws_like($$ select public.save_brief(null, '{}', '[]') $$, '%FORBIDDEN_ROLE%', 'I+D no elabora briefs');
select throws_like($$ select public.save_prototype(null, pg_temp.v('brief'), '{}', '[]') $$, '%INVALID_TRANSITION%brief aprobado%',
  'los prototipos parten de un brief aprobado');
reset role;
select pg_temp.login_as('b2000000-0000-4000-8000-000000000002');
select is(public.decide_brief(pg_temp.v('brief'), 'aprobado', null, 'Clave-Prueba-2026') ->> 'status', 'aprobado',
  'RF-10: Dirección técnica aprueba el brief');
reset role;
select throws_like($$ update public.briefs set project_name = 'x' where id = pg_temp.v('brief') $$, '%RECORD_LOCKED%',
  'el brief aprobado queda bloqueado');

-- =====================================================================
-- Prototipos (RF-15) y mínimo de 2 (AC-13)
-- =====================================================================
select pg_temp.login_as('b2000000-0000-4000-8000-000000000003');
select set_config('t.p1', (public.save_prototype(null, pg_temp.v('brief'),
  '{"product_type": "Loción micelar", "concept": "Con extracto de manzanilla"}',
  '[{"material_id": "f2000000-0000-4000-8000-000000000101", "pct": 97, "phase": "A"},
    {"material_id": "f2000000-0000-4000-8000-000000000102", "pct": 3, "phase": "A", "function": "Humectante"}]') ->> 'id'), false);
select matches((select code from public.formula_prototypes where id = pg_temp.v('p1')), '^P-[0-9]{4}$', 'RF-15: el sistema numera P-NNNN');
select throws_like($$ select public.start_stability_study(pg_temp.v('p1'), true) $$, '%MIN_PROTOTYPES%',
  'AC-13: con un solo prototipo no se elige ni se inicia la estabilidad');
select throws_like($$ select public.save_prototype(null, pg_temp.v('brief'), '{}',
    '[{"material_id": "f2000000-0000-4000-8000-000000000103", "pct": 100}]') $$, '%INVALID_FIELD%materia prima%',
  'los ingredientes son materias primas');
select set_config('t.p2', (public.save_prototype(null, pg_temp.v('brief'), '{"product_type": "Loción micelar", "concept": "Sin extracto"}',
  '[{"material_id": "f2000000-0000-4000-8000-000000000101", "pct": 100}]') ->> 'id'), false);
select is((public.start_stability_study(pg_temp.v('p1'), true) ->> 'readings')::int, 52,
  'AC-18: el cronograma crea 21 + 21 lecturas (calentamiento y enfriamiento), 2 microbiológicas, 6 de viscosidad y 2 de densidad');
select set_config('t.st', (select id::text from public.stability_studies where prototype_id = pg_temp.v('p1')), false);
reset role;

select is((select array_agg(distinct time_point order by time_point) from public.stability_readings r join public.stability_tests t on t.id = r.test_id
           where t.study_id = pg_temp.v('st') and t.test_type = 'microbiologica'), array['0h', '30d'],
  'AC-18: microbiología solo a las 0 h y a los 30 d');
select is((select r.due_at - s.start_date from public.stability_readings r join public.stability_tests t on t.id = r.test_id
           join public.stability_studies s on s.id = t.study_id
           where t.study_id = pg_temp.v('st') and t.test_type = 'calentamiento' and r.time_point = '12h' and r.replicate = 1),
  interval '12 hours', 'AC-18: la lectura de 12 h vence a las 12 h del inicio');
select is((select r.due_at - s.start_date from public.stability_readings r join public.stability_tests t on t.id = r.test_id
           join public.stability_studies s on s.id = t.study_id
           where t.study_id = pg_temp.v('st') and t.test_type = 'enfriamiento' and r.time_point = '15d' and r.replicate = 3),
  interval '15 days', 'AC-18: la lectura de 15 d vence a los 15 días');
select is((select count(*)::int from public.stability_readings r join public.stability_tests t on t.id = r.test_id
           where t.study_id = pg_temp.v('st') and t.test_type = 'calentamiento' and r.time_point = '7d'), 3, 'triplicado por tiempo');
select is((select status from public.formula_prototypes where id = pg_temp.v('p1')), 'en_estabilidad', 'borrador → en estabilidad');

-- =====================================================================
-- Lecturas (RF-16; AC-17)
-- =====================================================================
select pg_temp.login_as('b2000000-0000-4000-8000-000000000004');
select set_config('t.cal', (select id::text from public.stability_tests where study_id = pg_temp.v('st') and test_type = 'calentamiento'), false);
select set_config('t.vis', (select id::text from public.stability_tests where study_id = pg_temp.v('st') and test_type = 'viscosidad'), false);
select set_config('t.mic', (select id::text from public.stability_tests where study_id = pg_temp.v('st') and test_type = 'microbiologica'), false);
select throws_like($$ select public.record_stability_reading(pg_temp.v('cal'), '0h', 1, '{"temperature": 45.1}') $$, '%INVALID_FIELD%',
  'la lectura exige temperatura, pH y organoléptico');
select is(public.record_stability_reading(pg_temp.v('cal'), '0h', 1,
    '{"temperature": 49.5, "ph": 5.6, "organoleptic": {"aspecto": "líquido translúcido", "color": "incoloro", "olor": "característico"}}') ->> 'in_range',
  'false', 'una temperatura fuera de 42–48 °C se marca fuera de rango');
select throws_like($$ select public.record_stability_reading(pg_temp.v('cal'), '0h', 1,
    '{"temperature": 45, "ph": 5.6, "organoleptic": {"aspecto": "a", "color": "b", "olor": "c"}}') $$, '%READING_DUPLICATE%',
  'una lectura no se registra dos veces');
select throws_like($$ select public.record_stability_reading(pg_temp.v('vis'), '0h', 1, '{"value": 11.8, "sample_volume_ml": 200}') $$,
  '%SAMPLE_TOO_SMALL%', 'AC-17: viscosidad con muestra de 200 mL');
select throws_like($$ select public.record_stability_reading(pg_temp.v('mic'), '0h', 1,
    '{"analytes": {"mesofilos": {"qualifier": "<", "value": 10}, "pseudomonas": "ausente", "staphylococcus": "ausente", "ecoli": "ausente"}}') $$,
  '%REPORT_MISSING%', 'microbiología sin el informe del laboratorio externo');
reset role;
select throws_like($$ update public.stability_readings set ph = 7 where test_id = pg_temp.v('cal') and time_point = '0h' and replicate = 1 $$,
  '%RECORD_LOCKED%', 'una lectura registrada queda bloqueada');
select pg_temp.login_as('b2000000-0000-4000-8000-000000000009');
select throws_like($$ select public.record_stability_reading(pg_temp.v('cal'), '12h', 1, '{}') $$, '%FORBIDDEN_ROLE%',
  'producción no registra lecturas de estabilidad');
select is((select count(*)::int from public.stability_studies), 0, 'producción no ve los estudios (matriz 2.2)');
reset role;

-- =====================================================================
-- Cierre (AC-16, D-13)
-- =====================================================================
select pg_temp.login_as('b2000000-0000-4000-8000-000000000004');
select is(pg_temp.record_all(pg_temp.v('st'), 'calentamiento', '30d', 3), 50, 'se registran todas las lecturas menos una');
reset role;
select pg_temp.login_as('b2000000-0000-4000-8000-000000000005');
select throws_like($$ select public.close_stability_study(pg_temp.v('st'), 'cumple', null, null, 'Clave-Prueba-2026') $$,
  '%STABILITY_INCOMPLETE%1 lectura%calentamiento 30d%', 'AC-16: no cierra como «cumple» con 20 de 21 lecturas de calentamiento');
reset role;
-- Control de calidad registra la última lectura: ya no puede firmar el resultado (quien analiza no aprueba).
select pg_temp.login_as('b2000000-0000-4000-8000-000000000005');
select public.record_stability_reading(pg_temp.v('cal'), '30d', 3,
  '{"temperature": 45, "ph": 5.4, "organoleptic": {"aspecto": "líquido translúcido", "color": "incoloro", "olor": "característico", "cambio": false}}');
select throws_like($$ select public.close_stability_study(pg_temp.v('st'), 'cumple', null, null, 'Clave-Prueba-2026') $$,
  '%SOD_VIOLATION%', 'quien registró lecturas no firma el resultado');
reset role;
select pg_temp.login_as('b2000000-0000-4000-8000-000000000003');
select throws_like($$ select public.close_stability_study(pg_temp.v('st'), 'cumple', null, null, 'Clave-Prueba-2026') $$,
  '%STABILITY_CRITERIA_MISSING%', 'D-13: sin criterios definidos no se cierra como «cumple»');
select lives_ok($$ select public.set_stability_criteria('f2000000-0000-4000-8000-000000000001',
    '{"ph_max_variation": 0.5, "viscosity_max_variation_pct": 10, "micro_limits": {"mesofilos_max": 100, "ausentes": ["pseudomonas", "staphylococcus", "ecoli"]},
      "organoleptic_changes_allowed": false, "reading_window_hours": 100000}', 'Criterios de prueba') $$,
  'I+D define los criterios del producto');
select throws_like($$ select public.close_stability_study(pg_temp.v('st'), 'cumple', null, null, 'Clave-Prueba-2026') $$,
  '%STABILITY_OUT_OF_CRITERIA%temperatura%', 'el cierre evalúa los criterios y la temperatura fuera de rango');
reset role;
select is((select status from public.stability_studies where id = pg_temp.v('st')), 'en_curso', 'un cierre rechazado no cambia el estudio');

-- Estudio no conforme: cierre anticipado «No cumple» y mejora con consecutivo.
select pg_temp.login_as('b2000000-0000-4000-8000-000000000003');
select throws_like($$ select public.close_stability_study(pg_temp.v('st'), 'no_cumple', '', null, 'Clave-Prueba-2026') $$, '%REASON_REQUIRED%',
  'el cierre «No cumple» exige motivo');
select is(public.close_stability_study(pg_temp.v('st'), 'no_cumple', 'Temperatura fuera de rango y pH inestable', null, 'Clave-Prueba-2026') ->> 'result',
  'no_cumple', 'RF-16: el estudio se cierra como «No cumple» con firma');
reset role;
select is((select status from public.formula_prototypes where id = pg_temp.v('p1')), 'reformular', 'el prototipo pasa a reformular');
select pg_temp.login_as('b2000000-0000-4000-8000-000000000003');
select is(public.create_prototype_improvement(pg_temp.v('p1'), 'Agregar poloxámero 1,5 %') ->> 'code',
  (select code from public.formula_prototypes where id = pg_temp.v('p1')) || '-1', 'RF-15: la mejora toma el consecutivo P-NNNN-1');
select set_config('t.p11', (select id::text from public.formula_prototypes where parent_prototype_id = pg_temp.v('p1')), false);
select is((public.start_stability_study(pg_temp.v('p11'), false) ->> 'readings')::int, 50, 'sin densidad: 50 lecturas');
select set_config('t.st2', (select id::text from public.stability_studies where prototype_id = pg_temp.v('p11')), false);
reset role;
select pg_temp.login_as('b2000000-0000-4000-8000-000000000004');
select pg_temp.record_all(pg_temp.v('st2'));
reset role;

-- =====================================================================
-- Aprobación como fórmula (AC-13)
-- =====================================================================
select pg_temp.login_as('b2000000-0000-4000-8000-000000000006');
select throws_like($$ select public.approve_prototype(pg_temp.v('p11'), false, null, null, 'Clave-Prueba-2026') $$, '%STABILITY_INCOMPLETE%',
  'AC-13: no se aprueba la fórmula con el estudio sin cerrar');
select throws_like($$ select public.approve_prototype(pg_temp.v('p2'), false, null, null, 'Clave-Prueba-2026') $$, '%STABILITY_MISSING%',
  'AC-13: ni un prototipo sin estudio');
reset role;
select pg_temp.login_as('b2000000-0000-4000-8000-000000000005');
select is(public.close_stability_study(pg_temp.v('st2'), 'cumple', null, 'Estable 30 días', 'Clave-Prueba-2026') ->> 'result', 'cumple',
  'con lecturas completas y dentro de criterios el estudio cumple');
reset role;
select is((select status from public.formula_prototypes where id = pg_temp.v('p11')), 'seleccionado', 'el prototipo conforme queda seleccionado');
select pg_temp.login_as('b2000000-0000-4000-8000-000000000003');
select throws_like($$ select public.approve_prototype(pg_temp.v('p11'), false, null, null, 'Clave-Prueba-2026') $$, '%FORBIDDEN_ROLE%',
  'I+D no aprueba la fórmula');
reset role;
select pg_temp.login_as('b2000000-0000-4000-8000-000000000006');
select is(public.approve_prototype(pg_temp.v('p11'), false, null, 'Conforme Gerencia', 'Clave-Prueba-2026') ->> 'status', 'seleccionado',
  'con la firma de Gerencia falta Dirección técnica');
reset role;
select pg_temp.login_as('b2000000-0000-4000-8000-000000000002');
select is(public.approve_prototype(pg_temp.v('p11'), false, null, 'Conforme Dirección técnica', 'Clave-Prueba-2026') ->> 'status', 'aprobado',
  'RF-16: con Gerencia y Dirección técnica el prototipo queda aprobado como fórmula');
reset role;

select * from finish();
rollback;
