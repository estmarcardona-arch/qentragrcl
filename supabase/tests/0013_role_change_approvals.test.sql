-- E2 · RF-07 · Aprobación de cambios de rol (PRD 2.6; D-39, D-40, D-41; AC-39, AC-40, AC-41): Calidad aprueba los roles adicionales;
-- los permisos de un rol del sistema exigen doble aprobación (aq_dir y dt) de personas distintas;
-- quien solicita no aprueba; funciones reservadas con candado; reautenticación; anulación; bitácora.
begin;
select plan(24);

select pg_temp.test_user('admin@p.test', 'Tomás Herrera', '{admin}', p_id => 'a0000000-0000-4000-8000-000000000001');
select pg_temp.test_user('lucia@p.test', 'Lucía Barrera', '{aq_dir}', p_id => 'a0000000-0000-4000-8000-000000000004');
select pg_temp.test_user('esteban@p.test', 'Dr. Esteban Gaviria', '{dt}', p_id => 'a0000000-0000-4000-8000-000000000005');
select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'a0000000-0000-4000-8000-000000000003');

create or replace function pg_temp.pending(p_role text)
returns uuid
language sql
as $$ select id from public.role_change_requests where role_code = p_role and status = 'pendiente' $$;

-- Tablas nuevas: RLS y escritura solo por RPC.
select ok((select relrowsecurity from pg_class where oid = 'public.role_change_requests'::regclass)
      and (select relrowsecurity from pg_class where oid = 'public.role_change_approvals'::regclass),
  'RLS activo en solicitudes y aprobaciones');
select ok(not has_table_privilege('authenticated', 'public.role_change_requests', 'INSERT')
      and not has_table_privilege('authenticated', 'public.role_change_approvals', 'INSERT'),
  'nadie escribe solicitudes ni aprobaciones fuera de las RPC');
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname in ('admin_create_role', 'admin_set_role_permissions', 'admin_set_role_active')),
  'las RPC de cambio directo de 0012 ya no existen');
select is((select count(*)::int from public.module_permissions mp join public.roles r on r.code = mp.role and r.is_system
           where mp.prd_cell_text is distinct from mp.cell_text), 0,
  'la línea base del PRD queda guardada celda a celda');

-- D-39: rol adicional con una aprobación de aq_dir; quien solicita no aprueba.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select is(public.admin_request_role_change('create', 'consulta_regulatoria', '{"name":"Consulta regulatoria"}', 'Nuevo cargo') -> 'required_roles',
  '["aq_dir"]'::jsonb, 'D-39: crear un rol adicional lo aprueba Aseguramiento de calidad');
select throws_like($$ select public.admin_request_role_change('update', 'consulta_regulatoria', '{"name":"X"}', 'x') $$,
  '%RECORD_NOT_FOUND%', 'AC-39: el rol no existe hasta aprobarse');
select throws_like($$ select public.decide_role_change(pg_temp.pending('consulta_regulatoria'), 'aprobada', 'x', 'Clave-Prueba-2026') $$,
  '%SOD_VIOLATION%', 'AC-39: quien solicita no aprueba su propio cambio');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000005');
select throws_like($$ select public.decide_role_change(pg_temp.pending('consulta_regulatoria'), 'aprobada', 'x', 'Clave-Prueba-2026') $$,
  '%FORBIDDEN_ROLE%', 'el director técnico no aprueba roles adicionales');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000003');
select throws_like($$ select public.get_role_change_requests() $$, '%FORBIDDEN_ROLE%', 'un operario no ve las solicitudes');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000004');
select is(public.decide_role_change(pg_temp.pending('consulta_regulatoria'), 'aprobada', 'x', 'clave-errada') ->> 'code',
  'REAUTH_FAILED', 'aprobar exige la contraseña de quien aprueba');
select is((select status from public.role_change_requests where role_code = 'consulta_regulatoria'), 'pendiente',
  'una contraseña errada no decide nada');
select is(public.decide_role_change(pg_temp.pending('consulta_regulatoria'), 'aprobada', 'Conforme', 'Clave-Prueba-2026') ->> 'status',
  'aprobada', 'AC-39: con la aprobación de aq_dir el rol se crea');
reset role;
select ok(exists (select 1 from public.roles where code = 'consulta_regulatoria' and not is_system), 'el rol adicional existe');

-- Anulación por quien solicitó.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.admin_request_role_change('retire', 'consulta_regulatoria', '{}', 'Ya no se necesita');
                   select public.admin_cancel_role_change(pg_temp.pending('consulta_regulatoria'), 'Se decidió conservarlo') $$,
  'quien solicitó anula su solicitud pendiente');
reset role;
select is((select active from public.roles where code = 'consulta_regulatoria'), true, 'la solicitud anulada no cambia el rol');

-- D-40: permisos de un rol del sistema con doble aprobación.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select throws_like($$ select public.admin_request_role_change('update', 'comercial', '{"name":"Ventas"}', 'x') $$,
  '%SYSTEM_ROLE_LOCKED%', 'D-40: de un rol del sistema solo se ajustan los permisos');
select throws_like($$ select public.admin_request_role_change('permissions', 'dt', '{"permissions":[{"module":"liberacion_final_del_lote","read":true,"sign":true}]}', 'x') $$,
  '%RESERVED_PERMISSION%', 'AC-41: el candado impide quitar al director técnico la liberación final');
select is(public.admin_request_role_change('permissions', 'comercial',
    '{"permissions":[{"module":"paquete_tecnico","read":true}]}', 'Comercial consulta el paquete técnico') -> 'required_roles',
  '["aq_dir", "dt"]'::jsonb, 'D-40: un rol del sistema exige aq_dir y dt');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000004');
select is(public.decide_role_change(pg_temp.pending('comercial'), 'aprobada', 'Conforme Calidad', 'Clave-Prueba-2026') ->> 'status',
  'pendiente', 'AC-40: con una sola aprobación el cambio no se aplica');
select throws_like($$ select public.decide_role_change(pg_temp.pending('comercial'), 'aprobada', 'Otra vez', 'Clave-Prueba-2026') $$,
  '%SOD_VIOLATION%', 'AC-40: la misma persona no da las dos aprobaciones');
reset role;
select is((select cell_text from public.module_permissions where role = 'comercial' and module_code = 'paquete_tecnico'),
  (select prd_cell_text from public.module_permissions where role = 'comercial' and module_code = 'paquete_tecnico'),
  'la matriz no cambia con una aprobación');
select pg_temp.login_as('a0000000-0000-4000-8000-000000000005');
select is(public.decide_role_change(pg_temp.pending('comercial'), 'aprobada', 'Conforme Dirección técnica', 'Clave-Prueba-2026') ->> 'status',
  'aprobada', 'AC-40: con la segunda aprobación (dt) el cambio se aplica');
reset role;
select is((select cell_text || ' | PRD ' || prd_cell_text from public.module_permissions where role = 'comercial' and module_code = 'paquete_tecnico'),
  'L | PRD —', 'la celda cambia y conserva la línea base del PRD para comparar');
select ok(exists (select 1 from public.audit_log where table_name = 'module_permissions' and action = 'update'
                  and reason like '%CR-%aprobada%'),
  'la bitácora registra el cambio de la celda con la solicitud aprobada');

select * from finish();
rollback;
