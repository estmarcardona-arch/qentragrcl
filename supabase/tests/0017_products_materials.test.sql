-- E4 · Catálogos de materiales y productos (PRD 6.3) y criterios de estabilidad por producto (D-13): RLS y escritura.
begin;
select plan(7);

select pg_temp.test_user('admin@p.test', 'Tomás Herrera', '{admin}', p_id => 'b4000000-0000-4000-8000-000000000001');
select pg_temp.test_user('sebastian@p.test', 'Sebastián Rojas', '{idi}', p_id => 'b4000000-0000-4000-8000-000000000003');

select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.materials'::regclass, 'public.products'::regclass,
  'public.product_presentations'::regclass, 'public.stability_criteria'::regclass)), 'RLS activo en materiales, productos, presentaciones y criterios');
select ok(not has_table_privilege('authenticated', 'public.materials', 'INSERT') and not has_table_privilege('authenticated', 'public.stability_criteria', 'UPDATE'),
  'sin escritura directa');

select pg_temp.login_as('b4000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.admin_save_catalog('materials', null, '{"code": "MP-990", "name": "Materia prima de prueba", "type": "mp", "unit": "kg"}', null) $$,
  'el administrador crea un material del catálogo');
select throws_like($$ select public.admin_save_catalog('materials', null, '{"code": "MP-991", "name": "X", "type": "otro"}', null) $$,
  '%violates check%', 'el tipo de material se valida (mp, envase, empaque)');
reset role;
select pg_temp.login_as('b4000000-0000-4000-8000-000000000003');
select throws_like($$ select public.admin_save_catalog('materials', null, '{"code": "MP-992", "name": "X", "type": "mp"}', null) $$,
  '%FORBIDDEN_ROLE%', 'I+D no modifica los catálogos');
select is((select count(*)::int from public.materials where code = 'MP-990'), 1, 'todos leen el catálogo de materiales');
select throws_like($$ select public.set_stability_criteria(gen_random_uuid(), '{}', 'x') $$, '%RECORD_NOT_FOUND%',
  'los criterios se definen para un producto existente');
reset role;

select * from finish();
rollback;
