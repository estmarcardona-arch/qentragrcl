-- E2 · Roles configurables (PRD 2.6, RF-07): crear, configurar permisos e incompatibilidades, retirar;
-- funciones reservadas (AC-37), roles del sistema protegidos y rol en uso (AC-38), permisos efectivos (AC-36).
begin;
select plan(24);

select pg_temp.test_user('admin@p.test', 'Tomás Herrera', '{admin}', p_id => 'a0000000-0000-4000-8000-000000000001');
select pg_temp.test_user('ana@p.test', 'Analista Externa', '{}', p_id => 'a0000000-0000-4000-8000-000000000002');
select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'a0000000-0000-4000-8000-000000000003');

-- Solo el administrador.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000003');
select throws_like($$ select public.admin_create_role('consulta', 'Consulta', '', false, true, 'x') $$,
  '%FORBIDDEN_ROLE%', 'RF-07: un no administrador no crea roles');
reset role;

select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select throws_like($$ select public.admin_create_role('Consulta Externa', 'Consulta', '', false, true, 'x') $$,
  '%INVALID_FIELD%', 'el código del rol se valida');
select throws_like($$ select public.admin_create_role('consulta_trazabilidad', 'Consulta de trazabilidad', '', false, true, '') $$,
  '%REASON_REQUIRED%', 'crear un rol exige motivo');
select is(public.admin_create_role('consulta_trazabilidad', 'Consulta de trazabilidad', 'Solo consulta trazabilidad', false, true, 'Cargo de consulta para Regulatorio'),
  'consulta_trazabilidad', 'RF-07: el administrador crea un rol adicional');
select throws_like($$ select public.admin_create_role('dt', 'Otro', '', false, false, 'x') $$,
  '%INVALID%', 'no se crea un rol con un código existente');
reset role;

select is((select count(*)::int from public.module_permissions where role = 'consulta_trazabilidad'), 19,
  'el rol nace con una celda por módulo');
select is((select count(*)::int from public.module_permissions where role = 'consulta_trazabilidad' and cell_text = '—'), 19,
  'el rol nace sin permisos');

-- Configurar permisos.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select throws_like(
  $$ select public.admin_set_role_permissions('consulta_trazabilidad', '[{"module":"trazabilidad_auditoria","read":true,"create":true}]', 'x') $$,
  '%INVALID_FIELD%', 'un rol de solo lectura solo admite L');
select is(
  public.admin_set_role_permissions('consulta_trazabilidad', '[{"module":"trazabilidad_auditoria","read":true}]', 'Consulta de trazabilidad para Regulatorio'),
  1, 'RF-07: el administrador asigna permisos por módulo');
select throws_like($$ select public.admin_update_role('consulta_trazabilidad', 'Consulta', '', false, false, '') $$,
  '%REASON_REQUIRED%', 'modificar un rol exige motivo');
select lives_ok($$ select public.admin_update_role('consulta_trazabilidad', 'Consulta de trazabilidad', 'Regulatorio', false, false, 'Ya no es solo lectura') $$,
  'el administrador cambia las opciones del rol');
-- AC-37: funciones reservadas.
select throws_like(
  $$ select public.admin_set_role_permissions('consulta_trazabilidad', '[{"module":"liberacion_final_del_lote","read":true,"approve":true}]', 'x') $$,
  '%RESERVED_PERMISSION%', 'AC-37: aprobar la liberación final es exclusivo del director técnico');
select throws_like(
  $$ select public.admin_set_role_permissions('consulta_trazabilidad', '[{"module":"usuarios_catalogos_perfiles","create":true}]', 'x') $$,
  '%RESERVED_PERMISSION%', 'AC-37: administrar usuarios es exclusivo del administrador');
-- Roles del sistema protegidos.
select throws_like($$ select public.admin_set_role_permissions('dt', '[{"module":"brief","read":true}]', 'x') $$,
  '%SYSTEM_ROLE_LOCKED%', 'los permisos de un rol del sistema no se modifican');
select throws_like($$ select public.admin_set_role_active('auditor', false, 'x') $$,
  '%SYSTEM_ROLE_LOCKED%', 'AC-38: un rol del sistema no se retira');
reset role;
select throws_like($$ update public.module_permissions set can_read = true where role = 'comercial' and module_code = 'paquete_tecnico' $$,
  '%SYSTEM_ROLE_LOCKED%', 'ni siquiera el dueño modifica la matriz de un rol del sistema');

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
select lives_ok($$ select public.admin_set_role_incompatibilities('consulta_trazabilidad', array['prod_aux'], 'No combina con ejecución') $$,
  'RF-07: el administrador declara roles incompatibles');
select throws_like($$ select public.admin_grant_role('a0000000-0000-4000-8000-000000000003', 'consulta_trazabilidad', null, 'x') $$,
  '%ROLE_INCOMPATIBLE%', 'la incompatibilidad impide asignar ambos roles a la misma persona');
select throws_like($$ select public.admin_set_role_active('consulta_trazabilidad', false, 'Ya no se usa') $$,
  '%ROLE_IN_USE%', 'AC-38: un rol asignado y vigente no se retira');
select lives_ok(
  $$ select public.admin_revoke_role((select id from public.user_roles where role = 'consulta_trazabilidad'), 'Fin de la asignación');
     select public.admin_set_role_active('consulta_trazabilidad', false, 'Cargo eliminado del organigrama') $$,
  'sin asignaciones vigentes, el rol se retira');
reset role;

select * from finish();
rollback;
