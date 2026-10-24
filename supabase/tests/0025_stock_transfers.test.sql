-- E5 · Traslados y envíos a bodegas externas (RF-25): borrador → despachado (en tránsito) → recibido | anulado;
-- AC-24 EXTERNAL_SITE_NOT_QUALIFIED; solo salen lotes aprobados; despacho con dos firmas de personas distintas.
-- Con la semilla del Prompt 0B se verifica además el traslado TR-2026-0007 en tránsito.
begin;
select plan(21);

select pg_temp.test_user('hernan@p.test', 'Hernán Salgado', '{bodega_jefe}', p_id => 'b8000000-0000-4000-8000-000000000001');
select pg_temp.test_user('marta@p.test', 'Marta Quintero', '{bodega_aux}', p_id => 'b8000000-0000-4000-8000-000000000002');
select pg_temp.test_user('lucia@p.test', 'Lucía Barrera', '{aq_dir}', p_id => 'b8000000-0000-4000-8000-000000000003');
select pg_temp.test_user('natalia@p.test', 'Natalia Ruiz', '{lab_aux}', p_id => 'b8000000-0000-4000-8000-000000000004');
select pg_temp.test_user('ricardo@p.test', 'Ricardo Peña', '{cc_jefe}', p_id => 'b8000000-0000-4000-8000-000000000005');

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$ select current_setting('t.' || p_key)::uuid $$;
create or replace function pg_temp.loc(p_code text) returns uuid language sql as $$
  select id from public.storage_locations where code = p_code $$;
create or replace function pg_temp.wh(p_code text) returns uuid language sql as $$
  select id from public.warehouses where code = p_code $$;
create or replace function pg_temp.at(p_lot uuid, p_loc text) returns numeric language sql as $$
  select coalesce((select qty from public.stock_by_location where lot_id = p_lot and location_id = pg_temp.loc(p_loc)), 0) $$;

-- Datos de partida: envase y materia prima, proveedor, terceros (uno calificado, otro vencido) y bodegas.
insert into public.materials (id, code, name, type, unit, requires_coa) values
  ('f8000000-0000-4000-8000-000000000001', 'EN-981', 'Envase PET de prueba', 'envase', 'und', false),
  ('f8000000-0000-4000-8000-000000000002', 'MP-981', 'Materia prima de prueba', 'mp', 'kg', false);
select pg_temp.login_as('b8000000-0000-4000-8000-000000000001');
select set_config('t.sup', public.save_external_party(null, '{"name": "Proveedor T", "kind": "proveedor"}')::text, false);
select set_config('t.maq', public.save_external_party(null, '{"name": "Maquila T", "kind": "maquilador"}')::text, false);
select set_config('t.sur', public.save_external_party(null, '{"name": "Almacenes T", "kind": "almacenamiento"}')::text, false);
select public.create_warehouse('{"code": "BOD-TME", "name": "Envase de prueba", "function": "material_envase", "location_prefix": "TN"}',
  array['material_envase'], 1, 2, 2);
select public.create_warehouse('{"code": "BOD-TMP", "name": "MP de prueba", "function": "materias_primas", "location_prefix": "TM"}',
  array['materia_prima'], 1, 1, 2);
select public.create_warehouse(jsonb_build_object('code', 'BOD-TX1', 'name', 'Externa calificada', 'function', 'material_envase',
  'site_type', 'externa', 'external_party_id', pg_temp.v('maq'), 'location_prefix', 'TE-01'), array['material_envase'], 1, 1, 2);
select public.create_warehouse(jsonb_build_object('code', 'BOD-TX2', 'name', 'Externa vencida', 'function', 'material_envase',
  'site_type', 'externa', 'external_party_id', pg_temp.v('sur'), 'location_prefix', 'TE-02'), array['material_envase'], 1, 1, 1);
reset role;
select pg_temp.login_as('b8000000-0000-4000-8000-000000000003');
select public.qualify_external_party(pg_temp.v('maq'), true, '2027-03-31', 'Auditoría', 'Calificación');
select public.qualify_external_party(pg_temp.v('sur'), true, '2026-09-30', 'Auditoría', 'Calificación');
select public.decide_external_warehouse(pg_temp.wh('BOD-TX1'), true, null, 'Clave-Prueba-2026');
select public.decide_external_warehouse(pg_temp.wh('BOD-TX2'), true, null, 'Clave-Prueba-2026');
reset role;
insert into app_private.test_clock (now_override) values ('2026-10-05 10:00-05');

-- Lotes: envase aprobado (3.000 u) y materia prima en cuarentena.
select pg_temp.login_as('b8000000-0000-4000-8000-000000000002');
select set_config('t.env', (public.receive_material_lot(jsonb_build_object('material_id', 'f8000000-0000-4000-8000-000000000001',
  'supplier_id', pg_temp.v('sup'), 'supplier_lot', 'ENV-2510-A', 'qty', 3000, 'expiry_date', '2030-12-31'),
  pg_temp.loc('TN-E01-P1-01')) ->> 'id'), false);
select set_config('t.mp', (public.receive_material_lot(jsonb_build_object('material_id', 'f8000000-0000-4000-8000-000000000002',
  'supplier_id', pg_temp.v('sup'), 'supplier_lot', 'MP-1', 'qty', 16, 'expiry_date', '2028-03-15'),
  pg_temp.loc('TM-E01-P1-01')) ->> 'id'), false);
reset role;
select pg_temp.login_as('b8000000-0000-4000-8000-000000000004');
select public.record_lot_results(pg_temp.v('env'), jsonb_build_array(jsonb_build_object(
  'test_id', (select id from public.lot_tests where lot_id = pg_temp.v('env')), 'value', 'Conforme', 'conforming', true)));
reset role;
select pg_temp.login_as('b8000000-0000-4000-8000-000000000005');
select public.release_material_lot(pg_temp.v('env'), 'aprobado', null, 'Clave-Prueba-2026');
reset role;

-- =====================================================================
-- Reglas del borrador (AC-24, lote no aprobado)
-- =====================================================================
select pg_temp.login_as('b8000000-0000-4000-8000-000000000002');
select throws_like($$ select public.save_transfer_draft(null, pg_temp.wh('BOD-TME'), pg_temp.wh('BOD-TX2'), 'Envío a maquila',
    jsonb_build_array(jsonb_build_object('lot_id', pg_temp.v('env'), 'qty', 100, 'from_location_id', pg_temp.loc('TN-E01-P1-01')))) $$,
  '%EXTERNAL_SITE_NOT_QUALIFIED%vencida el 30/09/2026%', 'AC-24: no se envía a una bodega con la calificación vencida');
select throws_like($$ select public.save_transfer_draft(null, pg_temp.wh('BOD-TMP'), pg_temp.wh('BOD-TX1'), 'Envío',
    jsonb_build_array(jsonb_build_object('lot_id', pg_temp.v('mp'), 'qty', 16, 'from_location_id', pg_temp.loc('TM-E01-P1-01')))) $$,
  '%LOT_NOT_APPROVED%cuarentena%', 'un lote en cuarentena no sale de la bodega');
select throws_like($$ select public.save_transfer_draft(null, pg_temp.wh('BOD-TME'), pg_temp.wh('BOD-TX1'), 'Envío',
    jsonb_build_array(jsonb_build_object('lot_id', pg_temp.v('env'), 'qty', 5000, 'from_location_id', pg_temp.loc('TN-E01-P1-01')))) $$,
  '%INSUFFICIENT_STOCK%', 'no se envía más de lo que hay en la ubicación');
select throws_like($$ select public.save_transfer_draft(null, pg_temp.wh('BOD-TME'), pg_temp.wh('BOD-TX1'), '',
    jsonb_build_array(jsonb_build_object('lot_id', pg_temp.v('env'), 'qty', 1500, 'from_location_id', pg_temp.loc('TN-E01-P1-01')))) $$,
  '%REASON_REQUIRED%', 'el traslado exige motivo');
select set_config('t.tr', (public.save_transfer_draft(null, pg_temp.wh('BOD-TME'), pg_temp.wh('BOD-TX1'), 'Envío a maquila para llenado',
  jsonb_build_array(jsonb_build_object('lot_id', pg_temp.v('env'), 'qty', 1500, 'from_location_id', pg_temp.loc('TN-E01-P1-01'))))
  ->> 'id'), false);
select matches((select code from public.stock_transfers where id = pg_temp.v('tr')), '^TR-2026-[0-9]{4}$', 'el traslado se numera TR-AAAA-NNNN');

-- =====================================================================
-- Despacho con dos firmas (RF-25)
-- =====================================================================
select is(public.dispatch_transfer(pg_temp.v('tr'), 'Clave-Prueba-2026') ->> 'status', 'borrador',
  'Marta firma el despacho («Ejecuté»): falta la aprobación');
select throws_like($$ select public.dispatch_transfer(pg_temp.v('tr'), 'Clave-Prueba-2026') $$, '%FORBIDDEN_ROLE%',
  'el auxiliar no aprueba el despacho');
reset role;
select is(pg_temp.at(pg_temp.v('env'), 'TN-E01-P1-01'), 3000.0000, 'sin aprobación el material no sale');
select pg_temp.login_as('b8000000-0000-4000-8000-000000000001');
select is(public.dispatch_transfer(pg_temp.v('tr'), 'Clave-Prueba-2026') ->> 'status', 'despachado',
  'el jefe de bodega aprueba y el traslado queda despachado (en tránsito)');
reset role;
select is(pg_temp.at(pg_temp.v('env'), 'TN-E01-P1-01'), 1500.0000, 'sale del origen: 3.000 − 1.500');
select is((select qty_in_transit from public.v_lot_stock where id = pg_temp.v('env')), 1500.0000, 'quedan 1.500 en tránsito');
select is((select qty_on_hand + qty_in_transit from public.v_lot_stock where id = pg_temp.v('env')), 3000.0000,
  'en ubicaciones más en tránsito suman lo recibido');
select throws_like($$ update public.stock_transfer_lines set qty = 1 where transfer_id = pg_temp.v('tr') $$,
  '%RECORD_LOCKED%', 'las líneas de un traslado despachado no cambian');

-- SOD: quien despacha no aprueba.
select pg_temp.login_as('b8000000-0000-4000-8000-000000000001');
select set_config('t.tr2', (public.save_transfer_draft(null, pg_temp.wh('BOD-TME'), pg_temp.wh('BOD-TX1'), 'Segundo envío',
  jsonb_build_array(jsonb_build_object('lot_id', pg_temp.v('env'), 'qty', 100, 'from_location_id', pg_temp.loc('TN-E01-P1-01'))))
  ->> 'id'), false);
select public.dispatch_transfer(pg_temp.v('tr2'), 'Clave-Prueba-2026');
select throws_like($$ select public.dispatch_transfer(pg_temp.v('tr2'), 'Clave-Prueba-2026') $$, '%SOD_VIOLATION%',
  'quien despacha no aprueba el mismo traslado');
select is(public.cancel_transfer(pg_temp.v('tr2'), 'Ya no se envía') ->> 'status', 'anulado', 'un borrador se anula con motivo');
select throws_like($$ select public.cancel_transfer(pg_temp.v('tr'), 'Arrepentido') $$, '%INVALID_TRANSITION%',
  'un traslado despachado no se anula');

-- =====================================================================
-- Recepción en la bodega externa
-- =====================================================================
select throws_like($$ select public.receive_transfer(pg_temp.v('tr'),
    jsonb_build_object((select id from public.stock_transfer_lines where transfer_id = pg_temp.v('tr'))::text, pg_temp.loc('TE-01-E01-P1-01')),
    '', 'Clave-Prueba-2026') $$, '%INVALID_FIELD%acta%', 'la recepción externa exige el acta del maquilador');
select is(public.receive_transfer(pg_temp.v('tr'),
    jsonb_build_object((select id from public.stock_transfer_lines where transfer_id = pg_temp.v('tr'))::text, pg_temp.loc('TE-01-E01-P1-01')),
    'Acta de recepción AR-0091', 'Clave-Prueba-2026') ->> 'status', 'recibido', 'RF-25: se firma la recepción con el acta');
reset role;
select is((select qty_in_transit from public.v_lot_stock where id = pg_temp.v('env')), 0.0000, 'nada queda en tránsito');
select is(pg_temp.at(pg_temp.v('env'), 'TE-01-E01-P1-01'), 1500.0000, 'el saldo aparece en la ubicación externa');
delete from app_private.test_clock;

-- Semilla del Prompt 0B (si está cargada): TR-2026-0007 en tránsito de BOD-ME a BOD-EXT-01 con 1.500 envases.
select ok(not exists (select 1 from public.stock_transfers where code = 'TR-2026-0007')
  or exists (select 1 from public.stock_transfers t join public.stock_transfer_lines l on l.transfer_id = t.id
             join public.material_lots ml on ml.id = l.lot_id
             where t.code = 'TR-2026-0007' and t.status = 'despachado' and l.qty = 1500 and ml.supplier_lot = 'ENV-2510-A'
               and t.from_warehouse_id = pg_temp.wh('BOD-ME') and t.to_warehouse_id = pg_temp.wh('BOD-EXT-01')),
  'semilla 0B: TR-2026-0007 está despachado (en tránsito) con 1.500 envases del lote ENV-2510-A');

select * from finish();
rollback;
