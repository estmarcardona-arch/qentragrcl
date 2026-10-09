-- E3 · RPC del SGD: cada transición de estado y cada código de error (PRD 2.5, 8, 9).
-- RF-05, RF-93…RF-101, RF-103; AC-19, AC-20, AC-23, AC-25, AC-26, AC-28, AC-29, AC-30, AC-31, AC-32, AC-33, AC-34.
begin;
select plan(73);

insert into app_private.test_clock (now_override) values ('2026-10-05 12:00:00-05');

select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'b1000000-0000-4000-8000-000000000001');
select pg_temp.test_user('valentina@p.test', 'Valentina Cruz', '{aq_doc}', p_id => 'b1000000-0000-4000-8000-000000000002');
select pg_temp.test_user('lucia@p.test', 'Lucía Barrera', '{aq_dir}', p_id => 'b1000000-0000-4000-8000-000000000003');
select pg_temp.test_user('esteban@p.test', 'Dr. Esteban Gaviria', '{dt}', p_id => 'b1000000-0000-4000-8000-000000000004');
select pg_temp.test_user('gabriela@p.test', 'Gabriela Torres', '{master}', p_id => 'b1000000-0000-4000-8000-000000000005');
select pg_temp.test_user('hernan@p.test', 'Hernán Salgado', '{bodega_jefe}', p_id => 'b1000000-0000-4000-8000-000000000006');

update public.profiles p set area_id = a.id
from (values ('b1000000-0000-4000-8000-000000000001'::uuid, 'PRD'), ('b1000000-0000-4000-8000-000000000002', 'GCA'),
             ('b1000000-0000-4000-8000-000000000003', 'GCA'), ('b1000000-0000-4000-8000-000000000004', 'DT'),
             ('b1000000-0000-4000-8000-000000000005', 'DT'), ('b1000000-0000-4000-8000-000000000006', 'GLG')) v(id, code)
join public.organizational_areas a on a.code = v.code where p.id = v.id;
update public.organizational_areas set head_user_id = 'b1000000-0000-4000-8000-000000000004' where code in ('PRD', 'DT');

-- Documentos de partida (estado ya alcanzado), para probar cada transición por separado.
create or replace function pg_temp.fixture_doc(p_doc uuid, p_ver uuid, p_code text, p_type text, p_process text,
  p_author uuid, p_status text, p_version_no int default 1, p_parent_code text default null)
returns uuid
language plpgsql
as $$
begin
  insert into public.controlled_documents (id, code, title, type_id, process_id, parent_code, sub_type, sub_number, status, route_id)
  values (p_doc, p_code, (select name from public.document_types where type_code = p_type) || ' de prueba ' || p_code,
    (select id from public.document_types where type_code = p_type), (select id from public.organizational_areas where code = p_process),
    p_parent_code, case when p_parent_code is not null then p_type end, case when p_parent_code is not null then 1 end,
    case when p_status = 'vigente' then 'vigente' else 'en_elaboracion' end,
    (select id from public.approval_routes where code = 'tecnica'));
  insert into public.document_versions (id, document_id, version_no, status, author_id, content, issue_date, review_due_date, locked_at)
  values (p_ver, p_doc, p_version_no, p_status, p_author, '{}', case when p_status = 'vigente' then date '2024-01-20' end,
    case when p_status = 'vigente' then date '2027-01-20' end, case when p_status = 'vigente' then now() end);
  if p_status = 'vigente' then
    update public.controlled_documents set current_version_id = p_ver, next_review_date = '2027-01-20' where id = p_doc;
  end if;
  return p_ver;
end;
$$;

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$ select current_setting('t.' || p_key)::uuid $$;

-- =====================================================================
-- A. Creación: solicitud → preliminar → estandarización → código → revisión → aprobación → vigente
-- =====================================================================
select pg_temp.login_as('b1000000-0000-4000-8000-000000000001');
select lives_ok($$ select set_config('t.v1', (public.request_document('creacion', null,
    (select id from public.organizational_areas where code = 'PRD'), (select id from public.document_types where type_code = 'PR'),
    null, 'Procedimiento de limpieza de tanques', 'Documentar la limpieza de tanques', '{}') ->> 'version_id'), false) $$,
  'RF-93: cualquier autor solicita crear un documento y recibe la plantilla');
select is((select status from public.document_versions where id = pg_temp.v('v1')), 'solicitado', 'estado inicial: solicitado');
select ok((select content ? 'alcance' and content ? 'control_cambios' from public.document_versions where id = pg_temp.v('v1')),
  'la plantilla editable trae la estructura obligatoria');
select lives_ok($$ select public.save_document_draft(pg_temp.v('v1'),
    '{"objetivo": "Establecer el método de limpieza.", "alcance": "Tanques de fabricación.", "responsables": "Coordinador.", "desarrollo": "Se verifica generalmente el tanque.", "documentos_relacionados": "N.A.", "control_cambios": "Creación."}') $$,
  'el autor redacta el preliminar');
select is((select status from public.document_versions where id = pg_temp.v('v1')), 'preliminar', 'solicitado → preliminar');
select lives_ok($$ select public.submit_for_standardization(pg_temp.v('v1')) $$, 'el autor envía a estandarización');
select is((select status from public.document_versions where id = pg_temp.v('v1')), 'en_estandarizacion', 'preliminar → en estandarización');
select throws_like($$ select public.request_document_code(pg_temp.v('v1'), 'Procedimiento de limpieza de tanques') $$,
  '%FORBIDDEN_ROLE%', 'AC-28: solicitar un código sin ser aq_doc');
select throws_like($$ select public.run_style_check(pg_temp.v('v1')) $$, '%FORBIDDEN_ROLE%', 'solo aq_doc estandariza');
reset role;

select pg_temp.login_as('b1000000-0000-4000-8000-000000000003');
select throws_like($$ select public.request_document_code(pg_temp.v('v1'), 'Procedimiento de limpieza de tanques') $$,
  '%FORBIDDEN_ROLE%', 'AC-26: ni la dirección de calidad crea el documento controlado');
reset role;

select pg_temp.login_as('b1000000-0000-4000-8000-000000000002');
select throws_like($$ select public.request_document_code(pg_temp.v('v1'), 'Procedimiento de limpieza de tanques') $$,
  '%NOT_STANDARDIZED%', 'sin estandarización no hay código');
select is(public.run_style_check(pg_temp.v('v1')) ->> 'code', 'STYLE_CHECK_FAILED', 'AC-33: «generalmente» y redacción no infinitiva');
select ok((select bool_or(o ->> 'message' like '%generalmente%') and bool_or(o ->> 'rule' = 'infinitivo')
           from public.standardization_checks c, jsonb_array_elements(c.observations) o where c.version_id = pg_temp.v('v1')),
  'AC-33: las observaciones quedan registradas');
select is((select status from public.document_versions where id = pg_temp.v('v1')), 'preliminar', 'RF-94: se devuelve al solicitante');
reset role;

select pg_temp.login_as('b1000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.save_document_draft(pg_temp.v('v1'),
    '{"objetivo": "Establecer el método de limpieza de tanques.", "alcance": "Tanques de fabricación.", "responsables": "Coordinador de producción.", "desarrollo": "1. Verificar el rótulo de limpieza.\n2. Registrar la temperatura del agua en °C.", "documentos_relacionados": "N.A.", "control_cambios": "Creación del documento."}');
    select public.submit_for_standardization(pg_temp.v('v1')) $$, 'el autor corrige y reenvía');
reset role;

select pg_temp.login_as('b1000000-0000-4000-8000-000000000002');
select is(public.run_style_check(pg_temp.v('v1')) ->> 'ok', 'true', 'RF-94: el preliminar corregido cumple');
select throws_like($$ select public.request_document_code(pg_temp.v('v1'), 'Instructivo de limpieza') $$,
  '%INVALID_FIELD%', 'RF-93: el título debe iniciar con el nombre del tipo');
select matches(public.request_document_code(pg_temp.v('v1'), 'Procedimiento de limpieza de tanques') ->> 'code',
  '^PRD-PR-[0-9]{3}$', 'RF-93: aq_doc genera el código PPP-TT-NNN');
select is((select status from public.document_versions where id = pg_temp.v('v1')), 'codificado', 'en estandarización → codificado');
reset role;

select pg_temp.login_as('b1000000-0000-4000-8000-000000000001');
select throws_like($$ select public.save_document_draft(pg_temp.v('v1'), '{}') $$, '%RECORD_LOCKED%',
  'una versión codificada ya no se edita como borrador');
select is(public.submit_for_review(pg_temp.v('v1'), 'clave-errada') ->> 'code', 'REAUTH_FAILED', 'enviar a revisión exige contraseña');
select is(public.submit_for_review(pg_temp.v('v1'), 'Clave-Prueba-2026') ->> 'ok', 'true', 'el autor firma «Actualizado por»');
select is((select status from public.document_versions where id = pg_temp.v('v1')), 'en_revision', 'codificado → en revisión');
reset role;

select pg_temp.login_as('b1000000-0000-4000-8000-000000000006');
select throws_like($$ select public.review_document(pg_temp.v('v1'), 'Clave-Prueba-2026') $$, '%FORBIDDEN_ROLE%',
  'revisa el jefe inmediato del autor o calidad, no otro jefe');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000004');
select throws_like($$ select public.approve_document(pg_temp.v('v1'), 'Clave-Prueba-2026') $$, '%INVALID_TRANSITION%',
  'no se aprueba antes de revisar');
select is(public.review_document(pg_temp.v('v1'), 'Clave-Prueba-2026') ->> 'ok', 'true', 'RF-95: el jefe inmediato revisa');
select is((select status from public.document_versions where id = pg_temp.v('v1')), 'en_aprobacion', 'en revisión → en aprobación');
select is(public.approve_document(pg_temp.v('v1'), 'Clave-Prueba-2026') ->> 'ok', 'true', 'AC-29: el revisor sí puede aprobar');
reset role;
select ok((select locked_at is not null from public.document_versions where id = pg_temp.v('v1')), 'SOD-10: la versión aprobada queda bloqueada');

select pg_temp.login_as('b1000000-0000-4000-8000-000000000003');
select throws_like($$ select public.publish_document(pg_temp.v('v1'), array[(select id from public.organizational_areas where code = 'PRD')]) $$,
  '%FORBIDDEN_ROLE%', 'publica solo aq_doc');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000002');
select is(public.publish_document(pg_temp.v('v1'), array[(select id from public.organizational_areas where code = 'PRD')]) ->> 'review_due_date',
  '2029-10-05', 'RF-98: vigente con fecha de emisión de hoy y revisión a 3 años');
reset role;
select is((select d.status || '/' || v.status from public.document_versions v join public.controlled_documents d on d.id = v.document_id
           where v.id = pg_temp.v('v1')), 'vigente/vigente', 'en aprobación → vigente');
select is((select count(*)::int from public.document_distribution where version_id = pg_temp.v('v1') and copy_type = 'controlada'), 1,
  'RF-96: se emite la copia controlada al proceso indicado');
select ok((select bool_and(public.verify_signature_integrity(s.id)) from public.signatures s
           where s.record_table = 'document_versions' and s.record_id = pg_temp.v('v1')),
  'DI-7: la huella firmada sigue íntegra después de publicar');

-- Consecutivo sin saltos por proceso y tipo.
select pg_temp.login_as('b1000000-0000-4000-8000-000000000001');
select set_config('t.v1b', (public.request_document('creacion', null, (select id from public.organizational_areas where code = 'PRD'),
  (select id from public.document_types where type_code = 'PR'), null, 'Procedimiento dos', 'Segundo procedimiento', '{}') ->> 'version_id'), false);
select public.save_document_draft(pg_temp.v('v1b'), (select content from public.document_versions where id = pg_temp.v('v1')));
select public.submit_for_standardization(pg_temp.v('v1b'));
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000002');
select public.run_style_check(pg_temp.v('v1b'));
select is(right(public.request_document_code(pg_temp.v('v1b'), 'Procedimiento de secado') ->> 'code', 3)::int,
  right((select code from public.controlled_documents d join public.document_versions v on v.document_id = d.id where v.id = pg_temp.v('v1')), 3)::int + 1,
  'RF-93: el consecutivo sigue sin saltos');
reset role;

-- =====================================================================
-- B. Segregación (SOD-8): el autor no revisa ni aprueba (AC-23, AC-29)
-- =====================================================================
select pg_temp.fixture_doc('c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'IDI-IN-090', 'IN', 'IDI',
  'b1000000-0000-4000-8000-000000000004', 'en_revision');
select pg_temp.login_as('b1000000-0000-4000-8000-000000000004');
select throws_like($$ select public.review_document('d1000000-0000-4000-8000-000000000002', 'Clave-Prueba-2026') $$,
  '%SOD_VIOLATION%', 'AC-23: el autor no revisa su versión');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000003');
select lives_ok($$ select public.review_document('d1000000-0000-4000-8000-000000000002', 'Clave-Prueba-2026') $$, 'calidad revisa');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000004');
select throws_like($$ select public.approve_document('d1000000-0000-4000-8000-000000000002', 'Clave-Prueba-2026') $$,
  '%SOD_VIOLATION%', 'AC-29: el autor no aprueba su versión');
reset role;

-- =====================================================================
-- C. Cambio técnico de un formato (RF-100, AC-30) y recolección de copias (RF-96)
-- =====================================================================
select pg_temp.fixture_doc('c1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000003', 'MTO-PR-003-FR-01', 'FR', 'MTO',
  'b1000000-0000-4000-8000-000000000002', 'vigente', 3, 'MTO-PR-003');
insert into public.document_distribution (version_id, area_id, delivered_by)
select 'd1000000-0000-4000-8000-000000000003', id, 'b1000000-0000-4000-8000-000000000002'
from public.organizational_areas where code in ('PRD', 'CC');

select pg_temp.login_as('b1000000-0000-4000-8000-000000000005');
select is(public.register_change_request('c1000000-0000-4000-8000-000000000003', 'desviacion', 'DEV-2026-0017',
    'Agregar control de temperatura de la fase oleosa cada 10 minutos', 'No afecta lotes en curso', true) ->> 'parent_review',
  'pendiente', 'RF-100: un cambio técnico en un formato marca la revisión del procedimiento padre');
select set_config('t.v4', (select id::text from public.document_versions where document_id = 'c1000000-0000-4000-8000-000000000003' and version_no = 4), false);
select lives_ok($$ select public.save_document_draft(pg_temp.v('v4'),
    '{"objetivo": "Registrar la fabricación del lote.", "responsables": "Auxiliar de producción.", "desarrollo": "1. Medir la temperatura de la fase oleosa cada 10 min (70–75 °C).", "documentos_relacionados": "PRD-PR-003", "control_cambios": "Versión 04: control de temperatura."}');
    select public.submit_for_standardization(pg_temp.v('v4')) $$, 'el master redacta la versión 04 del formato');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000002');
select public.run_style_check(pg_temp.v('v4'));
select is(public.request_document_code(pg_temp.v('v4')) ->> 'code', 'MTO-PR-003-FR-01', 'una modificación conserva el código');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000005');
select public.submit_for_review(pg_temp.v('v4'), 'Clave-Prueba-2026');
select throws_like($$ select public.approve_document(pg_temp.v('v4'), 'Clave-Prueba-2026') $$, '%INVALID_TRANSITION%',
  'el master no aprueba lo que creó (ni se salta la revisión)');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000003');
select public.review_document(pg_temp.v('v4'), 'Clave-Prueba-2026');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000004');
select public.approve_document(pg_temp.v('v4'), 'Clave-Prueba-2026');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000002');
select throws_like($$ select public.publish_document(pg_temp.v('v4')) $$, '%PARENT_DOCUMENT_REVIEW_REQUIRED%MTO-PR-003%',
  'AC-30: no se publica sin revisar el procedimiento padre');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000003');
select lives_ok($$ select public.set_parent_review((select change_request_id from public.document_versions where id = pg_temp.v('v4')),
    'sin_cambio', 'El procedimiento MTO-PR-003 no requiere cambios') $$, 'calidad registra la revisión del padre');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000002');
select throws_like($$ select public.publish_document(pg_temp.v('v4')) $$, '%RECALL_PENDING%',
  'RF-96: no se publica sin recoger las copias de la versión anterior');
select lives_ok($$ select public.recall_copy(id, 'Copia v03 recogida') from public.document_distribution
                   where version_id = 'd1000000-0000-4000-8000-000000000003' $$, 'se recogen las copias de la v03');
select lives_ok($$ select public.publish_document(pg_temp.v('v4')) $$, 'la versión 04 queda vigente');
reset role;
select is((select status from public.document_versions where id = 'd1000000-0000-4000-8000-000000000003'), 'obsoleto',
  'RF-95: al publicar, la versión anterior pasa a obsoleta');
select is((select status from public.document_change_requests where id = (select change_request_id from public.document_versions where id = pg_temp.v('v4'))),
  'cerrada', 'RF-100: la solicitud se cierra cuando la versión nueva queda vigente');

-- =====================================================================
-- D. Edición maestra de plantillas (RF-05, AC-20)
-- =====================================================================
select pg_temp.fixture_doc('c1000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000005', 'MTO-PR-004-FR-01', 'FR', 'MTO',
  'b1000000-0000-4000-8000-000000000002', 'vigente', 2, 'MTO-PR-004');
update public.stage_definitions set governing_document_id = 'c1000000-0000-4000-8000-000000000005' where code = 'envase';
insert into public.process_templates (id, stage_id, document_version_id)
values ('e1000000-0000-4000-8000-000000000005', (select id from public.stage_definitions where code = 'envase'), 'd1000000-0000-4000-8000-000000000005');
insert into public.process_template_steps (template_id, order_no, label, text)
values ('e1000000-0000-4000-8000-000000000005', 1, '1', 'Verificar el despeje de la línea de envase');
update public.process_templates set locked_at = now(), status = 'aprobada' where id = 'e1000000-0000-4000-8000-000000000005';

select pg_temp.login_as('b1000000-0000-4000-8000-000000000005');
select throws_like($$ select public.save_template_draft('envase', 'd1000000-0000-4000-8000-000000000005',
    '[{"text": "Paso cambiado"}]', 'Cambio directo') $$, '%RECORD_LOCKED%', 'AC-20: el master no edita una versión aprobada');
select throws_like($$ select public.save_template_draft('envase', null, '[{"text": "Paso"}]', '') $$, '%REASON_REQUIRED%',
  'RF-05: cada cambio exige motivo');
select is(public.save_template_draft('envase', null,
    '[{"label": "1", "text": "Verificar el despeje de la línea de envase", "checklist_item": true},
      {"label": "2", "text": "Registrar el peso neto cada 30 min", "params": [{"name": "Peso neto", "unit": "g", "min": 197, "max": 203, "frequency": "cada 30 min"}], "requires_verification": true}]',
    'SC-2026-0009 · control de peso') ->> 'version_no', '3', 'RF-05: el master crea la versión 03 en borrador');
reset role;
select is((select status from public.document_versions where document_id = 'c1000000-0000-4000-8000-000000000005' and version_no = 3),
  'preliminar', 'la versión nueva nace en borrador y sigue el flujo del SGD');
select pg_temp.login_as('b1000000-0000-4000-8000-000000000001');
select throws_like($$ select public.save_template_draft('envase', null, '[{"text": "Paso"}]', 'x') $$, '%FORBIDDEN_ROLE%',
  'solo el master (o el autor asignado) edita plantillas');
reset role;
select throws_like($$ update public.process_template_steps set text = 'x' where template_id = 'e1000000-0000-4000-8000-000000000005' $$,
  '%RECORD_LOCKED%', 'los pasos de una plantilla aprobada no se modifican ni desde la base');

-- =====================================================================
-- E. Anulación con recolección de copias (RF-99, AC-32)
-- =====================================================================
select pg_temp.fixture_doc('c1000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000006', 'TH-PR-002-FR-04', 'FR', 'TH',
  'b1000000-0000-4000-8000-000000000002', 'vigente', 1, 'TH-PR-002');
insert into public.document_distribution (version_id, area_id, delivered_by, recalled_at, recalled_by)
select 'd1000000-0000-4000-8000-000000000006', a.id, 'b1000000-0000-4000-8000-000000000002',
       case when a.code <> 'ADM' then now() end, case when a.code <> 'ADM' then 'b1000000-0000-4000-8000-000000000002'::uuid end
from public.organizational_areas a where a.code in ('ADM', 'PRD', 'CC', 'GLG');

select pg_temp.login_as('b1000000-0000-4000-8000-000000000001');
select throws_like($$ select public.request_document('anulacion', 'c1000000-0000-4000-8000-000000000006', null, null, null, null, 'Ya no se usa') $$,
  '%FORBIDDEN_ROLE%', 'RF-99: la anulación la solicita un jefe de área');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000006');
select set_config('t.an', (public.request_document('anulacion', 'c1000000-0000-4000-8000-000000000006', null, null, null, null,
  'El control de visitas pasa a un sistema externo') ->> 'annulment_id'), false);
select throws_like($$ select public.decide_annulment(pg_temp.v('an'), 'aprobada', 'Viable', 'Clave-Prueba-2026') $$,
  '%FORBIDDEN_ROLE%', 'la viabilidad la decide aq_dir');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000003');
select is(public.decide_annulment(pg_temp.v('an'), 'aprobada', 'Anulación viable', 'Clave-Prueba-2026') ->> 'copies_to_recall', '1',
  'aq_dir aprueba la anulación; queda una copia por recoger');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000002');
select throws_like($$ select public.close_annulment(pg_temp.v('an'), 'Cierre') $$, '%RECALL_PENDING%Administrativ%',
  'AC-32: no se cierra la anulación sin recoger la copia de Administrativo');
select lives_ok($$ select public.recall_copy(id, 'Copia de Administrativo recogida') from public.document_distribution
                   where version_id = 'd1000000-0000-4000-8000-000000000006' and recalled_at is null;
                   select public.close_annulment(pg_temp.v('an'), 'Copias recogidas y archivo actualizado') $$,
  'recogida la última copia, la anulación se cierra');
select is(public.log_document_download('d1000000-0000-4000-8000-000000000006') ->> 'copy_type', 'obsoleto',
  'RF-103: un anulado siempre se descarga con la marca OBSOLETO');
reset role;
select is((select status from public.controlled_documents where id = 'c1000000-0000-4000-8000-000000000006'), 'anulado', 'vigente → anulado');

-- =====================================================================
-- F. Congelación de versión (AC-19, RF-101)
-- =====================================================================
select pg_temp.login_as('b1000000-0000-4000-8000-000000000001');
select throws_like($$ select public.assert_document_effective(array['d1000000-0000-4000-8000-000000000006'::uuid]) $$,
  '%DOCUMENT_NOT_EFFECTIVE%', 'RF-99: un documento anulado no se usa en lotes nuevos');
select throws_like($$ select public.assert_document_effective(array['d1000000-0000-4000-8000-000000000002'::uuid]) $$,
  '%DOCUMENT_NOT_EFFECTIVE%', 'AC-19: una versión no vigente no se toma en una OP');
select is(public.assert_document_effective(array[pg_temp.v('v1'), pg_temp.v('v4')]) ->> 'ok', 'true', 'las versiones vigentes sí');
reset role;

-- =====================================================================
-- G. Capacitación (RF-97, AC-25, AC-31)
-- =====================================================================
-- D-19: la regla se activa para probar AC-25 (por defecto solo avisa).
update public.app_settings set value = '"bloquear"' where key = 'training_enforcement';
select pg_temp.login_as('b1000000-0000-4000-8000-000000000001');
select throws_like($$ select public.assign_training(pg_temp.v('v1'), array['b1000000-0000-4000-8000-000000000001'::uuid], '2026-10-12') $$,
  '%FORBIDDEN_ROLE%', 'la capacitación la asigna aq_doc');
select throws_like($$ select public.assert_training(pg_temp.v('v1')) $$, '%TRAINING_REQUIRED%',
  'AC-25: no ejecuta un paso regido por una versión que no ha aprobado (regla activa)');
reset role;
select pg_temp.login_as('b1000000-0000-4000-8000-000000000002');
select set_config('t.tr', public.assign_training(pg_temp.v('v1'), array['b1000000-0000-4000-8000-000000000001'::uuid,
  'b1000000-0000-4000-8000-000000000006'::uuid], '2026-10-12',
  (select jsonb_agg(jsonb_build_object('q', 'Pregunta ' || g, 'options', '["Sí", "No"]'::jsonb, 'answer', 0)) from generate_series(1, 20) g))::text, false);
reset role;
select ok(not exists (select 1 from public.document_trainings t, jsonb_array_elements(t.questions) q where t.id = pg_temp.v('tr') and q ? 'answer'),
  'las preguntas publicadas no traen la respuesta');
select pg_temp.login_as('b1000000-0000-4000-8000-000000000001');
select is(public.register_training_attempt(pg_temp.v('tr'), array(select case when g <= 14 then 0 else 1 end from generate_series(1, 20) g)) ->> 'code',
  'TRAINING_NOT_PASSED', 'AC-31: con 70 % no aprueba');
select ok((select certificate_code is null and score = 70 from public.training_attempts where training_id = pg_temp.v('tr') and attempt_no = 1),
  'AC-31: el intento con 70 % queda registrado sin constancia');
select matches(public.register_training_attempt(pg_temp.v('tr'), array(select case when g <= 17 then 0 else 1 end from generate_series(1, 20) g)) ->> 'certificate_code',
  '^CT-2026-[0-9]{4}$', 'AC-31: con 85 % se emite la constancia');
select is(public.assert_training(pg_temp.v('v1')) ->> 'ok', 'true', 'aprobada la capacitación, puede ejecutar');
reset role;
update public.app_settings set value = '"avisar"' where key = 'training_enforcement';
select is(public.assert_training(pg_temp.v('v1'), 'b1000000-0000-4000-8000-000000000006') ->> 'warning',
  'Capacitación de ' || (select code from public.controlled_documents d join public.document_versions v on v.document_id = d.id where v.id = pg_temp.v('v1')) || ' v01 pendiente',
  'D-19: en modo «avisar» solo advierte');

select * from finish();
rollback;
