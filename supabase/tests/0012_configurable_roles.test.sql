-- E2 · Roles configurables (PRD 2.6, RF-07): crear, configurar permisos e incompatibilidades, retirar;
-- funciones reservadas (AC-37), roles del sistema protegidos y rol en uso (AC-38), permisos efectivos (AC-36).
-- Desde 0013 cada cambio es una solicitud del administrador que aprueba Aseguramiento de calidad (D-39).
begin;
select plan(31);

select pg_temp.test_user('admin@p.test', 'Tomás Herrera', '{admin}', p_id => 'a0000000-0000-4000-8000-000000000001');
select pg_temp.test_user('ana@p.test', 'Analista Externa', '{}', p_id => 'a0000000-0000-4000-8000-000000000002');
select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'a0000000-0000-4000-8000-000000000003');
select pg_temp.test_user('lucia@p.test', 'Lucía Barrera', '{aq_dir}', p_id => 'a0000000-0000-4000-8000-000000000004');

-- Aprueba como Lucía (aq_dir) la solicitud pendiente del rol y devuelve el estado final.
create or replace function pg_temp.qa_approves(p_role text)
returns text
language sql
as $$
  select public.decide_role_change(
    (select id from public.role_change_requests where role_code = p_role and status = 'pendiente'),
    'aprobada', 'Revisado por Aseguramiento de calidad', 'Clave-Prueba-2026') ->> 'status';
$$;

-- Solo el administrador solicita.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000003');
select throws_like($$ select public.admin_request_role_change('create', 'consulta', '{"name":"Consulta"}', 'x') $$,
  '%FORBIDDEN_ROLE%', 'RF-07: un no administrador no solicita roles');
reset role;

select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select throws_like($$ select public.admin_request_role_change('create', 'Consulta Externa', '{"name":"Consulta"}', 'x') $$,
  '%INVALID_FIELD%', 'el código del rol se valida al solicitar');
select throws_like($$ select public.admin_request_role_change('create', 'consulta_trazabilidad', '{"name":"Consulta"}', '') $$,
  '%REASON_REQUIRED%', 'crear un rol exige motivo');
select lives_ok($$ select public.admin_request_role_change('create', 'consulta_trazabilidad',
    '{"name":"Consulta de trazabilidad","description":"Solo consulta trazabilidad","read_only":true}', 'Cargo de consulta para Regulatorio') $$,
  'RF-07: el administrador solicita un rol adicional');
select throws_like($$ select public.admin_request_role_change('create', 'dt', '{"name":"Otro"}', 'x') $$,
  '%INVALID%', 'no se solicita un rol con un código existente');
reset role;
select is((select count(*)::int from public.roles where code = 'consulta_trazabilidad'), 0,
  'D-39: el rol no existe mientras la solicitud está pendiente');

select pg_temp.login_as('a0000000-0000-4000-8000-000000000004');
select is(pg_temp.qa_approves('consulta_trazabilidad'), 'aprobada', 'D-39: Aseguramiento de calidad aprueba y el rol se crea');
reset role;
select is((select count(*)::int from public.module_permissions where role = 'consulta_trazabilidad'), 19,
  'el rol nace con una celda por módulo');
select is((select count(*)::int from public.module_permissions where role = 'consulta_trazabilidad' and cell_text = '—'), 19,
  'el rol nace sin permisos');

-- Configurar permisos.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select throws_like(
  $$ select public.admin_request_role_change('permissions', 'consulta_trazabilidad', '{"permissions":[{"module":"trazabilidad_auditoria","read":true,"create":true}]}', 'x') $$,
  '%INVALID_FIELD%', 'un rol de solo lectura solo admite L');
select lives_ok(
  $$ select public.admin_request_role_change('permissions', 'consulta_trazabilidad', '{"permissions":[{"module":"trazabilidad_auditoria","read":true}]}', 'Consulta de trazabilidad para Regulatorio') $$,
  'RF-07: el administrador solicita permisos por módulo');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000004');
select is(pg_temp.qa_approves('consulta_trazabilidad'), 'aprobada', 'Calidad aprueba los permisos');
reset role;
select is((select cell_text from public.module_permissions where role = 'consulta_trazabilidad' and module_code = 'trazabilidad_auditoria'),
  'L', 'el permiso aprobado queda en la matriz');

select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select throws_like($$ select public.admin_request_role_change('update', 'consulta_trazabilidad', '{"name":"Consulta"}', '') $$,
  '%REASON_REQUIRED%', 'modificar un rol exige motivo');
select lives_ok($$ select public.admin_request_role_change('update', 'consulta_trazabilidad',
    '{"name":"Consulta de trazabilidad","description":"Regulatorio","read_only":false}', 'Ya no es solo lectura') $$,
  'el administrador solicita cambiar las opciones del rol');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000004');
select is(pg_temp.qa_approves('consulta_trazabilidad'), 'aprobada', 'Calidad aprueba las opciones');
reset role;

-- AC-37: funciones reservadas (se rechazan al solicitar).
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select throws_like(
  $$ select public.admin_request_role_change('permissions', 'consulta_trazabilidad', '{"permissions":[{"module":"liberacion_final_del_lote","read":true,"approve":true}]}', 'x') $$,
  '%RESERVED_PERMISSION%', 'AC-37: aprobar la liberación final es exclusivo del director técnico');
select throws_like(
  $$ select public.admin_request_role_change('permissions', 'consulta_trazabilidad', '{"permissions":[{"module":"usuarios_catalogos_perfiles","create":true}]}', 'x') $$,
  '%RESERVED_PERMISSION%', 'AC-37: administrar usuarios es exclusivo del administrador');
-- AC-38: roles del sistema protegidos (solo sus permisos cambian, con doble aprobación: prueba 0013).
select throws_like($$ select public.admin_request_role_change('retire', 'auditor', '{}', 'x') $$,
  '%SYSTEM_ROLE_LOCKED%', 'AC-38: un rol del sistema no se retira');
reset role;
select throws_like($$ update public.module_permissions set can_read = true where role = 'comercial' and module_code = 'paquete_tecnico' $$,
  '%SYSTEM_ROLE_LOCKED%', 'ni siquiera el dueño de la base modifica la matriz de un rol del sistema sin solicitud');

-- AC-36: asignarlo da exactamente ese permiso.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000002', 'consulta_trazabilidad', null, 'Analista de Regulatorio') $$,
  'el rol adicional se asigna a un usuario');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000002');
select ok(public.has_module_permission('trazabilidad_auditoria', 'read'), 'AC-36: el usuario obtiene la lectura de trazabilidad');
select ok(not public.has_module_permission('brief', 'read') and not public.has_module_permission('trazabilidad_auditoria', 'create'),
  'AC-36: y ningún otro permiso');
select ok(public.can_read_audit(), 'AC-36: con lectura de trazabilidad puede leer la bitácora');
reset role;

-- Incompatibilidades y retiro.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.admin_request_role_change('incompatibilities', 'consulta_trazabilidad', '{"others":["prod_aux"]}', 'No combina con ejecución') $$,
  'RF-07: el administrador solicita roles incompatibles');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000004');
select is(pg_temp.qa_approves('consulta_trazabilidad'), 'aprobada', 'Calidad aprueba las incompatibilidades');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select throws_like($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000003', 'consulta_trazabilidad', null, 'x') $$,
  '%ROLE_INCOMPATIBLE%', 'la incompatibilidad impide asignar ambos roles a la misma persona');
select throws_like($$ select public.admin_request_role_change('retire', 'consulta_trazabilidad', '{}', 'Ya no se usa') $$,
  '%ROLE_IN_USE%', 'AC-38: un rol asignado y vigente no se retira (ni se solicita)');
select lives_ok(
  $$ select public.admin_revoke_role((select id from public.user_roles where role = 'consulta_trazabilidad'), 'Fin de la asignación');
     select public.admin_request_role_change('retire', 'consulta_trazabilidad', '{}', 'Cargo eliminado del organigrama') $$,
  'sin asignaciones vigentes, se solicita el retiro');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000004');
select is(pg_temp.qa_approves('consulta_trazabilidad'), 'aprobada', 'Calidad aprueba el retiro');
reset role;
select is((select active from public.roles where code = 'consulta_trazabilidad'), false, 'aprobado el retiro, el rol queda retirado');

select * from finish();
rollback;
