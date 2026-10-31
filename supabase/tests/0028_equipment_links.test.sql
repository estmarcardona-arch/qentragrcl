-- E6 · ajustes (PRD 1.11, RF-50, AC-44, D-64): el certificado o informe del proveedor se registra como archivo o como enlace
-- verificable; la calibración y la calificación exigen al menos uno (AC-44).
begin;
select plan(9);

select pg_temp.test_user('hernan@p.test', 'Hernán Salgado', '{bodega_jefe}', p_id => 'bb000000-0000-4000-8000-000000000001');
select pg_temp.test_user('lucia@p.test', 'Lucía Barrera', '{aq_dir}', p_id => 'bb000000-0000-4000-8000-000000000002');

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$ select current_setting('t.' || p_key)::uuid $$;

insert into app_private.test_clock (now_override) values ('2026-10-05 10:00-05');

select pg_temp.login_as('bb000000-0000-4000-8000-000000000001');
select set_config('t.eq', public.save_equipment(null, '{"code": "BAL-915", "name": "Balanza de prueba", "equipment_type": "balanza",
  "critical": true}')::text, false);
select throws_like($$ select public.record_equipment_event(pg_temp.v('eq'), 'calibracion',
    '{"performed_on": "2026-10-02", "result": "conforme", "due_on": "2027-10-02"}', 'Clave-Prueba-2026') $$,
  '%INVALID_FIELD%certificado o el enlace%', 'AC-44: la calibración exige el certificado o el enlace del proveedor');
select throws_like($$ select public.record_equipment_event(pg_temp.v('eq'), 'calibracion',
    '{"performed_on": "2026-10-02", "result": "conforme", "due_on": "2027-10-02", "links": [{"url": "ftp://x"}]}', 'Clave-Prueba-2026') $$,
  '%INVALID_FIELD%dirección web válida%', 'el enlace debe ser http o https');
select is((public.record_equipment_event(pg_temp.v('eq'), 'calibracion',
    '{"performed_on": "2026-10-02", "result": "conforme", "due_on": "2027-10-02",
      "links": [{"url": "https://metrologia.test/certificados/CAL-915", "label": "Certificado CAL-915"}]}', 'Clave-Prueba-2026')
    ->> 'ok'), 'true', 'D-64: la calibración se registra con el enlace del proveedor');
select throws_like($$ select public.record_equipment_event(pg_temp.v('eq'), 'uso',
    '{"performed_on": "2026-10-04", "batch_ref": "L-1", "links": [{"url": "https://x.test"}]}', 'Clave-Prueba-2026') $$,
  '%INVALID_FIELD%uso no lleva adjuntos%', 'el uso no lleva adjuntos');
reset role;
select is((select url || ' · ' || file_name || ' · ' || coalesce(sha256, 'sin huella') from public.equipment_attachments
           where equipment_id = pg_temp.v('eq')),
  'https://metrologia.test/certificados/CAL-915 · Certificado CAL-915 · sin huella', 'el enlace queda con su etiqueta y sin huella');
select is((select calibration_due from public.v_equipment_status where id = pg_temp.v('eq')), '2027-10-02'::date,
  'la calibración con enlace cuenta para la vigencia');

select pg_temp.login_as('bb000000-0000-4000-8000-000000000002');
select throws_like($$ select public.record_equipment_event(pg_temp.v('eq'), 'calificacion',
    '{"performed_on": "2026-06-30", "result": "conforme", "due_on": "2027-06-30"}', 'Clave-Prueba-2026') $$,
  '%INVALID_FIELD%certificado o el enlace%', 'AC-44: la calificación también exige el informe o el enlace');
reset role;

select throws_like($$ insert into public.equipment_attachments (equipment_id, file_name) values (pg_temp.v('eq'), 'nada') $$,
  '%equipment_attachments_file_or_url%', 'un adjunto es archivo con huella o enlace, nunca ninguno');
select throws_like($$ update public.equipment_attachments set url = 'https://otro.test' where equipment_id = pg_temp.v('eq') $$,
  '%', 'los adjuntos no se modifican');

delete from app_private.test_clock;
select * from finish();
rollback;
