-- E2 · Matriz de permisos del PRD 2.2 en la base (RF-04). La comparación celda a celda con el PRD
-- la hacen la prueba unitaria (src/lib/admin/prd-matrix.test.ts) y la E2E de la pantalla S-04.
begin;
select plan(8);

select is((select count(*)::int from public.permission_modules), 19, 'los 19 módulos del PRD 2.2');
select is((select count(*)::int from public.module_permissions mp join public.roles r on r.code = mp.role and r.is_system), 19 * 15,
  'una celda por módulo y rol del sistema (19 × 15)');
select is(
  (select cell_text from public.module_permissions where module_code = 'liberacion_final_del_lote' and role = 'dt'),
  'F A (libera)', 'el director técnico libera el lote');
select is(
  (select can_create from public.module_permissions where module_code = 'usuarios_catalogos_perfiles' and role = 'admin'),
  true, 'solo admin crea usuarios, catálogos y perfiles');
select is(
  (select count(*)::int from public.module_permissions where module_code = 'usuarios_catalogos_perfiles' and can_create),
  1, 'nadie más administra usuarios (tampoco un rol adicional: función reservada)');

select pg_temp.test_user('dt@p.test', 'Dr. Esteban Gaviria', '{dt}', p_id => 'a0000000-0000-4000-8000-000000000001');
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select ok(public.has_module_permission('liberacion_final_del_lote', 'approve'), 'has_module_permission: dt aprueba la liberación');
select ok(not public.has_module_permission('usuarios_catalogos_perfiles', 'create'), 'has_module_permission: dt no administra usuarios');
select throws_ok($$ update public.module_permissions set cell_text = 'x' $$, '42501', null, 'la matriz es de solo lectura');
reset role;

select * from finish();
rollback;
