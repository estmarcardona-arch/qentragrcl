-- E1 · Identidad: perfiles, roles con vigencia, firma corta (DI-11), configuración y RLS por rol.
begin;
select plan(19);

select has_type('public', 'app_role', 'existe el tipo app_role');
select is(
  (select count(*)::int from unnest(enum_range(null::public.app_role))),
  15, 'los 15 roles del PRD 2.1'
);

-- Firma corta: inicial del primer nombre, punto y primer apellido.
select is(public.short_signature_of('Lucía Barrera'), 'L. Barrera', 'firma corta simple');
select is(public.short_signature_of('Dr. Esteban Gaviria'), 'E. Gaviria', 'firma corta sin tratamiento');
select is(public.short_signature_of('  diego   Cárdenas '), 'D. Cárdenas', 'firma corta con espacios y minúscula');

-- Usuarios de prueba (el trigger crea perfil y firma corta).
select pg_temp.test_user('diego@prueba.test', 'Diego Cárdenas', array['prod_aux']::public.app_role[]);
select pg_temp.test_user('admin@prueba.test', 'Tomás Herrera', array['admin']::public.app_role[]);
select pg_temp.test_user('comercial@prueba.test', 'Camila Ortega', array['comercial']::public.app_role[]);
select pg_temp.test_user('aud@prueba.test', 'Inés Valencia', array['auditor']::public.app_role[]);

select is(
  (select sr.short_signature from public.signature_registry sr join public.profiles p on p.id = sr.user_id
   where p.email = 'diego@prueba.test'),
  'D. Cárdenas', 'crear el usuario crea su perfil y su firma corta'
);

-- Vigencia: un rol vencido no está activo.
update public.user_roles set granted_at = now() - interval '2 days', expires_at = now() - interval '1 day'
where user_id = (select id from public.profiles where email = 'aud@prueba.test');
select is(
  public.user_active_roles((select id from public.profiles where email = 'aud@prueba.test')),
  '{}'::public.app_role[], 'un rol vencido no cuenta como activo'
);
select is(
  public.user_active_roles((select id from public.profiles where email = 'diego@prueba.test')),
  array['prod_aux']::public.app_role[], 'roles activos del usuario'
);

-- RLS: anon no lee perfiles.
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon no puede leer perfiles');
reset role;

-- Diego: lee perfiles, solo sus roles; no modifica configuración; no puede escribir roles.
select pg_temp.login_as((select id from public.profiles where email = 'diego@prueba.test'));
select ok((select count(*) from public.profiles) >= 4, 'authenticated lee los perfiles');
select is((select count(*)::int from public.user_roles), 1, 'un usuario solo ve sus propios roles');
select is(public.has_role('prod_aux'), true, 'has_role reconoce su rol');
update public.app_settings set value = '99' where key = 'session_idle_minutes';
select is((public.get_setting('session_idle_minutes'))::int, 15, 'un no administrador no cambia la configuración');
select throws_ok($$ insert into public.user_roles (user_id, role) values (auth.uid(), 'dt') $$, '42501', null,
  'un usuario no puede asignarse roles');
select is((public.get_my_context() ->> 'short_signature'), 'D. Cárdenas', 'get_my_context devuelve la firma corta');
reset role;

-- Administrador: ve todos los roles y puede cambiar la configuración (queda en bitácora).
select pg_temp.login_as((select id from public.profiles where email = 'admin@prueba.test'));
select ok((select count(*) from public.user_roles) >= 4, 'el administrador ve todos los roles');
update public.app_settings set value = '20' where key = 'session_idle_minutes';
reset role;
select is((public.get_setting('session_idle_minutes'))::int, 20, 'el administrador cambia la configuración');
select is(
  (select count(*)::int from public.audit_log where table_name = 'app_settings' and action = 'update'
     and actor_id = (select id from public.profiles where email = 'admin@prueba.test')),
  1, 'el cambio de configuración queda en la bitácora con su autor'
);

-- La bitácora: comercial no la lee (PRD 2.2).
select pg_temp.login_as((select id from public.profiles where email = 'comercial@prueba.test'));
select is((select count(*)::int from public.audit_log), 0, 'comercial no lee la bitácora');
reset role;

select * from finish();
rollback;
