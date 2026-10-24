-- E5 · Recepción en cuarentena (RF-20), kardex y saldo (RF-21), liberación con firma y SOD-5 (RF-22), reglas de
-- ubicación (RF-24: AC-21 LOCATION_TYPE_MISMATCH, AC-22 LOCATION_RULE_VIOLATION; D-16) y disponibilidad (AC-03).
begin;
select plan(37);

select pg_temp.test_user('hernan@p.test', 'Hernán Salgado', '{bodega_jefe}', p_id => 'b7000000-0000-4000-8000-000000000001');
select pg_temp.test_user('marta@p.test', 'Marta Quintero', '{bodega_aux}', p_id => 'b7000000-0000-4000-8000-000000000002');
select pg_temp.test_user('natalia@p.test', 'Natalia Ruiz', '{lab_aux}', p_id => 'b7000000-0000-4000-8000-000000000003');
select pg_temp.test_user('ricardo@p.test', 'Ricardo Peña', '{cc_jefe}', p_id => 'b7000000-0000-4000-8000-000000000004');
select pg_temp.test_user('camila@p.test', 'Camila Ortega', '{comercial}', p_id => 'b7000000-0000-4000-8000-000000000005');

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$ select current_setting('t.' || p_key)::uuid $$;
create or replace function pg_temp.loc(p_code text) returns uuid language sql as $$
  select id from public.storage_locations where code = p_code $$;
create or replace function pg_temp.balance(p_lot uuid) returns numeric language sql as $$
  select coalesce(sum(qty), 0) from public.stock_by_location where lot_id = p_lot $$;
-- Saldo calculado solo con el kardex: entradas − salidas.
create or replace function pg_temp.kardex(p_lot uuid) returns numeric language sql as $$
  select coalesce(sum(case when to_location_id is not null then qty else 0 end), 0)
       - coalesce(sum(case when from_location_id is not null then qty else 0 end), 0)
  from public.inventory_movements where lot_id = p_lot $$;

-- Datos de partida: materiales, proveedor y tres bodegas (materias primas con zonas, producto terminado y rechazo).
insert into public.materials (id, code, name, type, unit, requires_coa) values
  ('f7000000-0000-4000-8000-000000000001', 'MP-971', 'Fenoxietanol de prueba', 'mp', 'kg', true),
  ('f7000000-0000-4000-8000-000000000002', 'EN-971', 'Envase de prueba', 'envase', 'und', false);
select pg_temp.login_as('b7000000-0000-4000-8000-000000000001');
select set_config('t.sup', public.save_external_party(null, '{"name": "Proveedor de Prueba S.A.S.", "kind": "proveedor"}')::text, false);
select public.create_warehouse('{"code": "BOD-TMP", "name": "MP de prueba", "function": "materias_primas", "location_prefix": "TM"}',
  array['materia_prima'], 2, 2, 2);
select public.set_rack_zone((select r.id from public.racks r join public.warehouses w on w.id = r.warehouse_id
  where w.code = 'BOD-TMP' and r.code = 'E01'), 'cuarentena', 'Zona de cuarentena');
select public.set_rack_zone((select r.id from public.racks r join public.warehouses w on w.id = r.warehouse_id
  where w.code = 'BOD-TMP' and r.code = 'E02'), 'aprobado', 'Zona de aprobados');
select public.create_warehouse('{"code": "BOD-TPT", "name": "PT de prueba", "function": "producto_terminado", "location_prefix": "TP"}',
  array['producto_terminado'], 1, 1, 2);
select public.create_warehouse('{"code": "BOD-TRE", "name": "Rechazo de prueba", "function": "rechazo", "location_prefix": "TX"}',
  array['materia_prima', 'material_envase'], 1, 2, 2);
reset role;

-- =====================================================================
-- Recepción (RF-20) y reglas de ubicación (AC-21)
-- =====================================================================
select pg_temp.login_as('b7000000-0000-4000-8000-000000000002');
select throws_like($$ select public.receive_material_lot(jsonb_build_object('material_id', 'f7000000-0000-4000-8000-000000000001',
    'supplier_id', pg_temp.v('sup'), 'supplier_lot', 'FEN-1', 'qty', 50, 'coa_ref', 'CoA-1'), pg_temp.loc('TM-E01-P1-01')) $$,
  '%INVALID_FIELD%falta fecha de vencimiento%', 'RF-20: no se recibe sin fecha de vencimiento');
select throws_like($$ select public.receive_material_lot(jsonb_build_object('material_id', 'f7000000-0000-4000-8000-000000000001',
    'supplier_id', pg_temp.v('sup'), 'supplier_lot', 'FEN-1', 'qty', 50, 'expiry_date', '2028-03-15'), pg_temp.loc('TM-E01-P1-01')) $$,
  '%INVALID_FIELD%CoA%', 'un material que exige CoA no se recibe sin él');
select throws_like($$ select public.receive_material_lot(jsonb_build_object('material_id', 'f7000000-0000-4000-8000-000000000002',
    'supplier_id', pg_temp.v('sup'), 'supplier_lot', 'ENV-1', 'qty', 100, 'expiry_date', '2030-01-01'), pg_temp.loc('TP-E01-P1-01')) $$,
  '%LOCATION_TYPE_MISMATCH%', 'AC-21: material de envase en una ubicación de producto terminado');
select throws_like($$ select public.receive_material_lot(jsonb_build_object('material_id', 'f7000000-0000-4000-8000-000000000001',
    'supplier_id', pg_temp.v('sup'), 'supplier_lot', 'FEN-1', 'qty', 50, 'expiry_date', '2028-03-15', 'coa_ref', 'CoA-1'),
    pg_temp.loc('TM-E02-P1-01')) $$,
  '%LOCATION_RULE_VIOLATION%cuarentena%', 'D-16: un lote en cuarentena no va a la zona de aprobados');
select is((select zone from public.suggest_locations('f7000000-0000-4000-8000-000000000001', 'cuarentena', 1)), 'cuarentena',
  'RF-20: se propone primero una ubicación libre de la zona de cuarentena (con o sin la semilla)');
select set_config('t.lot', (public.receive_material_lot(jsonb_build_object('material_id', 'f7000000-0000-4000-8000-000000000001',
    'supplier_id', pg_temp.v('sup'), 'supplier_lot', 'FEN-2510-C', 'qty', 50, 'expiry_date', '2028-03-15', 'coa_ref', 'CoA-FEN-2510-C'),
    pg_temp.loc('TM-E01-P1-02')) ->> 'id'), false);
select set_config('t.lot2', (public.receive_material_lot(jsonb_build_object('material_id', 'f7000000-0000-4000-8000-000000000001',
    'supplier_id', pg_temp.v('sup'), 'supplier_lot', 'FEN-2510-D', 'qty', 25, 'expiry_date', '2028-05-31', 'coa_ref', 'CoA-FEN-2510-D'),
    pg_temp.loc('TM-E01-P2-01')) ->> 'id'), false);
reset role;
select matches((select internal_code from public.material_lots where id = pg_temp.v('lot')), '^MP-[0-9]{4}-[0-9]{4}$',
  'el lote recibe el código interno MP-AAAA-NNNN');
select is((select status from public.material_lots where id = pg_temp.v('lot')), 'cuarentena', 'RF-20: estado inicial cuarentena');
select is(pg_temp.balance(pg_temp.v('lot')), 50.0000, 'el saldo queda en la ubicación asignada');
select is((select name from public.lot_tests where lot_id = pg_temp.v('lot')), 'Certificado de análisis del proveedor',
  'D-52: sin especificación vigente, la liberación exige revisar el CoA');
select throws_like($$ select public.assert_lot_available(pg_temp.v('lot'), 1) $$, '%LOT_NOT_APPROVED%',
  'AC-03: un lote en cuarentena no se puede dispensar');

-- =====================================================================
-- Liberación (RF-22, SOD-5)
-- =====================================================================
select pg_temp.login_as('b7000000-0000-4000-8000-000000000004');
select throws_like($$ select public.release_material_lot(pg_temp.v('lot'), 'aprobado', null, 'Clave-Prueba-2026') $$,
  '%RESULTS_PENDING%', 'RF-22: no se aprueba sin resultados de análisis');
select throws_like($$ select public.record_lot_results(pg_temp.v('lot'), '[]') $$, '%FORBIDDEN_ROLE%',
  'Control de calidad aprueba; los resultados los registra el laboratorio');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000003');
select is((public.record_lot_results(pg_temp.v('lot'), jsonb_build_array(jsonb_build_object(
    'test_id', (select id from public.lot_tests where lot_id = pg_temp.v('lot')), 'value', 'CoA revisado: conforme', 'conforming', true)))
  ->> 'pending')::int, 0, 'el laboratorio registra el resultado');
select throws_like($$ select public.release_material_lot(pg_temp.v('lot'), 'aprobado', null, 'Clave-Prueba-2026') $$,
  '%FORBIDDEN_ROLE%', 'el laboratorio no libera');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000004');
select is(public.release_material_lot(pg_temp.v('lot'), 'aprobado', null, 'Clave-Prueba-2026') ->> 'status', 'aprobado',
  'RF-22: Control de calidad aprueba el lote con firma');
reset role;
select ok(exists (select 1 from public.signatures where record_table = 'material_lots' and record_id = pg_temp.v('lot')
  and meaning = 'libero'), 'la liberación queda firmada («Liberé»)');
select is((select string_agg(coalesce(from_status, '∅') || '→' || to_status, ', ' order by created_at)
           from public.lot_status_history where lot_id = pg_temp.v('lot')), '∅→cuarentena, cuarentena→aprobado',
  'la historia de estado queda completa');

-- =====================================================================
-- Kardex, traslado interno y ajuste (RF-21, RF-24, D-16)
-- =====================================================================
select pg_temp.login_as('b7000000-0000-4000-8000-000000000002');
select throws_like($$ select public.relocate_lot(pg_temp.v('lot'), pg_temp.loc('TM-E01-P1-02'), pg_temp.loc('TM-E01-P2-02'), 10, 'Orden') $$,
  '%LOCATION_RULE_VIOLATION%aprobado%', 'D-16: un lote aprobado no va a la zona de cuarentena');
select lives_ok($$ select public.relocate_lot(pg_temp.v('lot'), pg_temp.loc('TM-E01-P1-02'), pg_temp.loc('TM-E02-P1-01'), 30,
  'Liberado: pasa a la zona de aprobados') $$, 'RF-24: traslado interno con motivo');
select throws_like($$ select public.adjust_lot(pg_temp.v('lot'), pg_temp.loc('TM-E02-P1-01'), -1, 'merma', 'Derrame') $$,
  '%FORBIDDEN_ROLE%', 'el auxiliar no registra ajustes');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.adjust_lot(pg_temp.v('lot'), pg_temp.loc('TM-E02-P1-01'), -1.5, 'merma', 'Derrame al trasladar') $$,
  'el jefe de bodega registra una merma con motivo');
select throws_like($$ select public.adjust_lot(pg_temp.v('lot'), pg_temp.loc('TM-E02-P1-01'), -100, 'conteo', 'Conteo físico') $$,
  '%INSUFFICIENT_STOCK%', 'el saldo nunca queda negativo');
reset role;
select is(pg_temp.balance(pg_temp.v('lot')), 48.5000, 'saldo: 50 − 1,5 = 48,5');
select is(pg_temp.kardex(pg_temp.v('lot')), pg_temp.balance(pg_temp.v('lot')), 'RF-21: el saldo es igual a la suma de movimientos');
select is((select qty_on_hand from public.v_lot_stock where id = pg_temp.v('lot')), 48.5000, 'la vista de saldo cuadra');
select lives_ok($$ select public.assert_lot_available(pg_temp.v('lot'), 48.5) $$, 'un lote aprobado y vigente está disponible');
select throws_like($$ select public.assert_lot_available(pg_temp.v('lot'), 49) $$, '%INSUFFICIENT_STOCK%',
  'no se dispensa más que el saldo');

-- =====================================================================
-- Rechazo y bodega de rechazo (AC-22)
-- =====================================================================
select pg_temp.login_as('b7000000-0000-4000-8000-000000000004');
select throws_like($$ select public.release_material_lot(pg_temp.v('lot2'), 'rechazado', '', 'Clave-Prueba-2026') $$,
  '%REASON_REQUIRED%', 'el rechazo exige motivo');
select is(public.release_material_lot(pg_temp.v('lot2'), 'rechazado', 'Pureza fuera de especificación', 'Clave-Prueba-2026') ->> 'status',
  'rechazado', 'RF-22: Control de calidad rechaza con motivo y firma');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000002');
select throws_like($$ select public.relocate_lot(pg_temp.v('lot2'), pg_temp.loc('TM-E01-P2-01'), pg_temp.loc('TM-E02-P2-01'), 25,
    'Reubicación') $$, '%LOCATION_RULE_VIOLATION%rechazo%', 'AC-22: un lote rechazado no va a una ubicación de materias primas aprobadas');
select lives_ok($$ select public.relocate_lot(pg_temp.v('lot2'), pg_temp.loc('TM-E01-P2-01'), pg_temp.loc('TX-E01-P1-01'), 25,
    'Rechazado: a la bodega de rechazo') $$, 'D-16: el lote rechazado va a la bodega de rechazo');
reset role;

-- =====================================================================
-- Vencimiento derivado, importación (D-03) y lectura
-- =====================================================================
insert into app_private.test_clock (now_override) values ('2028-04-01 10:00-05');
select is((select effective_status from public.v_lot_stock where id = pg_temp.v('lot')), 'vencido',
  'un lote aprobado pasa a «vencido» al superar su fecha');
select throws_like($$ select public.assert_lot_available(pg_temp.v('lot'), 1) $$, '%LOT_EXPIRED%', 'un lote vencido no se dispensa');
delete from app_private.test_clock;

select pg_temp.login_as('b7000000-0000-4000-8000-000000000002');
select throws_like($$ select public.import_material_receipts(jsonb_build_array(
    jsonb_build_object('material_code', 'MP-971', 'supplier_name', 'Proveedor de Prueba S.A.S.', 'supplier_lot', 'IMP-1',
      'qty', 10, 'expiry_date', '2029-01-31', 'coa_ref', 'CoA-IMP-1', 'location_code', 'TM-E01-P1-01'),
    jsonb_build_object('material_code', 'MP-971', 'supplier_name', 'Proveedor de Prueba S.A.S.', 'supplier_lot', 'IMP-2',
      'qty', 10, 'coa_ref', 'CoA-IMP-2', 'location_code', 'TM-E01-P1-01'))) $$,
  '%INVALID_FIELD: fila 2%', 'D-03: la importación indica la fila con error');
reset role;
select is((select count(*)::int from public.material_lots where supplier_lot in ('IMP-1', 'IMP-2')), 0,
  'D-03: la importación es todo o nada');

select pg_temp.login_as('b7000000-0000-4000-8000-000000000005');
select is((select count(*)::int from public.material_lots), 0, 'Comercial no ve el inventario (matriz 2.2)');
reset role;
select pg_temp.login_as('b7000000-0000-4000-8000-000000000001');
select throws_like($$ insert into public.inventory_movements (lot_id, type, qty, to_location_id)
    values (pg_temp.v('lot'), 'ajuste', 1, pg_temp.loc('TM-E02-P1-01')) $$, '%permission denied%',
  'el kardex no se escribe directamente: solo por RPC');
reset role;

select * from finish();
rollback;
