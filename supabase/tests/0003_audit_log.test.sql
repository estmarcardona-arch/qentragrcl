-- E1 · Bitácora inmutable (DI-1, AC-08), trigger genérico y reloj de referencia.
begin;
select plan(14);

-- AC-08: modificar audit_log da permiso denegado (42501) para los roles de la API.
insert into public.audit_log (action, table_name) values ('prueba', 'prueba');

select pg_temp.login_as(pg_temp.test_user('aq@prueba.test', 'Lucía Barrera', array['aq_dir']::text[]));
select throws_ok($$ update public.audit_log set action = 'alterado' $$, '42501', null,
  'AC-08: authenticated no puede modificar audit_log');
select throws_ok($$ delete from public.audit_log $$, '42501', null,
  'AC-08: authenticated no puede borrar audit_log');
select throws_ok($$ truncate public.audit_log $$, '42501', null,
  'AC-08: authenticated no puede vaciar audit_log');
select throws_ok($$ insert into public.audit_log (action, table_name) values ('falso', 'x') $$, '42501', null,
  'AC-08: authenticated no puede insertar en audit_log directamente');
reset role;

set local role anon;
select throws_ok($$ select * from public.audit_log $$, '42501', null, 'anon no puede leer audit_log');
reset role;

-- Ni el dueño puede modificarla: el trigger lo impide.
select throws_like($$ update public.audit_log set action = 'alterado' $$, '%AUDIT_LOG_IMMUTABLE%',
  'AC-08: el dueño tampoco puede modificar audit_log');
select throws_like($$ delete from public.audit_log $$, '%AUDIT_LOG_IMMUTABLE%',
  'AC-08: el dueño tampoco puede borrar audit_log');
select throws_like($$ truncate public.audit_log $$, '%AUDIT_LOG_IMMUTABLE%',
  'AC-08: el dueño tampoco puede vaciar audit_log');

-- Trigger genérico: registra quién, qué, antes/después y motivo.
select pg_temp.fixture_table('_t_audit', 'prueba');
do $$
declare v_user uuid := (select id from public.profiles where email = 'aq@prueba.test');
begin
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  insert into public._t_audit (value) values ('original');
  perform set_config('app.audit_reason', 'Ajuste de prueba', true);
  update public._t_audit set value = 'cambiado';
  perform set_config('app.audit_reason', '', true);
end $$;

select is(
  (select count(*)::int from public.audit_log where table_name = '_t_audit'),
  2, 'el trigger registra el insert y el update'
);
select is(
  (select before ->> 'value' || '→' || (after ->> 'value') from public.audit_log
   where table_name = '_t_audit' and action = 'update'),
  'original→cambiado', 'guarda el antes y el después'
);
select is(
  (select reason from public.audit_log where table_name = '_t_audit' and action = 'update'),
  'Ajuste de prueba', 'guarda el motivo'
);
select is(
  (select actor_id from public.audit_log where table_name = '_t_audit' and action = 'insert'),
  (select id from public.profiles where email = 'aq@prueba.test'), 'guarda el actor'
);

-- Reloj de referencia: vacío en producción; las pruebas lo congelan dentro de la transacción.
select is_empty($$ select 1 from app_private.test_clock $$, 'el reloj de prueba está vacío fuera de las pruebas');
insert into app_private.test_clock (now_override) values ('2026-10-05T15:12:00Z');
select is(public.reference_now(), '2026-10-05T15:12:00Z'::timestamptz,
  'reference_now usa la fecha congelada de la prueba');

select * from finish();
rollback;
