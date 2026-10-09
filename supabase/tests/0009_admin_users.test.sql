-- E2 · Usuarios y roles (RF-03), auditor vencido (AC-11), combinaciones prohibidas (D-18, SOD-7, SOD-9),
-- desactivación y política de contraseñas.
begin;
select plan(27);

select pg_temp.test_user('admin@p.test', 'Tomás Herrera', '{admin}', p_id => 'a0000000-0000-4000-8000-000000000001');
select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'a0000000-0000-4000-8000-000000000002');
select pg_temp.test_user('ines@p.test', 'Inés Valencia', '{}', p_id => 'a0000000-0000-4000-8000-000000000003');
select pg_temp.test_user('gabriela@p.test', 'Gabriela Torres', '{}', p_id => 'a0000000-0000-4000-8000-000000000004');

-- Un no administrador no administra.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000002'); -- Diego
select throws_like($$ select * from public.admin_list_users() $$, '%FORBIDDEN_ROLE%', 'RF-03: solo el administrador lista usuarios');
select throws_like($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000002', 'dt', null, 'x') $$,
  '%FORBIDDEN_ROLE%', 'RF-03: un usuario no se asigna roles');
reset role;

select pg_temp.login_as('a0000000-0000-4000-8000-000000000001'); -- Tomás
select ok((select count(*) from public.admin_list_users()) >= 4, 'RF-03: el administrador lista los usuarios');
select is((select jsonb_array_length(roles) from public.admin_list_users() where email = 'diego@p.test'), 1,
  'el listado muestra los roles vigentes');

-- Auditor: vencimiento obligatorio y futuro.
select throws_like($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000003', 'auditor', null, 'Auditoría externa') $$,
  '%INVALID_FIELD%', 'RF-03: el acceso de auditor exige fecha de vencimiento');
select throws_like($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000003', 'auditor', now() - interval '1 day', 'Auditoría') $$,
  '%INVALID_FIELD%', 'la fecha de vencimiento debe ser futura');
select throws_like($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000003', 'auditor', now() + interval '30 days', '') $$,
  '%REASON_REQUIRED%', 'asignar un rol exige motivo');
select lives_ok($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000003', 'auditor', now() + interval '30 days', 'Auditoría externa de octubre') $$,
  'RF-03: el administrador da acceso de auditor con vencimiento');
select throws_like($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000003', 'auditor', now() + interval '60 days', 'otra vez') $$,
  '%INVALID_TRANSITION%', 'no se duplica un rol vigente');
reset role;

-- AC-11: un auditor vencido no tiene acceso (sin roles activos; get_my_context informa el vencimiento).
update public.user_roles set granted_at = now() - interval '40 days', expires_at = now() - interval '1 minute'
where user_id = 'a0000000-0000-4000-8000-000000000003';
select is(public.user_active_roles('a0000000-0000-4000-8000-000000000003'), '{}'::text[],
  'AC-11: un auditor vencido no tiene roles activos');
select pg_temp.login_as('a0000000-0000-4000-8000-000000000003');
select ok((public.get_my_context() ->> 'access_expired_at') is not null and jsonb_array_length(public.get_my_context() -> 'roles') = 0,
  'AC-11: el contexto informa el vencimiento y ningún rol (el inicio de sesión lo rechaza)');
select is(public.has_role('auditor'), false, 'AC-11: el auditor vencido no pasa las guardas de rol');
reset role;

-- Ampliar el acceso del auditor.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.admin_set_role_expiry((select id from public.user_roles where user_id = 'a0000000-0000-4000-8000-000000000003'),
       now() + interval '15 days', 'Ampliación solicitada por Calidad') $$,
  'el administrador amplía el acceso del auditor');
reset role;
select is(public.user_active_roles('a0000000-0000-4000-8000-000000000003'), array['auditor']::text[],
  'ampliado, el auditor vuelve a tener acceso');

-- Combinaciones prohibidas.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000004', 'master', null, 'Edición maestra') $$,
  'RF-03: se asigna el rol especial master');
select throws_like($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000004', 'admin', null, 'x') $$,
  '%ROLE_INCOMPATIBLE: D-18%', 'D-18: master y admin son roles separados');
select throws_like($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000004', 'prod_aux', null, 'x') $$,
  '%ROLE_INCOMPATIBLE: SOD-9%', 'SOD-9: master no recibe un rol de ejecución');
select throws_like($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000001', 'cc_jefe', null, 'x') $$,
  '%ROLE_INCOMPATIBLE: SOD-7%', 'SOD-7: el administrador no recibe un rol que firma calidad');
select lives_ok($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000003', 'aq_doc', null, 'Gestión documental') $$,
  'RF-03: se asigna el rol especial aq_doc');

-- Revocación, desactivación y sus límites.
select throws_like(
  $$ select public.admin_revoke_role((select id from public.user_roles where user_id = 'a0000000-0000-4000-8000-000000000001' and role = 'admin'), 'x') $$,
  '%FORBIDDEN_ROLE%', 'el administrador no se quita su propio rol');
select throws_like($$ select public.admin_set_user_active('a0000000-0000-4000-8000-000000000001', false, 'x') $$,
  '%FORBIDDEN_ROLE%', 'el administrador no se desactiva a sí mismo');
select lives_ok($$ select public.admin_set_user_active('a0000000-0000-4000-8000-000000000002', false, 'Retiro de la empresa') $$,
  'RF-03: el administrador desactiva un usuario');
reset role;
select is((select active from public.profiles where id = 'a0000000-0000-4000-8000-000000000002'), false,
  'el usuario queda inactivo (no se borra)');
select is(public.user_active_roles('a0000000-0000-4000-8000-000000000002'), '{}'::text[],
  'un usuario inactivo no tiene roles activos');
select ok(
  (select count(*) from public.audit_log where table_name = 'user_roles' and reason = 'Auditoría externa de octubre') = 1,
  'RF-03: toda asignación de rol queda en la bitácora con su motivo'
);

-- Política de contraseñas (mínimo 12, sin reutilizar la actual).
select pg_temp.login_as('a0000000-0000-4000-8000-000000000004'); -- Gabriela (clave de prueba: Clave-Prueba-2026)
select is((public.check_password_policy('corta') ->> 'ok')::boolean, false, 'una contraseña de menos de 12 caracteres se rechaza');
select ok((public.check_password_policy('Clave-Prueba-2026') -> 'errors')::text like '%actual%',
  'no se puede reutilizar la contraseña actual');
reset role;

select * from finish();
rollback;
