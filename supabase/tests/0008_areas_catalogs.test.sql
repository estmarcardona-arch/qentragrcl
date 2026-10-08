-- E2 · Áreas (RF-06) y catálogos versionados con bitácora y RLS (RF-04).
begin;
select plan(26);

select pg_temp.test_user('admin@p.test', 'Tomás Herrera', '{admin}', p_id => 'a0000000-0000-4000-8000-000000000001');
select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'a0000000-0000-4000-8000-000000000002');

-- RF-06: Aseguramiento de la calidad es el área dueña del SGD, con sigla GCA.
select is((select process_code from public.organizational_areas where is_quality_owner), 'GCA',
  'RF-06: Aseguramiento de la calidad (GCA) es la dueña del sistema documental');
select is((select count(*)::int from public.organizational_areas where process_code is not null), 8,
  'las 8 siglas de proceso propuestas del PRD 2.5.2');
select throws_like($$ insert into public.organizational_areas (code, name, is_quality_owner) values ('XX', 'Otra', true) $$,
  '%duplicate key%', 'solo un área es dueña del SGD');
select throws_like(
  $$ update public.organizational_areas set parent_id = (select id from public.organizational_areas where code = 'CC')
     where code = 'DT' $$,
  '%INVALID_TRANSITION%', 'el árbol de áreas no admite ciclos');

-- Lectura: authenticated sí, anon no.
set local role anon;
select throws_ok($$ select * from public.catalog_items $$, '42501', null, 'anon no lee catálogos');
select throws_ok($$ select * from public.organizational_areas $$, '42501', null, 'anon no lee áreas');
reset role;

select pg_temp.login_as('a0000000-0000-4000-8000-000000000002'); -- Diego
select ok((select count(*) from public.catalog_items where catalog = 'unidades') >= 10, 'authenticated lee las unidades');
select ok((select count(*) from public.product_lines) = 2, 'authenticated lee las líneas');
select ok((select count(*) from public.regulatory_profiles) = 10, 'authenticated lee los perfiles regulatorios');
select ok((select count(*) from public.retention_rules) = 4, 'authenticated lee las reglas de retención');
-- Escritura de un no administrador: sin permiso directo ni por RPC.
select throws_ok($$ insert into public.catalog_items (catalog, code, name) values ('unidades', 'x', 'x') $$, '42501', null,
  'un no administrador no escribe catálogos directamente');
select throws_ok($$ update public.product_lines set name = 'x' $$, '42501', null,
  'un no administrador no modifica líneas directamente');
select throws_like($$ select public.admin_save_catalog('catalog_items', null, '{"catalog":"unidades","code":"x","name":"x"}', null) $$,
  '%FORBIDDEN_ROLE%', 'un no administrador no usa admin_save_catalog');
reset role;

-- Administrador: crea y modifica (con motivo), la versión sube y queda en bitácora.
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001'); -- Tomás
select lives_ok($$ select public.admin_save_catalog('catalog_items', null, '{"catalog":"unidades","code":"cP","name":"Centipoise"}', null) $$,
  'el administrador crea un ítem de catálogo');
select throws_like(
  $$ select public.admin_save_catalog('catalog_items', (select id from public.catalog_items where code = 'cP'), '{"name":"Centipoise (cP)"}', '') $$,
  '%REASON_REQUIRED%', 'modificar un catálogo exige motivo');
select lives_ok(
  $$ select public.admin_save_catalog('catalog_items', (select id from public.catalog_items where code = 'cP'), '{"name":"Centipoise (cP)"}', 'Nombre completo') $$,
  'el administrador modifica con motivo');
select throws_like(
  $$ select public.admin_save_catalog('catalog_items', (select id from public.catalog_items where code = 'cP'), '{"version":9}', 'x') $$,
  '%INVALID_FIELD%', 'la versión y los metadatos no se editan');
select throws_like($$ select public.admin_save_catalog('profiles', null, '{"full_name":"x"}', 'x') $$,
  '%RECORD_NOT_FOUND%', 'solo tablas de catálogo en la lista blanca');
reset role;

select is((select version from public.catalog_items where code = 'cP'), 2, 'cada cambio incrementa la versión del ítem');
select is(
  (select reason from public.audit_log where table_name = 'catalog_items' and action = 'update'
     and after ->> 'code' = 'cP'),
  'Nombre completo', 'el cambio queda en la bitácora con su motivo'
);
select throws_like($$ delete from public.catalog_items where code = 'cP' $$, '%RECORD_LOCKED%',
  'los catálogos no se borran (se desactivan)');

-- Marcas detrás del interruptor de maquila (D-01).
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select throws_like($$ select public.admin_save_catalog('brands', null, '{"name":"Marca de prueba"}', null) $$,
  '%FEATURE_DISABLED%', 'con la maquila apagada no se crean marcas');
reset role;
update public.app_settings set value = 'true' where key = 'maquila_enabled';
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.admin_save_catalog('brands', null, '{"name":"Marca de prueba"}', null) $$,
  'con la maquila activa se crean marcas');
reset role;

-- RF-04: cambiar un perfil no altera la foto ya tomada para un lote.
create temporary table _snap as select public.regulatory_profile_snapshot('cosmetico') as s;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.admin_save_catalog('regulatory_profiles',
       (select id from public.regulatory_profiles where profile = 'cosmetico' and rule_key = 'independent_verification_dispensing'),
       '{"enabled":true}', 'Verificación independiente también en cosméticos') $$,
  'el administrador cambia una regla del perfil cosmético');
reset role;
select is((select s -> 'rules' -> 'independent_verification_dispensing' ->> 'enabled' from _snap), 'false',
  'RF-04: la foto tomada antes del cambio conserva el valor anterior');
select is((public.regulatory_profile_snapshot('cosmetico') -> 'rules' -> 'independent_verification_dispensing' ->> 'enabled'),
  'true', 'una foto nueva toma el valor vigente');

select * from finish();
rollback;
