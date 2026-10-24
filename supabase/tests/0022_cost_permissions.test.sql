-- E4 · RF-17 (PRD 1.8): los costos de fórmula solo los ven I+D, Dirección técnica y Gerencia; los elabora I+D.
begin;
select plan(9);

select pg_temp.test_user('sebastian@p.test', 'Sebastián Rojas', '{idi}', p_id => 'b5000000-0000-4000-8000-000000000001');
select pg_temp.test_user('esteban@p.test', 'Dr. Esteban Gaviria', '{dt}', p_id => 'b5000000-0000-4000-8000-000000000002');
select pg_temp.test_user('marcela@p.test', 'Marcela Duarte', '{gerencia}', p_id => 'b5000000-0000-4000-8000-000000000003');
select pg_temp.test_user('camila@p.test', 'Camila Ortega', '{comercial}', p_id => 'b5000000-0000-4000-8000-000000000004');
select pg_temp.test_user('paola@p.test', 'Paola Mejía', '{prod_coord}', p_id => 'b5000000-0000-4000-8000-000000000005');
select pg_temp.test_user('ines@p.test', 'Inés Valencia', '{auditor}', p_id => 'b5000000-0000-4000-8000-000000000006');

create or replace function pg_temp.costs_for(p_user uuid) returns boolean language plpgsql as $$
declare v boolean;
begin
  perform pg_temp.login_as(p_user);
  v := public.can_read_costs();
  reset role;
  return v;
end;
$$;

select is((select string_agg(role || ':' || cell_text, ',' order by role) from public.module_permissions mp
           join public.roles r on r.code = mp.role and r.is_system
           where module_code = 'costos_de_formula' and cell_text <> '—'), 'dt:L,gerencia:L,idi:C',
  'RF-17: la fila «Costos de fórmula» del PRD 1.8 da acceso solo a I+D, DT y Gerencia');
select is((select count(*)::int from public.module_permissions where module_code = 'costos_de_formula'),
  (select count(*)::int from public.roles), 'una celda por rol, incluidos los roles adicionales');
select ok(pg_temp.costs_for('b5000000-0000-4000-8000-000000000001'), 'RF-17: I+D ve los costos');
select ok(pg_temp.costs_for('b5000000-0000-4000-8000-000000000002'), 'RF-17: Dirección técnica ve los costos');
select ok(pg_temp.costs_for('b5000000-0000-4000-8000-000000000003'), 'RF-17: Gerencia ve los costos');
select ok(not pg_temp.costs_for('b5000000-0000-4000-8000-000000000004'), 'RF-17: Comercial ya no ve los costos');
select ok(not pg_temp.costs_for('b5000000-0000-4000-8000-000000000005') and not pg_temp.costs_for('b5000000-0000-4000-8000-000000000006'),
  'RF-17: ni el coordinador de producción ni el auditor ven los costos');

select pg_temp.login_as('b5000000-0000-4000-8000-000000000002');
select throws_like($$ select public.save_cost_sheet(gen_random_uuid(), null, 100, 1, '{}', '[]', '{}', 'Prueba') $$,
  '%FORBIDDEN_ROLE%', 'Dirección técnica lee los costos pero no elabora la hoja');
reset role;
select pg_temp.login_as('b5000000-0000-4000-8000-000000000001');
select throws_like($$ select public.save_cost_sheet(null, null, 100, 1, '{}', '[]', '{}', 'Prueba') $$,
  '%INVALID_FIELD%', 'I+D pasa el control de rol (la validación siguiente es de datos)');
reset role;

select * from finish();
rollback;
