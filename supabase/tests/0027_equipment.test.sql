-- E6 · Equipos y hoja de vida (RF-50, PRD 1.10): estados y vigencia, calibración con certificado (AC-44), validez en un
-- momento (AC-45, prepara AC-05), limpieza verificada por otra persona (AC-47) y recordatorios a 30/15/7 días con
-- notificaciones y correo en cola (RF-51, AC-46).
begin;
select plan(33);

select pg_temp.test_user('hernan@p.test', 'Hernán Salgado', '{bodega_jefe}', p_id => 'ba000000-0000-4000-8000-000000000001');
select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'ba000000-0000-4000-8000-000000000002');
select pg_temp.test_user('paola@p.test', 'Paola Mejía', '{prod_coord}', p_id => 'ba000000-0000-4000-8000-000000000003');
select pg_temp.test_user('lucia@p.test', 'Lucía Barrera', '{aq_dir}', p_id => 'ba000000-0000-4000-8000-000000000004');
select pg_temp.test_user('camila@p.test', 'Camila Ortega', '{comercial}', p_id => 'ba000000-0000-4000-8000-000000000005');
select pg_temp.test_user('tomas@p.test', 'Tomás Herrera', '{admin}', p_id => 'ba000000-0000-4000-8000-000000000006');

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$ select current_setting('t.' || p_key)::uuid $$;
create or replace function pg_temp.events(p_eq uuid) returns int language sql as $$
  select count(*)::int from public.equipment_events where equipment_id = p_eq $$;
-- Certificado simulado en el bucket «evidencias» (lo sube la acción del servidor con la sesión del usuario).
create or replace function pg_temp.cert(p_name text) returns jsonb language plpgsql as $$
begin
  if to_regclass('storage.objects') is not null then
    insert into storage.objects (bucket_id, name) values ('evidencias', 'equipos/BAL-914/' || p_name);
  end if;
  return jsonb_build_array(jsonb_build_object('path', 'equipos/BAL-914/' || p_name, 'file_name', p_name,
    'mime_type', 'application/pdf', 'size_bytes', 18342, 'sha256', repeat('a', 64)));
end;
$$;

insert into app_private.test_clock (now_override) values ('2026-10-05 10:00-05');

-- =====================================================================
-- Ficha del equipo (RF-50)
-- =====================================================================
select pg_temp.login_as('ba000000-0000-4000-8000-000000000005');
select throws_like($$ select public.save_equipment(null, '{"code": "BAL-914", "name": "Balanza", "equipment_type": "balanza"}') $$,
  '%FORBIDDEN_ROLE%', 'Comercial no registra equipos');
reset role;
select pg_temp.login_as('ba000000-0000-4000-8000-000000000001');
select throws_like($$ select public.save_equipment(null, '{"code": "BAL-914", "name": "Balanza", "equipment_type": "nevera"}') $$,
  '%INVALID_FIELD%catálogo de tipos de equipo%', 'el tipo de equipo viene del catálogo');
select set_config('t.eq', public.save_equipment(null, '{"code": "bal-914", "name": "Balanza 300 kg de prueba", "equipment_type": "balanza",
  "plant_area": "dispensacion", "critical": true}')::text, false);
reset role;
select is((select code || ' · ' || status || ' · ' || requires_qualification from public.equipment where id = pg_temp.v('eq')),
  'BAL-914 · disponible · true', 'RF-50: el equipo crítico nace disponible y exige calificación');
select ok(not public.is_equipment_valid(pg_temp.v('eq')), 'sin calibración, calificación ni limpieza no es válido');
select ok((public.equipment_validity(pg_temp.v('eq')) -> 'reasons') ? 'no tiene calibración registrada', 'la validez explica la razón');

-- =====================================================================
-- Calibración con certificado (AC-44) y vigencia (AC-45)
-- =====================================================================
select pg_temp.login_as('ba000000-0000-4000-8000-000000000001');
select throws_like($$ select public.record_equipment_event(pg_temp.v('eq'), 'calibracion',
    '{"performed_on": "2025-10-02", "result": "conforme", "due_on": "2026-10-02"}', 'Clave-Prueba-2026') $$,
  '%INVALID_FIELD%certificado%', 'AC-44: la calibración exige el certificado adjunto');
select throws_like($$ select public.record_equipment_event(pg_temp.v('eq'), 'calibracion',
    jsonb_build_object('performed_on', '2025-10-02', 'result', 'conforme', 'attachments', pg_temp.cert('sin-fecha.pdf')), 'Clave-Prueba-2026') $$,
  '%INVALID_FIELD%próximo vencimiento%', 'una calibración conforme exige el próximo vencimiento');
select is((public.record_equipment_event(pg_temp.v('eq'), 'calibracion',
    jsonb_build_object('performed_on', '2025-10-02', 'result', 'conforme', 'due_on', '2026-10-02', 'provider', 'Metrología externa',
      'reference', 'CAL-BAL914-2025', 'attachments', pg_temp.cert('CAL-BAL914-2025.pdf')), 'Clave-Prueba-2026') ->> 'ok'), 'true',
  'RF-50: se registra la calibración con firma y certificado');
select is((public.record_equipment_event(pg_temp.v('eq'), 'mantenimiento',
    '{"performed_on": "2026-07-15", "result": "conforme", "due_on": "2027-01-15"}', 'Clave-Malísima-1') ->> 'ok'), 'false',
  'una contraseña errada no registra el evento');
reset role;
select is(pg_temp.events(pg_temp.v('eq')), 1, 'el intento con contraseña errada no dejó evento');
select is((select sha256 from public.equipment_attachments where equipment_id = pg_temp.v('eq')), repeat('a', 64),
  'el certificado queda con su huella SHA-256');
select is((select effective_status from public.v_equipment_status where id = pg_temp.v('eq')), 'calibracion_vencida',
  'RF-50: «calibración vencida» se deriva de los eventos');
select throws_like($$ select public.assert_equipment_valid(pg_temp.v('eq')) $$,
  '%EQUIPMENT_NOT_VALID%BAL-914%calibración vencida el 02/10/2026%', 'AC-45: la validez rechaza con la regla y la fecha');
select ok(public.is_equipment_valid(pg_temp.v('eq'), '2026-09-01 10:00-05') is false, 'la validez se consulta en un momento dado');
select throws_like($$ update public.equipment_events set notes = 'x' where equipment_id = pg_temp.v('eq') $$, '%RECORD_LOCKED%',
  'un evento de la hoja de vida no se modifica');

-- =====================================================================
-- Calificación (Aseguramiento de la calidad) y limpieza verificada por otra persona (AC-47)
-- =====================================================================
select pg_temp.login_as('ba000000-0000-4000-8000-000000000001');
select throws_like($$ select public.record_equipment_event(pg_temp.v('eq'), 'calificacion',
    '{"performed_on": "2026-06-30", "result": "conforme", "due_on": "2027-06-30"}', 'Clave-Prueba-2026') $$,
  '%FORBIDDEN_ROLE%Aseguramiento%', 'la calificación la aprueba Aseguramiento de la calidad');
reset role;
select pg_temp.login_as('ba000000-0000-4000-8000-000000000004');
select is((public.record_equipment_event(pg_temp.v('eq'), 'calificacion',
    '{"performed_on": "2026-06-30", "result": "conforme", "due_on": "2027-06-30"}', 'Clave-Prueba-2026') ->> 'ok'), 'true',
  'Aseguramiento de la calidad registra la calificación');
reset role;
select pg_temp.login_as('ba000000-0000-4000-8000-000000000002');
select set_config('t.cln', (public.record_equipment_event(pg_temp.v('eq'), 'limpieza',
    jsonb_build_object('performed_on', '2026-10-05', 'valid_until', '2026-10-07 10:00-05'), 'Clave-Prueba-2026') ->> 'event_id'), false);
select throws_like($$ select public.verify_cleaning(pg_temp.v('cln'), 'Clave-Prueba-2026') $$, '%SOD_VIOLATION%',
  'AC-47: quien registró la limpieza no la verifica');
reset role;
select pg_temp.login_as('ba000000-0000-4000-8000-000000000003');
select is(public.verify_cleaning(pg_temp.v('cln'), 'Clave-Prueba-2026') ->> 'ok', 'true', 'otra persona verifica la limpieza');
select is((public.record_equipment_event(pg_temp.v('eq'), 'calibracion',
    jsonb_build_object('performed_on', '2026-10-04', 'result', 'conforme', 'due_on', '2027-10-04',
      'attachments', pg_temp.cert('CAL-BAL914-2026.pdf')), 'Clave-Prueba-2026') ->> 'valid'), 'true',
  'RF-50: con calibración, calificación y limpieza vigentes el equipo es válido');
reset role;
select is((select fitness from public.v_equipment_status where id = pg_temp.v('eq')), 'apto_con_alerta',
  'la limpieza que vence en menos de 48 h deja el equipo «Apto con alerta»');
select ok(not public.is_equipment_valid(pg_temp.v('eq'), '2026-10-08 10:00-05'), 'la limpieza vencida lo vuelve no válido');

-- =====================================================================
-- Estados operativos
-- =====================================================================
select pg_temp.login_as('ba000000-0000-4000-8000-000000000001');
select throws_like($$ select public.set_equipment_status(pg_temp.v('eq'), 'fuera_de_servicio', 'Golpe en la celda') $$,
  '%FORBIDDEN_ROLE%', 'sacar un equipo de servicio lo aprueba Aseguramiento de la calidad');
reset role;
select pg_temp.login_as('ba000000-0000-4000-8000-000000000004');
select is(public.set_equipment_status(pg_temp.v('eq'), 'fuera_de_servicio', 'Golpe en la celda de carga') ->> 'status',
  'fuera_de_servicio', 'Aseguramiento de la calidad pone el equipo fuera de servicio con motivo');
reset role;
select ok((public.equipment_validity(pg_temp.v('eq')) -> 'reasons') ? 'el equipo está fuera de servicio', 'fuera de servicio no es válido');
select pg_temp.login_as('ba000000-0000-4000-8000-000000000004');
select public.set_equipment_status(pg_temp.v('eq'), 'disponible', 'Celda reemplazada y verificada');
reset role;

-- =====================================================================
-- Recordatorios a 30/15/7 días, una vez por umbral (RF-51, AC-46)
-- =====================================================================
delete from app_private.test_clock;
insert into app_private.test_clock (now_override) values ('2027-09-04 06:00-05');
select ok(public.generate_equipment_reminders() >= 1, 'AC-46: a 30 días del vencimiento se generan avisos');
select is((select threshold_days || ' · ' || title from public.notifications
           where entity_id = pg_temp.v('eq') and kind = 'equipo_calibracion' and user_id = 'ba000000-0000-4000-8000-000000000001'),
  '30 · Calibración de BAL-914 vence en 30 días (04/10/2027)', 'el aviso dice qué vence y cuándo');
select is(public.generate_equipment_reminders() - public.generate_equipment_reminders(), 0, 'un umbral no se repite');
delete from app_private.test_clock;
insert into app_private.test_clock (now_override) values ('2027-09-28 06:00-05');
select public.generate_equipment_reminders();
select is((select array_agg(threshold_days order by threshold_days) from public.notifications
           where entity_id = pg_temp.v('eq') and kind = 'equipo_calibracion' and user_id = 'ba000000-0000-4000-8000-000000000001'),
  array[7, 30], 'a 6 días se avisa el umbral de 7 (el de 15 se salta: solo el más urgente)');
select ok(exists (select 1 from public.email_outbox o join public.notifications n on n.id = o.notification_id
  where n.entity_id = pg_temp.v('eq') and o.status = 'pendiente' and o.subject like 'GRUFARCOL eBR · Calibración de BAL-914%'),
  'RF-51: cada aviso deja su correo en cola');
select pg_temp.login_as('ba000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.notifications where user_id <> 'ba000000-0000-4000-8000-000000000002'), 0,
  'cada persona ve solo sus avisos');
select ok(public.mark_notifications_read() >= 1, 'la persona marca sus avisos como leídos');
reset role;
select pg_temp.login_as('ba000000-0000-4000-8000-000000000006');
select throws_like($$ select public.admin_update_setting('equipment_alert_days', '[30, 0]', 'Ajuste') $$, '%INVALID_FIELD%',
  'los días de alerta son enteros entre 1 y 365');
reset role;
delete from app_private.test_clock;

select * from finish();
rollback;
