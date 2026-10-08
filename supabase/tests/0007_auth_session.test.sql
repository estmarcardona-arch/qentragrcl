-- E1 · Bloqueo tras intentos fallidos (hook de Auth), eventos de sesión y bitácora por registro.
begin;
select plan(11);

select pg_temp.test_user('ines@p.test', 'Inés Valencia', '{auditor}', p_id => 'a0000000-0000-4000-8000-000000000001');

-- Cuatro fallos: continúa (GoTrue responde credenciales inválidas).
select public.hook_password_verification_attempt('{"user_id":"a0000000-0000-4000-8000-000000000001","valid":false}')
from generate_series(1, 4);
select is((select failed_count from public.login_attempts where user_id = 'a0000000-0000-4000-8000-000000000001'),
  4, 'cuenta los intentos fallidos');

-- Quinto fallo: bloqueo de 15 minutos.
select public.hook_password_verification_attempt('{"user_id":"a0000000-0000-4000-8000-000000000001","valid":false}');
select ok((select locked_until > now() + interval '14 minutes' from public.login_attempts
           where user_id = 'a0000000-0000-4000-8000-000000000001'),
  'al quinto intento fallido la cuenta se bloquea 15 minutos');
select is(
  public.hook_password_verification_attempt('{"user_id":"a0000000-0000-4000-8000-000000000001","valid":true}') ->> 'decision',
  'reject', 'bloqueada, la contraseña correcta se rechaza'
);
select is(
  (select count(*)::int from public.audit_log where action = 'auth.account_locked'
     and record_id = 'a0000000-0000-4000-8000-000000000001'),
  1, 'el bloqueo queda en la bitácora'
);

-- Vencido el bloqueo, la contraseña correcta entra y se limpian los intentos.
update public.login_attempts set locked_until = now() - interval '1 minute'
where user_id = 'a0000000-0000-4000-8000-000000000001';
select is(
  public.hook_password_verification_attempt('{"user_id":"a0000000-0000-4000-8000-000000000001","valid":true}') ->> 'decision',
  'continue', 'vencido el bloqueo, la contraseña correcta entra'
);
select is_empty($$ select 1 from public.login_attempts where user_id = 'a0000000-0000-4000-8000-000000000001' $$,
  'un ingreso correcto limpia los intentos');

-- Solo Supabase Auth ejecuta el hook.
select ok(not has_function_privilege('authenticated', 'public.hook_password_verification_attempt(jsonb)', 'execute'),
  'authenticated no puede ejecutar el hook');
select ok(has_function_privilege('supabase_auth_admin', 'public.hook_password_verification_attempt(jsonb)', 'execute'),
  'supabase_auth_admin ejecuta el hook');

-- Eventos de sesión (RF-01).
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select public.log_session_event('session_expired');
select throws_like($$ select public.log_session_event('cualquiera') $$, '%INVALID_TRANSITION%',
  'solo se aceptan eventos de sesión válidos');
reset role;
select is(
  (select reason from public.audit_log where action = 'auth.session_expired'
     and actor_id = 'a0000000-0000-4000-8000-000000000001'),
  'Cierre por inactividad', 'el cierre por inactividad queda en la bitácora'
);

-- get_audit_trail reúne los cambios del registro y sus firmas.
select pg_temp.fixture_table('_t_trail', 'prueba', p_quality => false);
insert into public.sign_permissions (table_name, meaning, role) values ('_t_trail', 'reviso', 'auditor');
insert into public._t_trail (id, value) values ('77000000-0000-4000-8000-000000000001', 'x');
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select public.sign_record('_t_trail', '77000000-0000-4000-8000-000000000001', 'reviso', 'Clave-Prueba-2026');
select is(
  (select array_agg(action || ':' || table_name order by id)::text
   from public.get_audit_trail('_t_trail', '77000000-0000-4000-8000-000000000001')),
  '{insert:_t_trail,insert:signatures,update:_t_trail}',
  'la bitácora del registro incluye su creación, su firma y su bloqueo'
);
reset role;

select * from finish();
rollback;
