-- E2 · Orden de validación de la firma: un rechazo por regla no consume intentos de contraseña,
-- y una contraseña correcta reinicia el contador. practice_reauth usa el mismo contador.
begin;
select plan(7);

select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'a0000000-0000-4000-8000-000000000001');
select pg_temp.fixture_table('_t_ord', 'fabricacion', p_execution => true);
insert into public.sign_permissions (table_name, meaning, role, requires_meaning) values
  ('_t_ord', 'ejecuto', 'prod_aux', null),
  ('_t_ord', 'verifico', 'prod_aux', 'ejecuto');
insert into public._t_ord (id, value) values ('0d000000-0000-4000-8000-000000000001', 'paso');

select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select public.sign_record('_t_ord', '0d000000-0000-4000-8000-000000000001', 'ejecuto', 'Clave-Prueba-2026');

-- Un intento fallido previo.
select is(public.practice_reauth('mala') ->> 'code', 'REAUTH_FAILED', 'practice_reauth cuenta un intento fallido');

-- SOD con contraseña errónea: responde la regla, no la contraseña, y no consume intentos.
select throws_like($$ select public.sign_record('_t_ord', '0d000000-0000-4000-8000-000000000001', 'verifico', 'mala') $$,
  '%SOD_VIOLATION%', 'la segregación se informa antes de pedir la contraseña');
reset role;
select is((select failed_count from public.sign_attempts where user_id = 'a0000000-0000-4000-8000-000000000001'), 1,
  'un rechazo por regla no consume intentos');

-- Registro inexistente: tampoco consume intentos.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select throws_like($$ select public.sign_record('_t_ord', '0d000000-0000-4000-8000-000000000999', 'ejecuto', 'mala') $$,
  '%RECORD_NOT_FOUND%', 'registro inexistente: se informa sin verificar la contraseña');
select is((public.practice_reauth('mala') ->> 'remaining')::int, 1, 'el contador sigue en 1 (ahora 2 de 3)');
select is(public.practice_reauth('Clave-Prueba-2026') ->> 'ok', 'true', 'la contraseña correcta pasa la práctica');
reset role;
select is((select failed_count from public.sign_attempts where user_id = 'a0000000-0000-4000-8000-000000000001'), 0,
  'la contraseña correcta reinicia el contador (se conserva al confirmar)');

select * from finish();
rollback;
