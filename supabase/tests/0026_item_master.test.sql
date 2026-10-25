-- E5B · Maestro de materiales y productos (RF-26, PRD 1.9) y recepción técnica con orden de compra y unidades de
-- empaque (RF-20 v1.9; AC-42, AC-43).
begin;
select plan(19);

select pg_temp.test_user('sebastian@p.test', 'Sebastián Rojas', '{idi}', p_id => 'b9000000-0000-4000-8000-000000000001');
select pg_temp.test_user('hernan@p.test', 'Hernán Salgado', '{bodega_jefe}', p_id => 'b9000000-0000-4000-8000-000000000002');
select pg_temp.test_user('lucia@p.test', 'Lucía Barrera', '{aq_dir}', p_id => 'b9000000-0000-4000-8000-000000000003');
select pg_temp.test_user('marta@p.test', 'Marta Quintero', '{bodega_aux}', p_id => 'b9000000-0000-4000-8000-000000000004');
select pg_temp.test_user('camila@p.test', 'Camila Ortega', '{comercial}', p_id => 'b9000000-0000-4000-8000-000000000005');

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$ select current_setting('t.' || p_key)::uuid $$;

-- =====================================================================
-- Maestro (RF-26): quién crea y validaciones
-- =====================================================================
select pg_temp.login_as('b9000000-0000-4000-8000-000000000005');
select throws_like($$ select public.save_material(null, '{"code": "MP-955", "name": "Ácido hialurónico", "type": "mp", "unit": "g"}') $$,
  '%FORBIDDEN_ROLE%', 'RF-26: Comercial no crea ítems del maestro');
reset role;
select pg_temp.login_as('b9000000-0000-4000-8000-000000000004');
select throws_like($$ select public.save_material(null, '{"code": "MP-955", "name": "Ácido hialurónico", "type": "mp", "unit": "g"}') $$,
  '%FORBIDDEN_ROLE%', 'RF-26: el auxiliar de bodega consulta pero no crea ítems');
reset role;
select pg_temp.login_as('b9000000-0000-4000-8000-000000000001');
select set_config('t.mp', public.save_material(null, '{"code": "mp-955", "name": "Ácido hialurónico", "type": "mp", "unit": "g",
  "storage_conditions": "2–8 °C, lejos de la luz", "shelf_life_months": 24, "shelf_life_kind": "reanalisis",
  "default_package_type": "Bolsa", "default_package_qty": 500}')::text, false);
select is((select code || ' · ' || unit || ' · ' || storage_conditions || ' · ' || shelf_life_months || ' ' || shelf_life_kind
           from public.materials where id = pg_temp.v('mp')), 'MP-955 · g · 2–8 °C, lejos de la luz · 24 reanalisis',
  'RF-26: I+D crea la materia prima con unidad, almacenamiento y reanálisis (el código va en mayúsculas)');
select throws_like($$ select public.save_material(null, '{"code": "MP-955", "name": "Otro", "type": "mp", "unit": "g"}') $$,
  '%INVALID_FIELD%ya existe%', 'RF-26: el código es único');
select throws_like($$ select public.save_material(null, '{"code": "MP-956", "name": "Otro", "type": "mp", "unit": "cajas"}') $$,
  '%INVALID_FIELD%catálogo de unidades%', 'RF-26: la unidad viene del catálogo de unidades');
select throws_like($$ select public.save_material(null, '{"code": "X1", "name": "Otro", "type": "mp", "unit": "g"}') $$,
  '%INVALID_FIELD%formato%', 'el código sigue el formato AAA-999');
reset role;
select pg_temp.login_as('b9000000-0000-4000-8000-000000000003');
select set_config('t.pl', public.save_material(null, '{"code": "EM-PLEG-200", "name": "Plegadiza 200 mL", "type": "empaque",
  "unit": "und", "requires_coa": false, "default_package_type": "Caja", "default_package_qty": 100}')::text, false);
select ok(pg_temp.v('pl') is not null, 'RF-26: Aseguramiento de la calidad también crea ítems');
reset role;
select pg_temp.login_as('b9000000-0000-4000-8000-000000000002');
select throws_like($$ select public.save_material(pg_temp.v('mp'), '{"name": "Ácido hialurónico 1 %", "type": "mp", "unit": "g"}', '') $$,
  '%REASON_REQUIRED%', 'RF-26: todo cambio del maestro exige motivo');
select lives_ok($$ select public.save_material(pg_temp.v('mp'), '{"name": "Ácido hialurónico", "type": "mp", "unit": "g",
  "storage_conditions": "2–8 °C, lejos de la luz y la humedad", "shelf_life_months": 24, "shelf_life_kind": "reanalisis"}',
  'Ajuste de condiciones de almacenamiento') $$, 'el jefe de bodega ajusta el almacenamiento con motivo');
reset role;
select ok(exists (select 1 from public.audit_log where table_name = 'materials' and record_id = pg_temp.v('mp')
  and action = 'update' and reason = 'Ajuste de condiciones de almacenamiento'), 'el cambio queda en la bitácora con su motivo');

-- Productos terminados y presentaciones.
select pg_temp.login_as('b9000000-0000-4000-8000-000000000001');
select throws_like($$ select public.save_product(null, jsonb_build_object('code', 'P-1', 'name', 'Sérum',
    'line_id', (select id from public.product_lines where code = 'COS'))) $$, '%INVALID_FIELD%PRD-001%',
  'el código del producto sigue el formato PRD-001');
select set_config('t.prd', public.save_product(null, jsonb_build_object('code', 'PRD-955', 'name', 'Sérum de prueba',
    'line_id', (select id from public.product_lines where code = 'COS'), 'shelf_life_months', 24,
    'storage_conditions', 'Temperatura ambiente'))::text, false);
select throws_like($$ select public.save_presentation(null, pg_temp.v('prd'), '{"code": "30", "name": "30 mL", "net_content": 30,
    "unit": "onzas"}') $$, '%INVALID_FIELD%catálogo%', 'la presentación usa una unidad del catálogo');
select lives_ok($$ select public.save_presentation(null, pg_temp.v('prd'), '{"code": "30", "name": "30 mL", "net_content": 30,
    "unit": "mL"}') $$, 'RF-26: se crea el producto terminado con su presentación');
reset role;

-- =====================================================================
-- Recepción técnica (RF-20 v1.9): unidades de empaque y orden de compra (AC-43); ítem inactivo (AC-42)
-- =====================================================================
select pg_temp.login_as('b9000000-0000-4000-8000-000000000002');
select set_config('t.sup', public.save_external_party(null, '{"name": "Proveedor T9", "kind": "proveedor"}')::text, false);
select public.create_warehouse('{"code": "BOD-T9E", "name": "Empaque de prueba", "function": "material_empaque", "location_prefix": "TK"}',
  array['material_empaque'], 1, 1, 2);
reset role;
select pg_temp.login_as('b9000000-0000-4000-8000-000000000004');
select throws_like($$ select public.receive_material_lot(jsonb_build_object('material_id', pg_temp.v('pl'), 'supplier_id', pg_temp.v('sup'),
    'supplier_lot', 'PLG-1', 'expiry_date', '2030-01-01', 'qty', 150, 'package_type', 'Caja', 'package_count', 2, 'qty_per_package', 100),
    (select id from public.storage_locations where code = 'TK-E01-P1-01')) $$,
  '%INVALID_FIELD%no coincide%', 'AC-43: la cantidad debe ser empaques × contenido');
select set_config('t.lot', (public.receive_material_lot(jsonb_build_object('material_id', pg_temp.v('pl'), 'supplier_id', pg_temp.v('sup'),
    'supplier_lot', 'PLG-1', 'expiry_date', '2030-01-01', 'package_type', 'Caja', 'package_count', 2, 'qty_per_package', 100,
    'purchase_order', 'OC-2026-0457'), (select id from public.storage_locations where code = 'TK-E01-P1-01')) ->> 'id'), false);
reset role;
select is((select qty_received::text || ' ' || unit || ' · ' || package_count::int || ' ' || package_type || ' × ' || qty_per_package::int
           || ' · ' || purchase_order from public.material_lots where id = pg_temp.v('lot')),
  '200.0000 und · 2 Caja × 100 · OC-2026-0457', 'AC-43: 2 cajas × 100 plegadizas = 200 und con su orden de compra');
select is((select status from public.material_lots where id = pg_temp.v('lot')), 'cuarentena', 'la recepción técnica deja el lote en cuarentena');

select pg_temp.login_as('b9000000-0000-4000-8000-000000000002');
select throws_like($$ select public.save_material(pg_temp.v('pl'), '{"code": "EM-PLEG-201", "name": "Plegadiza 200 mL", "type": "empaque",
    "unit": "und"}', 'Cambio de código') $$, '%INVALID_FIELD%no cambian%', 'un ítem ya recibido conserva su código (trazabilidad)');
select lives_ok($$ select public.save_material(pg_temp.v('pl'), '{"name": "Plegadiza 200 mL", "type": "empaque", "unit": "und",
    "active": false}', 'Se descontinúa') $$, 'un ítem no se borra: se inactiva con motivo');
reset role;
select pg_temp.login_as('b9000000-0000-4000-8000-000000000004');
select throws_like($$ select public.receive_material_lot(jsonb_build_object('material_id', pg_temp.v('pl'), 'supplier_id', pg_temp.v('sup'),
    'supplier_lot', 'PLG-2', 'expiry_date', '2030-01-01', 'qty', 100), (select id from public.storage_locations where code = 'TK-E01-P1-02')) $$,
  '%INVALID_FIELD%maestro%', 'AC-42: no se recibe un ítem inactivo del maestro');
reset role;

select * from finish();
rollback;
