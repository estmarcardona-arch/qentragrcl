-- E4 · D-13 (decisión del 24/10/2026): sin criterios de cumplimiento, quien firma decide el «cumple» y lo
-- justifica; la temperatura fuera de rango (RF-16) sigue impidiéndolo. AC-16 se conserva.
begin;
select plan(9);

select pg_temp.test_user('camila@p.test', 'Camila Ortega', '{comercial}', p_id => 'b4000000-0000-4000-8000-000000000001');
select pg_temp.test_user('esteban@p.test', 'Dr. Esteban Gaviria', '{dt}', p_id => 'b4000000-0000-4000-8000-000000000002');
select pg_temp.test_user('sebastian@p.test', 'Sebastián Rojas', '{idi}', p_id => 'b4000000-0000-4000-8000-000000000003');
select pg_temp.test_user('natalia@p.test', 'Natalia Ruiz', '{lab_aux}', p_id => 'b4000000-0000-4000-8000-000000000004');
select pg_temp.test_user('ricardo@p.test', 'Ricardo Peña', '{cc_jefe}', p_id => 'b4000000-0000-4000-8000-000000000005');

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$ select current_setting('t.' || p_key)::uuid $$;

-- Registra todas las lecturas pendientes; p_hot pone una lectura de calentamiento a 49 °C (fuera de rango).
create or replace function pg_temp.record_all(p_study uuid, p_hot boolean default false)
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
    perform public.record_stability_reading(r.test_id, r.time_point, r.replicate, case r.test_type
      when 'calentamiento' then jsonb_build_object(
        'temperature', case when p_hot and r.time_point = '30d' and r.replicate = 3 then 49 else 45 end, 'ph', 5.5,
        'organoleptic', jsonb_build_object('aspecto', 'translúcido', 'color', 'incoloro', 'olor', 'característico', 'cambio', false))
      when 'enfriamiento' then jsonb_build_object('temperature', 4, 'ph', 5.6,
        'organoleptic', jsonb_build_object('aspecto', 'translúcido', 'color', 'incoloro', 'olor', 'característico', 'cambio', false))
      when 'microbiologica' then jsonb_build_object('report_ref', 'IM-2026-0901', 'lab_name', 'Laboratorio Externo Andino',
        'analytes', jsonb_build_object('mesofilos', jsonb_build_object('qualifier', '<', 'value', 10), 'pseudomonas', 'ausente',
                                       'staphylococcus', 'ausente', 'ecoli', 'ausente'))
      when 'viscosidad' then jsonb_build_object('value', 11.8, 'sample_volume_ml', 300)
      else jsonb_build_object('value', 1.004) end);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Datos de partida: producto sin criterios, materias primas, protocolo vigente, brief aprobado y dos estudios.
insert into public.products (id, code, name, line_id, titular, sanitary_registration, sanitary_registration_expires, shelf_life_months)
values ('f4000000-0000-4000-8000-000000000001', 'PRD-903', 'Loción de prueba', (select id from public.product_lines where code = 'COS'),
        'GRUFARCOL S.A.S.', 'NSO-FICT-0003', '2030-09-30', 24);
insert into public.materials (id, code, name, type, unit) values
  ('f4000000-0000-4000-8000-000000000101', 'MP-921', 'Agua de prueba', 'mp', 'kg'),
  ('f4000000-0000-4000-8000-000000000102', 'MP-922', 'Glicerina de prueba', 'mp', 'kg');
update public.app_settings set value = '"CC-PC-903"' where key = 'stability_protocol_code';
insert into public.controlled_documents (id, code, title, type_id, process_id, status)
values ('f4000000-0000-4000-8000-000000000201', 'CC-PC-903', 'Protocolo de estabilidad de prueba',
        (select id from public.document_types where type_code = 'PC'), (select id from public.organizational_areas where code = 'CC'), 'vigente');
insert into public.document_versions (id, document_id, version_no, status, author_id, issue_date, review_due_date, locked_at)
values ('f4000000-0000-4000-8000-000000000202', 'f4000000-0000-4000-8000-000000000201', 1, 'vigente',
        'b4000000-0000-4000-8000-000000000005', '2026-02-15', '2029-02-15', now());
update public.controlled_documents set current_version_id = 'f4000000-0000-4000-8000-000000000202'
where id = 'f4000000-0000-4000-8000-000000000201';

select pg_temp.login_as('b4000000-0000-4000-8000-000000000001');
select set_config('t.brief', (public.save_brief(null,
  '{"product_id": "f4000000-0000-4000-8000-000000000001", "execution_date": "2026-06-15", "project_name": "Loción micelar",
    "project_type": "nuevo_portafolio", "product_category": "cosmetico", "justification": "Ampliar la línea",
    "channels": ["cadenas"], "margin_pct": 45}', '[]') ->> 'id'), false);
select public.submit_brief(pg_temp.v('brief'), 'Clave-Prueba-2026');
reset role;
select pg_temp.login_as('b4000000-0000-4000-8000-000000000002');
select public.decide_brief(pg_temp.v('brief'), 'aprobado', null, 'Clave-Prueba-2026');
reset role;
select pg_temp.login_as('b4000000-0000-4000-8000-000000000003');
select set_config('t.p1', (public.save_prototype(null, pg_temp.v('brief'), '{"product_type": "Loción", "concept": "A"}',
  '[{"material_id": "f4000000-0000-4000-8000-000000000101", "pct": 97}, {"material_id": "f4000000-0000-4000-8000-000000000102", "pct": 3}]') ->> 'id'), false);
select set_config('t.p2', (public.save_prototype(null, pg_temp.v('brief'), '{"product_type": "Loción", "concept": "B"}',
  '[{"material_id": "f4000000-0000-4000-8000-000000000101", "pct": 100}]') ->> 'id'), false);
select public.start_stability_study(pg_temp.v('p1'), false);
select public.start_stability_study(pg_temp.v('p2'), false);
reset role;
select set_config('t.st1', (select id::text from public.stability_studies where prototype_id = pg_temp.v('p1')), false);
select set_config('t.st2', (select id::text from public.stability_studies where prototype_id = pg_temp.v('p2')), false);

select pg_temp.login_as('b4000000-0000-4000-8000-000000000004');
select pg_temp.record_all(pg_temp.v('st1'));
select pg_temp.record_all(pg_temp.v('st2'), true);
reset role;

-- =====================================================================
-- Cierre sin criterios (D-13)
-- =====================================================================
select is((select count(*)::int from public.stability_criteria where product_id = 'f4000000-0000-4000-8000-000000000001'), 0,
  'el producto no tiene criterios de cumplimiento');
select pg_temp.login_as('b4000000-0000-4000-8000-000000000005');
select throws_like($$ select public.close_stability_study(pg_temp.v('st1'), 'cumple', null, null, 'Clave-Prueba-2026') $$,
  '%INVALID_FIELD%justifique%', 'D-13: sin criterios, «cumple» exige justificar en las conclusiones');
select throws_like($$ select public.close_stability_study(pg_temp.v('st1'), 'cumple', null, '   ', 'Clave-Prueba-2026') $$,
  '%INVALID_FIELD%justifique%', 'D-13: una justificación en blanco no cuenta');
select throws_like($$ select public.close_stability_study(pg_temp.v('st2'), 'cumple', null,
    'Estable según el criterio del firmante', 'Clave-Prueba-2026') $$,
  '%STABILITY_OUT_OF_CRITERIA%temperatura%', 'RF-16: la temperatura fuera de rango impide el «cumple» aun sin criterios');
select is(public.close_stability_study(pg_temp.v('st1'), 'cumple', null,
    'Sin cambios relevantes de pH, viscosidad ni aspecto a 30 días', 'Clave-Prueba-2026') ->> 'result', 'cumple',
  'D-13: con lecturas completas y justificación, quien firma cierra como «cumple»');
reset role;
select is((select conclusions from public.stability_studies where id = pg_temp.v('st1')),
  'Sin cambios relevantes de pH, viscosidad ni aspecto a 30 días', 'la justificación queda en las conclusiones del estudio');
select is((select status from public.formula_prototypes where id = pg_temp.v('p1')), 'seleccionado', 'el prototipo queda seleccionado');
select ok(exists (select 1 from public.signatures where record_table = 'stability_studies' and record_id = pg_temp.v('st1')
  and meaning = 'aprobo' and user_id = 'b4000000-0000-4000-8000-000000000005'), 'el cierre queda firmado por Control de calidad');
select is((select status from public.stability_studies where id = pg_temp.v('st2')), 'en_curso', 'el estudio rechazado no cambia');

select * from finish();
rollback;
