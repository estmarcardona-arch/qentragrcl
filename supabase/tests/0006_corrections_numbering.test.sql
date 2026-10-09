-- RF-102 · E1 · Correcciones sin borrado (DI-4, DI-12, AC-35) y numeración sin saltos (DI-9).
begin;
select plan(14);

select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'a0000000-0000-4000-8000-000000000001');
select pg_temp.test_user('camila@p.test', 'Camila Ortega', '{comercial}', p_id => 'a0000000-0000-4000-8000-000000000002');
select pg_temp.fixture_table('_t_peso', 'control_peso', p_execution => true);
insert into public.sign_permissions (table_name, meaning, role, sets_status) values ('_t_peso', 'ejecuto', 'prod_aux', 'ejecutado');
insert into public._t_peso (id, value, created_by)
values ('99000000-0000-4000-8000-000000000001', '98,2', 'a0000000-0000-4000-8000-000000000001');

select pg_temp.login_as('a0000000-0000-4000-8000-000000000001'); -- Diego
select public.sign_record('_t_peso', '99000000-0000-4000-8000-000000000001', 'ejecuto', 'Clave-Prueba-2026');

select throws_like($$ select public.record_correction('_t_peso', '99000000-0000-4000-8000-000000000001', 'value', '"98,8"', '  ') $$,
  '%REASON_REQUIRED%', 'una corrección sin motivo se rechaza');
select throws_like($$ select public.record_correction('_t_peso', '99000000-0000-4000-8000-000000000001', 'status', '"x"', 'motivo') $$,
  '%INVALID_FIELD%', 'los campos de estado y metadatos no se corrigen');

select is(
  public.record_correction('_t_peso', '99000000-0000-4000-8000-000000000001', 'value', '"98,8"',
    'Error de transcripción; la balanza imprimió 98,8 kg') ->> 'old_value',
  '98,2', 'la corrección conserva el valor anterior'
);
select throws_like($$ select public.record_correction('_t_peso', '99000000-0000-4000-8000-000000000001', 'value', '"98,8"', 'otra vez') $$,
  '%NO_CHANGE%', 'no se registra una corrección sin cambio');
select is(
  public.record_correction('_t_peso', '99000000-0000-4000-8000-000000000001', 'value', '"98,9"', 'Segunda lectura') ->> 'old_value',
  '98,8', 'el valor anterior es el de la última corrección'
);
select is(public.record_correction('_t_peso', '99000000-0000-4000-8000-000000000001', 'value', '"99,0"', 'c3') ->> 'warning', 'false', '3 correcciones: sin aviso');
select is(public.record_correction('_t_peso', '99000000-0000-4000-8000-000000000001', 'value', '"99,1"', 'c4') ->> 'warning', 'false', '4 correcciones: sin aviso');
select is(public.record_correction('_t_peso', '99000000-0000-4000-8000-000000000001', 'value', '"99,2"', 'c5') ->> 'warning', 'false', '5 correcciones: sin aviso');
select is(public.record_correction('_t_peso', '99000000-0000-4000-8000-000000000001', 'value', '"99,3"', 'c6') ->> 'warning', 'true',
  'AC-35: 6 correcciones en un registro → aviso');
reset role;

select is(
  (select value from public._t_peso where id = '99000000-0000-4000-8000-000000000001'),
  '98,2', 'el registro firmado no cambia: las correcciones se agregan aparte'
);
select throws_like($$ delete from public.corrections $$, '%RECORD_LOCKED%', 'las correcciones no se borran');

select pg_temp.login_as('a0000000-0000-4000-8000-000000000002'); -- Camila
select throws_like($$ select public.record_correction('_t_peso', '99000000-0000-4000-8000-000000000001', 'value', '"1"', 'intento') $$,
  '%FORBIDDEN_ROLE%', 'un usuario sin relación con el registro no corrige');
reset role;

-- Numeración: formato definido por calidad, consecutivo y reinicio anual (fecha de referencia).
insert into app_private.test_clock (now_override) values ('2026-12-31T23:00:00-05:00');
insert into public.numbering_sequences (key, format, description, year, last_value)
values ('_prueba_op', 'OP-{YYYY}-{NNNN}', 'Prueba', 2026, 41);
select is(public.next_number('_prueba_op'), 'OP-2026-0042', 'el consecutivo continúa sin saltos');
update app_private.test_clock set now_override = '2027-01-01T00:30:00-05:00';
select is(public.next_number('_prueba_op'), 'OP-2027-0001', 'con año en el formato, el consecutivo se reinicia');

select * from finish();
rollback;
