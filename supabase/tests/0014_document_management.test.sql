-- E3 · Gestión documental: estructura, RLS, tipos, vigencias (RF-98, AC-34), listado maestro (RF-92),
-- indicador de vencidos por proceso y revisor de redacción (RF-94, AC-33). Fecha de referencia: 05/10/2026.
begin;
select plan(29);

insert into app_private.test_clock (now_override) values ('2026-10-05 12:00:00-05');

-- Tablas nuevas: RLS, sin escritura directa, bitácora.
select ok(bool_and(c.relrowsecurity), 'RLS activo en todas las tablas del SGD')
from pg_class c where c.oid in (
  'public.document_types'::regclass, 'public.approval_routes'::regclass, 'public.approval_route_steps'::regclass,
  'public.controlled_documents'::regclass, 'public.document_versions'::regclass, 'public.document_requests'::regclass,
  'public.standardization_checks'::regclass, 'public.document_distribution'::regclass,
  'public.document_change_requests'::regclass, 'public.document_annulments'::regclass,
  'public.document_trainings'::regclass, 'public.training_assignments'::regclass, 'public.training_attempts'::regclass,
  'public.document_downloads'::regclass, 'public.stage_definitions'::regclass, 'public.process_templates'::regclass,
  'public.process_template_steps'::regclass);
select ok(not bool_or(has_table_privilege('authenticated', t, 'INSERT') or has_table_privilege('authenticated', t, 'UPDATE')
                      or has_table_privilege('authenticated', t, 'DELETE')),
  'nadie escribe el SGD fuera de las RPC')
from unnest(array['public.controlled_documents', 'public.document_versions', 'public.document_requests',
  'public.standardization_checks', 'public.document_distribution', 'public.document_change_requests',
  'public.document_annulments', 'public.document_trainings', 'public.training_attempts',
  'public.process_templates', 'public.process_template_steps']) t;
select ok(bool_and(exists (select 1 from pg_trigger g where g.tgrelid = t::regclass and g.tgname like '%_audit')),
  'todas las tablas del SGD escriben en la bitácora')
from unnest(array['public.controlled_documents', 'public.document_versions', 'public.document_requests',
  'public.standardization_checks', 'public.document_distribution', 'public.document_change_requests',
  'public.document_annulments', 'public.document_trainings', 'public.training_assignments', 'public.training_attempts',
  'public.document_downloads', 'public.process_templates', 'public.process_template_steps']) t;
select ok(not has_table_privilege('authenticated', 'app_private.training_answer_keys', 'SELECT'),
  'las respuestas de los cuestionarios no se pueden leer');

-- Tipos y rutas (PRD 2.5.1, 2.5.4).
select is((select string_agg(type_code, ',' order by type_code) from public.document_types),
  'CE,EP,FR,FT,IN,MN,PC,PG,PL,PO,PR,RG', 'los 12 tipos del PRD 2.5.1 (incluido PC)');
select is((select level from public.document_types where type_code = 'FR'), 5, 'los formatos son nivel 5');
select is((select stamp_required from public.document_types where type_code = 'FR'), false, 'D-22: los formatos no llevan sello por defecto');
select is((select requires_scope from public.document_types where type_code = 'IN'), false, 'los instructivos no llevan alcance');
select is((select roles from public.approval_route_steps s join public.approval_routes r on r.id = s.route_id
           where r.code = 'administrativa' and s.step = 'aprobacion'), array['gerencia', 'dt'],
  'D-24: los administrativos los aprueba Gerencia o Dirección técnica');
select ok((select allow_reviewer_as_approver from public.approval_routes where code = 'tecnica'), 'el revisor puede aprobar');
select is((select count(*)::int from public.stage_definitions), 5, 'etapas del proceso del PRD 2.4');

-- Vigencias (RF-98, AC-34).
select is(public.compute_review_due_date((select id from public.document_types where type_code = 'PR'), '2025-04-17', null),
  '2028-04-17'::date, 'procedimiento: revisión a los 3 años');
select is(public.compute_review_due_date((select id from public.document_types where type_code = 'EP'), '2025-10-30', null),
  '2026-10-30'::date, 'especificación: revisión anual');
select is(public.compute_review_due_date((select id from public.document_types where type_code = 'FT'), '2026-08-25', '2030-09-30'),
  '2030-09-30'::date, 'AC-34: la ficha técnica vence con el registro sanitario (30/09/2030)');
select is(public.compute_review_due_date((select id from public.document_types where type_code = 'EP'), '2026-08-25', '2027-03-31'),
  '2027-03-31'::date, 'la especificación de producto toma también la vigencia del registro si es más cercana');
select is(public.document_validity('2026-05-15', 'vigente'), 'vencido', 'revisión vencida');
select is(public.document_validity('2026-10-30', 'vigente'), 'por_vencer', 'por vencer (dentro de 30 días)');
select is(public.document_validity('2028-04-17', 'vigente'), 'vigente', 'vigente');
select is(public.document_validity('2028-04-17', 'anulado'), 'obsoleto', 'un anulado se marca obsoleto');

-- Listado maestro e indicador (RF-92): un documento aparece una vez, con su versión vigente.
select pg_temp.test_user('valentina@p.test', 'Valentina Cruz', '{aq_doc}', p_id => 'b0000000-0000-4000-8000-000000000001');
insert into public.controlled_documents (id, code, title, type_id, process_id, status, next_review_date)
values ('c0000000-0000-4000-8000-000000000001', 'MTO-PR-001', 'Procedimiento de mantenimiento de prueba',
        (select id from public.document_types where type_code = 'PR'), (select id from public.organizational_areas where code = 'MTO'),
        'vigente', '2026-05-15');
insert into public.document_versions (id, document_id, version_no, status, author_id, issue_date, review_due_date)
values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 1, 'obsoleto',
        'b0000000-0000-4000-8000-000000000001', '2020-05-15', '2023-05-15'),
       ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 2, 'vigente',
        'b0000000-0000-4000-8000-000000000001', '2023-05-15', '2026-05-15'),
       ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 3, 'preliminar',
        'b0000000-0000-4000-8000-000000000001', null, null);
update public.controlled_documents set current_version_id = 'd0000000-0000-4000-8000-000000000002'
where id = 'c0000000-0000-4000-8000-000000000001';
select throws_like($$ delete from public.document_versions where id = 'd0000000-0000-4000-8000-000000000003' $$, '%RECORD_LOCKED%', 'DI-10: las versiones no se borran');
select is((select count(*)::int from public.v_master_list where code = 'MTO-PR-001'), 1, 'RF-92: un documento aparece una sola vez');
select is((select version_label || ' ' || validity || ' · en curso v' || open_version_no from public.v_master_list where code = 'MTO-PR-001'),
  '02 vencido · en curso v3', 'RF-92: muestra la versión vigente, su semáforo y la versión en curso');
select is((select overdue_pct from public.v_documents_overdue_by_process where process_code = 'MTO'), 100.0,
  'indicador: % de documentos vencidos por proceso');

-- Lectura: el administrador no ve el SGD (matriz 2.2); el auditor sí.
select pg_temp.test_user('admin@p.test', 'Tomás Herrera', '{admin}', p_id => 'b0000000-0000-4000-8000-000000000002');
select pg_temp.test_user('ines@p.test', 'Inés Valencia', '{auditor}', p_id => 'b0000000-0000-4000-8000-000000000003');
select pg_temp.login_as('b0000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.v_master_list where code = 'MTO-PR-001'), 0, 'el administrador no lee el SGD');
reset role;
select pg_temp.login_as('b0000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.v_master_list where code = 'MTO-PR-001'), 1, 'el auditor lee el listado maestro');
reset role;

-- Revisor de redacción (RF-94, AC-33).
select ok(exists (select 1 from jsonb_array_elements(public.style_observations(
    '{"objetivo": "Establecer el método.", "alcance": "Aplica a producción.", "responsables": "Jefe", "desarrollo": "Se verifica generalmente la temperatura", "documentos_relacionados": "N.A.", "control_cambios": "Creación"}',
    (select id from public.document_types where type_code = 'PR'))) o where o ->> 'rule' = 'termino_subjetivo' and o ->> 'message' like '%generalmente%'),
  'AC-33: marca «generalmente»');
select ok(exists (select 1 from jsonb_array_elements(public.style_observations(
    '{"objetivo": "Establecer el método.", "alcance": "Aplica a producción.", "responsables": "Jefe", "desarrollo": "Se verifica la temperatura", "documentos_relacionados": "N.A.", "control_cambios": "Creación"}',
    (select id from public.document_types where type_code = 'PR'))) o where o ->> 'rule' = 'infinitivo'),
  'AC-33: marca la redacción no infinitiva');
select is(jsonb_array_length(public.style_observations(
    '{"objetivo": "Establecer el método de limpieza.", "responsables": "Jefe de producción", "desarrollo": "1. Verificar el rótulo de limpieza.\n2. Registrar la temperatura cada 10 min.", "documentos_relacionados": "N.A.", "control_cambios": "Creación del documento"}',
    (select id from public.document_types where type_code = 'FR'))), 0,
  'un formato bien redactado y sin alcance cumple');
select ok(exists (select 1 from jsonb_array_elements(public.style_observations('{"objetivo": "Establecer"}',
    (select id from public.document_types where type_code = 'PR'))) o where o ->> 'message' like '%Alcance%'),
  'un procedimiento sin alcance no cumple (secciones mínimas)');

select * from finish();
rollback;
