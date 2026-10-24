-- E4 · Lecturas de estabilidad por tiempo en una transacción (RF-16, AC-17) y bandeja de aprobación (RF-14, S-10).
begin;
select plan(17);

select pg_temp.test_user('camila@p.test', 'Camila Ortega', '{comercial}', p_id => 'b3000000-0000-4000-8000-000000000001');
select pg_temp.test_user('esteban@p.test', 'Dr. Esteban Gaviria', '{dt}', p_id => 'b3000000-0000-4000-8000-000000000002');
select pg_temp.test_user('sebastian@p.test', 'Sebastián Rojas', '{idi}', p_id => 'b3000000-0000-4000-8000-000000000003');
select pg_temp.test_user('natalia@p.test', 'Natalia Ruiz', '{lab_aux}', p_id => 'b3000000-0000-4000-8000-000000000004');
select pg_temp.test_user('lucia@p.test', 'Lucía Barrera', '{aq_dir}', p_id => 'b3000000-0000-4000-8000-000000000005');
select pg_temp.test_user('marcela@p.test', 'Marcela Duarte', '{gerencia}', p_id => 'b3000000-0000-4000-8000-000000000006');
select pg_temp.test_user('hernan@p.test', 'Hernán Salgado', '{bodega_jefe}', p_id => 'b3000000-0000-4000-8000-000000000007');
select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'b3000000-0000-4000-8000-000000000009');

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$ select current_setting('t.' || p_key)::uuid $$;
create or replace function pg_temp.recorded(p_test uuid, p_tp text) returns int language sql as $$
  select count(*)::int from public.stability_readings where test_id = p_test and time_point = p_tp and recorded_at is not null $$;

-- Datos de partida: producto, materias primas, protocolo vigente, brief aprobado y estudio iniciado.
insert into public.products (id, code, name, line_id, titular, sanitary_registration, sanitary_registration_expires, shelf_life_months)
values ('f3000000-0000-4000-8000-000000000001', 'PRD-902', 'Loción de prueba', (select id from public.product_lines where code = 'COS'),
        'GRUFARCOL S.A.S.', 'NSO-FICT-0002', '2030-09-30', 24);
insert into public.materials (id, code, name, type, unit) values
  ('f3000000-0000-4000-8000-000000000101', 'MP-911', 'Agua de prueba', 'mp', 'kg'),
  ('f3000000-0000-4000-8000-000000000102', 'MP-912', 'Glicerina de prueba', 'mp', 'kg');
update public.app_settings set value = '"CC-PC-902"' where key = 'stability_protocol_code';
insert into public.controlled_documents (id, code, title, type_id, process_id, status)
values ('f3000000-0000-4000-8000-000000000201', 'CC-PC-902', 'Protocolo de estabilidad de prueba',
        (select id from public.document_types where type_code = 'PC'), (select id from public.organizational_areas where code = 'CC'), 'vigente');
insert into public.document_versions (id, document_id, version_no, status, author_id, issue_date, review_due_date, locked_at)
values ('f3000000-0000-4000-8000-000000000202', 'f3000000-0000-4000-8000-000000000201', 1, 'vigente',
        'b3000000-0000-4000-8000-000000000003', '2026-02-15', '2029-02-15', now());
update public.controlled_documents set current_version_id = 'f3000000-0000-4000-8000-000000000202'
where id = 'f3000000-0000-4000-8000-000000000201';

select pg_temp.login_as('b3000000-0000-4000-8000-000000000001');
select set_config('t.brief', (public.save_brief(null,
  '{"product_id": "f3000000-0000-4000-8000-000000000001", "execution_date": "2026-06-15", "project_name": "Loción micelar 400 mL",
    "project_type": "nuevo_portafolio", "product_category": "cosmetico", "justification": "Ampliar la línea de higiene facial",
    "channels": ["cadenas"], "margin_pct": 45, "target": {"rango_edad": "25–45"}}',
  '[{"manufacturer": "Lumia", "product_name": "Agua micelar sensible", "price": 32500, "net_content_ml": 400}]') ->> 'id'), false);
select public.submit_brief(pg_temp.v('brief'), 'Clave-Prueba-2026');
reset role;
select pg_temp.login_as('b3000000-0000-4000-8000-000000000002');
select public.decide_brief(pg_temp.v('brief'), 'aprobado', null, 'Clave-Prueba-2026');
reset role;
select pg_temp.login_as('b3000000-0000-4000-8000-000000000003');
select set_config('t.p1', (public.save_prototype(null, pg_temp.v('brief'), '{"product_type": "Loción", "concept": "Con manzanilla"}',
  '[{"material_id": "f3000000-0000-4000-8000-000000000101", "pct": 97}, {"material_id": "f3000000-0000-4000-8000-000000000102", "pct": 3}]') ->> 'id'), false);
select public.save_prototype(null, pg_temp.v('brief'), '{"product_type": "Loción", "concept": "Sin manzanilla"}',
  '[{"material_id": "f3000000-0000-4000-8000-000000000101", "pct": 100}]');
select public.start_stability_study(pg_temp.v('p1'), true);
reset role;
select set_config('t.cal', (select t.id::text from public.stability_tests t join public.stability_studies s on s.id = t.study_id
  where s.prototype_id = pg_temp.v('p1') and t.test_type = 'calentamiento'), false);
select set_config('t.vis', (select t.id::text from public.stability_tests t join public.stability_studies s on s.id = t.study_id
  where s.prototype_id = pg_temp.v('p1') and t.test_type = 'viscosidad'), false);

-- =====================================================================
-- 1. record_stability_readings (RF-16; AC-17)
-- =====================================================================
select pg_temp.login_as('b3000000-0000-4000-8000-000000000004');
select is((public.record_stability_readings(pg_temp.v('cal'), '0h', '[
    {"replicate": 1, "values": {"temperature": 45.1, "ph": 5.5, "organoleptic": {"aspecto": "translúcido", "color": "incoloro", "olor": "característico"}}},
    {"replicate": 2, "values": {"temperature": 45.2, "ph": 5.5, "organoleptic": {"aspecto": "translúcido", "color": "incoloro", "olor": "característico"}}},
    {"replicate": 3, "values": {"temperature": 49.0, "ph": 5.6, "organoleptic": {"aspecto": "translúcido", "color": "incoloro", "olor": "característico"}}}
  ]') ->> 'recorded')::int, 3, 'RF-16: registra las tres repeticiones del tiempo 0 h en una llamada');
select is(pg_temp.recorded(pg_temp.v('cal'), '0h'), 3, 'las tres lecturas quedan registradas');
select is((select in_range from public.stability_readings where test_id = pg_temp.v('cal') and time_point = '0h' and replicate = 3), false,
  'la repetición a 49 °C queda fuera del rango de calentamiento');

select throws_like($$ select public.record_stability_readings(pg_temp.v('cal'), '12h', '[
    {"replicate": 1, "values": {"temperature": 45, "ph": 5.5, "organoleptic": {"aspecto": "a", "color": "b", "olor": "c"}}},
    {"replicate": 2, "values": {"temperature": 45, "ph": 5.5, "organoleptic": {"aspecto": "a", "color": "b", "olor": "c"}}},
    {"replicate": 3, "values": {"temperature": 45}}
  ]') $$, '%INVALID_FIELD%', 'una repetición incompleta rechaza el tiempo completo');
select is(pg_temp.recorded(pg_temp.v('cal'), '12h'), 0, 'todas o ninguna: las repeticiones 1 y 2 no quedan registradas');

select throws_like($$ select public.record_stability_readings(pg_temp.v('vis'), '0h',
    '[{"replicate": 1, "values": {"value": 11.8, "sample_volume_ml": 300}}, {"replicate": 2, "values": {"value": 11.9, "sample_volume_ml": 200}}]') $$,
  '%SAMPLE_TOO_SMALL%', 'AC-17: una muestra de viscosidad de 200 mL rechaza el tiempo');
select is(pg_temp.recorded(pg_temp.v('vis'), '0h'), 0, 'AC-17: no queda ninguna lectura de viscosidad registrada');

select throws_like($$ select public.record_stability_readings(pg_temp.v('cal'), '0h',
    '[{"replicate": 1, "values": {"temperature": 45, "ph": 5.5, "organoleptic": {"aspecto": "a", "color": "b", "olor": "c"}}}]') $$,
  '%READING_DUPLICATE%', 'no se registra de nuevo una lectura firmada');
select throws_like($$ select public.record_stability_readings(pg_temp.v('cal'), '24h', '[]') $$, '%INVALID_FIELD%',
  'exige al menos una repetición');
reset role;
select pg_temp.login_as('b3000000-0000-4000-8000-000000000009');
select throws_like($$ select public.record_stability_readings(pg_temp.v('cal'), '24h',
    '[{"replicate": 1, "values": {"temperature": 45, "ph": 5.5, "organoleptic": {"aspecto": "a", "color": "b", "olor": "c"}}}]') $$,
  '%FORBIDDEN_ROLE%', 'Producción no registra lecturas de estabilidad');
reset role;

-- =====================================================================
-- 2. my_pending_versions (RF-14, S-10)
-- =====================================================================
-- Hernán es jefe del área del autor (GLG); el documento usa la ruta técnica (revisa aq_dir o el jefe; aprueba dt).
update public.organizational_areas set head_user_id = 'b3000000-0000-4000-8000-000000000007' where code = 'GLG';
update public.profiles set area_id = (select id from public.organizational_areas where code = 'GLG')
where id = 'b3000000-0000-4000-8000-000000000003';
insert into public.controlled_documents (id, code, title, type_id, process_id, status, route_id) values
  ('f3000000-0000-4000-8000-000000000301', 'GLG-PR-901', 'En revisión', (select id from public.document_types where type_code = 'PR'),
   (select id from public.organizational_areas where code = 'GLG'), 'en_elaboracion', (select id from public.approval_routes where code = 'tecnica')),
  ('f3000000-0000-4000-8000-000000000302', 'GLG-PR-902', 'Por aprobar', (select id from public.document_types where type_code = 'PR'),
   (select id from public.organizational_areas where code = 'GLG'), 'en_elaboracion', (select id from public.approval_routes where code = 'tecnica')),
  ('f3000000-0000-4000-8000-000000000303', 'GLG-PR-903', 'Aprobada sin publicar', (select id from public.document_types where type_code = 'PR'),
   (select id from public.organizational_areas where code = 'GLG'), 'en_elaboracion', (select id from public.approval_routes where code = 'tecnica'));
insert into public.document_versions (id, document_id, version_no, status, author_id, locked_at) values
  ('f3000000-0000-4000-8000-000000000311', 'f3000000-0000-4000-8000-000000000301', 1, 'en_revision', 'b3000000-0000-4000-8000-000000000003', null),
  ('f3000000-0000-4000-8000-000000000312', 'f3000000-0000-4000-8000-000000000302', 1, 'en_aprobacion', 'b3000000-0000-4000-8000-000000000003', null),
  ('f3000000-0000-4000-8000-000000000313', 'f3000000-0000-4000-8000-000000000303', 1, 'en_aprobacion', 'b3000000-0000-4000-8000-000000000003', now());

create or replace function pg_temp.pending(p_user uuid) returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.login_as(p_user);
  select string_agg(d.code || ':' || m.step, ',' order by d.code) into v
  from public.my_pending_versions() m join public.document_versions x on x.id = m.version_id
  join public.controlled_documents d on d.id = x.document_id where d.code like 'GLG-PR-90%';
  reset role;
  return coalesce(v, '');
end;
$$;

select is(pg_temp.pending('b3000000-0000-4000-8000-000000000005'), 'GLG-PR-901:revision',
  'S-10: Aseguramiento de la calidad ve la versión que debe revisar');
select is(pg_temp.pending('b3000000-0000-4000-8000-000000000007'), 'GLG-PR-901:revision',
  'S-10: el jefe del área del autor también la ve para revisar');
select is(pg_temp.pending('b3000000-0000-4000-8000-000000000002'), 'GLG-PR-902:aprobacion',
  'RF-14: Dirección técnica ve solo la versión por aprobar; la aprobada sin publicar ya no está pendiente');
select is(pg_temp.pending('b3000000-0000-4000-8000-000000000006'), '',
  'Gerencia no aprueba documentos técnicos: su bandeja queda vacía');
select is(pg_temp.pending('b3000000-0000-4000-8000-000000000009'), '', 'Producción no tiene versiones por firmar');

update public.approval_routes set allow_reviewer_as_approver = false where code = 'tecnica';
insert into public.signatures (user_id, record_table, record_id, meaning, signed_as, record_hash, short_signature, signer_name, reauth_method)
values ('b3000000-0000-4000-8000-000000000002', 'document_versions', 'f3000000-0000-4000-8000-000000000312', 'reviso', 'dt', repeat('0', 64), 'EG',
        'Dr. Esteban Gaviria', 'password');
select is(pg_temp.pending('b3000000-0000-4000-8000-000000000002'), '',
  'si la ruta no permite que el revisor apruebe, quien revisó no la ve para aprobar');
select ok(not has_function_privilege('anon', 'public.my_pending_versions()', 'execute'), 'la bandeja no está disponible sin sesión');

select * from finish();
rollback;
