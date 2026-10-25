-- E5 · Bodegas, estantes y ubicaciones (RF-23, AC-27), terceros con calificación (D-17) y bodegas externas con
-- aprobación de Aseguramiento de la calidad (D-20).
begin;
select plan(19);

select pg_temp.test_user('hernan@p.test', 'Hernán Salgado', '{bodega_jefe}', p_id => 'b6000000-0000-4000-8000-000000000001');
select pg_temp.test_user('marta@p.test', 'Marta Quintero', '{bodega_aux}', p_id => 'b6000000-0000-4000-8000-000000000002');
select pg_temp.test_user('lucia@p.test', 'Lucía Barrera', '{aq_dir}', p_id => 'b6000000-0000-4000-8000-000000000003');
select pg_temp.test_user('tomas@p.test', 'Tomás Herrera', '{admin}', p_id => 'b6000000-0000-4000-8000-000000000004');
select pg_temp.test_user('camila@p.test', 'Camila Ortega', '{comercial}', p_id => 'b6000000-0000-4000-8000-000000000005');

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$ select current_setting('t.' || p_key)::uuid $$;

-- =====================================================================
-- Terceros y calificación (D-17)
-- =====================================================================
select pg_temp.login_as('b6000000-0000-4000-8000-000000000001');
select set_config('t.party', public.save_external_party(null, '{"name": "Maquilas de Prueba S.A.S.", "kind": "maquilador"}')::text, false);
select throws_like($$ select public.qualify_external_party(pg_temp.v('party'), true, '2027-03-31', 'Auditoría 2026', 'Calificación') $$,
  '%FORBIDDEN_ROLE%', 'D-17: bodega no califica terceros');
reset role;
select pg_temp.login_as('b6000000-0000-4000-8000-000000000003');
select throws_like($$ select public.qualify_external_party(pg_temp.v('party'), true, null, 'Auditoría', 'Calificación') $$,
  '%INVALID_FIELD%', 'la calificación exige fecha de vencimiento');
select is(public.qualify_external_party(pg_temp.v('party'), true, '2027-03-31', 'Auditoría 2026', 'Calificación inicial') ->> 'qualified',
  'true', 'D-17: Aseguramiento de la calidad califica al tercero');
reset role;

-- =====================================================================
-- Bodegas y ubicaciones (RF-23, AC-27)
-- =====================================================================
select pg_temp.login_as('b6000000-0000-4000-8000-000000000002');
select throws_like($$ select public.create_warehouse('{"code": "BOD-T9", "name": "x", "function": "materias_primas", "location_prefix": "TN"}',
    array['materia_prima'], 1, 1, 1) $$, '%FORBIDDEN_ROLE%', 'el auxiliar de bodega no crea bodegas');
reset role;
select pg_temp.login_as('b6000000-0000-4000-8000-000000000001');
select set_config('t.wh', (public.create_warehouse(
  '{"code": "BOD-TMP", "name": "Bodega de prueba", "function": "materias_primas", "location_prefix": "TM"}',
  array['materia_prima'], 6, 4, 2) ->> 'id'), false);
reset role;
select is((select count(*)::int from public.storage_locations where warehouse_id = pg_temp.v('wh')), 48,
  'AC-27: 6 estantes × 4 pisos × 2 posiciones = 48 ubicaciones');
select is((select count(distinct code)::int from public.storage_locations where warehouse_id = pg_temp.v('wh')), 48,
  'AC-27: los 48 códigos son únicos');
select is((select array_agg(code order by code) from public.storage_locations
           where warehouse_id = pg_temp.v('wh') and code in ('TM-E01-P1-01', 'TM-E03-P2-01', 'TM-E06-P4-02')),
  array['TM-E01-P1-01', 'TM-E03-P2-01', 'TM-E06-P4-02'], 'códigos PREFIJO-Eee-Pp-nn (estante, piso, posición)');
select is((select count(*)::int from public.racks where warehouse_id = pg_temp.v('wh')), 6, 'seis estantes E01…E06');
select is((select status from public.warehouses where id = pg_temp.v('wh')), 'activa', 'una bodega interna nace activa');

select pg_temp.login_as('b6000000-0000-4000-8000-000000000004');
select is(public.generate_locations(pg_temp.v('wh'), 2, 3, 4), 24, 'el administrador agrega 2 × 3 × 4 = 24 ubicaciones');
reset role;
select is((select max(code) from public.racks where warehouse_id = pg_temp.v('wh')), 'E08', 'los estantes nuevos siguen la numeración');

select pg_temp.login_as('b6000000-0000-4000-8000-000000000001');
select throws_like($$ select public.set_location_blocked((select id from public.storage_locations where code = 'TM-E01-P1-01'), true, '') $$,
  '%REASON_REQUIRED%', 'bloquear una ubicación exige motivo');
select lives_ok($$ select public.set_location_blocked((select id from public.storage_locations where code = 'TM-E01-P1-01'), true,
  'Estantería averiada') $$, 'se bloquea con motivo');
select lives_ok($$ select public.set_rack_zone((select id from public.racks where warehouse_id = pg_temp.v('wh') and code = 'E01'),
  'cuarentena', 'Zona de cuarentena (D-16)') $$, 'D-16: el estante E01 queda como zona de cuarentena');

-- =====================================================================
-- Bodega externa pendiente de aprobación (D-20)
-- =====================================================================
select set_config('t.ext', (public.create_warehouse(
  jsonb_build_object('code', 'BOD-TEXT', 'name', 'Bodega externa de prueba', 'function', 'material_envase', 'site_type', 'externa',
                     'external_party_id', pg_temp.v('party'), 'location_prefix', 'TE-01'),
  array['material_envase'], 2, 3, 4) ->> 'id'), false);
select is((select status from public.warehouses where id = pg_temp.v('ext')), 'pendiente_aprobacion',
  'D-20: la bodega externa queda pendiente de aprobación');
select throws_like($$ select public.decide_external_warehouse(pg_temp.v('ext'), true, null, 'Clave-Prueba-2026') $$,
  '%FORBIDDEN_ROLE%', 'D-20: bodega no aprueba su bodega externa');
reset role;
select pg_temp.login_as('b6000000-0000-4000-8000-000000000003');
select is(public.decide_external_warehouse(pg_temp.v('ext'), true, null, 'Clave-Prueba-2026') ->> 'status', 'activa',
  'D-20: Aseguramiento de la calidad aprueba la bodega externa con firma');
reset role;
select ok(exists (select 1 from public.signatures where record_table = 'warehouses' and record_id = pg_temp.v('ext')
  and meaning = 'aprobo'), 'la aprobación queda firmada');

-- RLS: Comercial no ve la estructura de bodegas (matriz 2.2).
select pg_temp.login_as('b6000000-0000-4000-8000-000000000005');
select is((select count(*)::int from public.warehouses where code in ('BOD-TMP', 'BOD-TEXT')), 0,
  'Comercial no ve las bodegas');
reset role;

select * from finish();
rollback;
