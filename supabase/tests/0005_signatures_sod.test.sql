-- E1 · Firma electrónica (DI-2), huella (DI-7), bloqueo tras firma (DI-3, AC-02) y segregación de
-- funciones SOD-1…SOD-10 (AC-01): cada regla con su caso prohibido y su caso permitido.
begin;
select plan(43);

-- ---------------------------------------------------------------------------
-- Preparación (como dueño): usuarios, tablas de prueba, permisos y registros
-- ---------------------------------------------------------------------------
select pg_temp.test_user('diego@p.test', 'Diego Cárdenas', '{prod_aux}', p_id => 'a0000000-0000-4000-8000-000000000001');
select pg_temp.test_user('paola@p.test', 'Paola Mejía', '{prod_coord}', p_id => 'a0000000-0000-4000-8000-000000000002');
select pg_temp.test_user('natalia@p.test', 'Natalia Ruiz', '{lab_aux}', p_id => 'a0000000-0000-4000-8000-000000000003');
select pg_temp.test_user('ricardo@p.test', 'Ricardo Peña', '{cc_jefe}', p_id => 'a0000000-0000-4000-8000-000000000004');
select pg_temp.test_user('lucia@p.test', 'Lucía Barrera', '{aq_dir}', p_id => 'a0000000-0000-4000-8000-000000000005');
select pg_temp.test_user('gaviria@p.test', 'Dr. Esteban Gaviria', '{dt}', p_id => 'a0000000-0000-4000-8000-000000000006');
select pg_temp.test_user('tomas@p.test', 'Tomás Herrera', '{admin,cc_jefe}', p_id => 'a0000000-0000-4000-8000-000000000007');
select pg_temp.test_user('gabriela@p.test', 'Gabriela Torres', '{master,prod_aux}', p_id => 'a0000000-0000-4000-8000-000000000008');
select pg_temp.test_user('valentina@p.test', 'Valentina Cruz', '{aq_doc,prod_aux}', p_id => 'a0000000-0000-4000-8000-000000000009');
select pg_temp.test_user('sebastian@p.test', 'Sebastián Rojas', '{idi}', p_id => 'a0000000-0000-4000-8000-000000000010');
select pg_temp.test_user('dt2@p.test', 'Directora Suplente', '{dt,prod_aux}', p_id => 'a0000000-0000-4000-8000-000000000011');

select pg_temp.fixture_table('_t_fab', 'fabricacion', p_execution => true);
select pg_temp.fixture_table('_t_disp', 'dispensacion', p_execution => true);
select pg_temp.fixture_table('_t_doc', 'documento', p_document => true, p_group => false);
select pg_temp.fixture_table('_t_ana', 'analisis', p_quality => true);
select pg_temp.fixture_table('_t_cert', 'certificado', p_quality => true);
select pg_temp.fixture_table('_t_lote', 'lote', p_quality => true);

insert into public.sign_permissions (table_name, meaning, role, requires_meaning, sets_status) values
  ('_t_fab', 'ejecuto', 'prod_aux', null, 'ejecutado'),
  ('_t_fab', 'verifico', 'prod_aux', 'ejecuto', 'verificado'),
  ('_t_fab', 'verifico', 'prod_coord', 'ejecuto', 'verificado'),
  ('_t_disp', 'ejecuto', 'prod_aux', null, 'ejecutado'),
  ('_t_disp', 'verifico', 'prod_aux', 'ejecuto', 'verificado'),
  ('_t_disp', 'verifico', 'prod_coord', 'ejecuto', 'verificado'),
  ('_t_disp', 'aprobo', 'prod_coord', 'verifico', 'aprobado'),
  ('_t_disp', 'aprobo', 'dt', 'verifico', 'aprobado'),
  ('_t_doc', 'reviso', 'aq_dir', null, 'en_aprobacion'),
  ('_t_doc', 'reviso', 'idi', null, 'en_aprobacion'),
  ('_t_doc', 'aprobo', 'aq_dir', 'reviso', 'aprobado'),
  ('_t_doc', 'aprobo', 'idi', 'reviso', 'aprobado'),
  ('_t_ana', 'ejecuto', 'lab_aux', null, 'ejecutado'),
  ('_t_ana', 'ejecuto', 'cc_jefe', null, 'ejecutado'),
  ('_t_cert', 'aprobo', 'cc_jefe', null, 'aprobado'),
  ('_t_lote', 'libero', 'dt', null, 'liberado');

-- Lotes B1 y B2.
insert into public._t_fab (id, batch_id, value) values
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'paso 1'),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'paso 2');
insert into public._t_disp (id, batch_id, value) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'glicerina 60,00 kg'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'agua 1.884,00 kg'),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'perfume 1,00 kg');
insert into public._t_doc (id, value, created_by) values
  ('e0000000-0000-4000-8000-000000000001', 'Fórmula ClariPlus v04', 'a0000000-0000-4000-8000-000000000010'),
  ('e0000000-0000-4000-8000-000000000002', 'Instructivo ClariPlus v04', 'a0000000-0000-4000-8000-000000000010');
insert into public._t_ana (id, batch_id, value) values
  ('c1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'pH 5,6');
insert into public._t_cert (id, batch_id, value) values
  ('c2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'CA lote B1'),
  ('c2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'CA lote B2'),
  ('c2000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'CA lote B2 bis');
insert into public._t_lote (id, batch_id, value) values
  ('10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Lote B1');

-- ---------------------------------------------------------------------------
-- Reautenticación: contraseña errónea, intentos restantes y bloqueo de firma
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-4000-8000-000000000003'); -- Natalia
select is(public.sign_record('_t_ana', 'c1000000-0000-4000-8000-000000000001', 'ejecuto', 'mala') ->> 'code',
  'REAUTH_FAILED', 'contraseña errónea → REAUTH_FAILED');
select is((public.sign_record('_t_ana', 'c1000000-0000-4000-8000-000000000001', 'ejecuto', 'mala') ->> 'remaining')::int,
  1, 'informa los intentos restantes');
select is(public.sign_record('_t_ana', 'c1000000-0000-4000-8000-000000000001', 'ejecuto', 'mala') ->> 'code',
  'REAUTH_LOCKED', 'al tercer intento se bloquea la firma');
select is(public.sign_record('_t_ana', 'c1000000-0000-4000-8000-000000000001', 'ejecuto', 'Clave-Prueba-2026') ->> 'code',
  'REAUTH_LOCKED', 'bloqueada, ni la contraseña correcta firma');
reset role;
select is((select count(*)::int from public.signatures where user_id = 'a0000000-0000-4000-8000-000000000003'),
  0, 'los intentos fallidos no crean firmas');

-- ---------------------------------------------------------------------------
-- Firma correcta, huella, estado y bloqueo (AC-02, SOD-10)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001'); -- Diego
select is(public.sign_record('_t_disp', 'd0000000-0000-4000-8000-000000000001', 'ejecuto', 'Clave-Prueba-2026', 'Dispensado según SD-2026-0042') ->> 'ok',
  'true', 'Diego firma «Ejecuté» con su contraseña');
select throws_like($$ select public.sign_record('_t_disp', 'd0000000-0000-4000-8000-000000000001', 'ejecuto', 'Clave-Prueba-2026') $$,
  '%INVALID_TRANSITION%', 'no se repite la misma firma en el mismo registro');
select throws_like($$ select public.sign_record('_t_disp', 'd0000000-0000-4000-8000-000000000002', 'verifico', 'Clave-Prueba-2026') $$,
  '%INVALID_TRANSITION%', 'no se verifica lo que no se ha ejecutado');
reset role;

select is((select status from public._t_disp where id = 'd0000000-0000-4000-8000-000000000001'),
  'ejecutado', 'la firma cambia el estado del registro');
select isnt((select locked_at from public._t_disp where id = 'd0000000-0000-4000-8000-000000000001'),
  null, 'la firma bloquea el registro');
select is(
  (select record_hash from public.signatures where record_id = 'd0000000-0000-4000-8000-000000000001'),
  (select public.record_hash(to_jsonb(t)) from public._t_disp t where id = 'd0000000-0000-4000-8000-000000000001'),
  'la huella es el SHA-256 del contenido canónico del registro'
);
select ok(public.verify_signature_integrity(
  (select id from public.signatures where record_id = 'd0000000-0000-4000-8000-000000000001')),
  'verify_signature_integrity confirma la huella');
select is(
  (select short_signature || ' · ' || reason from public.signatures where record_id = 'd0000000-0000-4000-8000-000000000001'),
  'D. Cárdenas · Dispensado según SD-2026-0042', 'la firma guarda firma corta y motivo'
);
select throws_like($$ update public._t_disp set value = 'glicerina 61,00 kg' where id = 'd0000000-0000-4000-8000-000000000001' $$,
  '%RECORD_LOCKED%', 'AC-02: editar un registro firmado → RECORD_LOCKED');
select throws_like($$ delete from public._t_disp where id = 'd0000000-0000-4000-8000-000000000001' $$,
  '%RECORD_LOCKED%', 'AC-02: borrar un registro firmado → RECORD_LOCKED');
select throws_like($$ update public.signatures set reason = 'alterado' $$,
  '%RECORD_LOCKED%', 'las firmas no se modifican');
select ok(
  (select count(*) from public.audit_log where table_name = 'signatures'
     and after ->> 'record_id' = 'd0000000-0000-4000-8000-000000000001') = 1
  and (select count(*) from public.audit_log where table_name = '_t_disp' and action = 'update'
     and record_id = 'd0000000-0000-4000-8000-000000000001') = 1,
  'la firma y el cambio de estado quedan en la bitácora'
);

-- ---------------------------------------------------------------------------
-- SOD-1 / AC-01: quien ejecuta no verifica
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001'); -- Diego
select is(public.sign_record('_t_fab', 'f0000000-0000-4000-8000-000000000001', 'ejecuto', 'Clave-Prueba-2026') ->> 'ok',
  'true', 'Diego ejecuta el paso 1');
select throws_like($$ select public.sign_record('_t_fab', 'f0000000-0000-4000-8000-000000000001', 'verifico', 'Clave-Prueba-2026') $$,
  '%SOD_VIOLATION: SOD-1%', 'AC-01 / SOD-1: el mismo usuario ejecuta y verifica → SOD_VIOLATION');
select is(public.can_sign('_t_fab', 'f0000000-0000-4000-8000-000000000001', 'verifico') ->> 'code',
  'SOD_VIOLATION', 'can_sign avisa la segregación antes de pedir la contraseña');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000002'); -- Paola
select is(public.sign_record('_t_fab', 'f0000000-0000-4000-8000-000000000001', 'verifico', 'Clave-Prueba-2026') ->> 'ok',
  'true', 'SOD-1 permitido: otra persona verifica');
reset role;

-- ---------------------------------------------------------------------------
-- SOD-4: quien dispensa no verifica la dispensación del mismo ítem
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001'); -- Diego
select throws_like($$ select public.sign_record('_t_disp', 'd0000000-0000-4000-8000-000000000001', 'verifico', 'Clave-Prueba-2026') $$,
  '%SOD_VIOLATION%', 'SOD-4: quien dispensó no verifica la dispensación');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000002'); -- Paola
select is(public.sign_record('_t_disp', 'd0000000-0000-4000-8000-000000000001', 'verifico', 'Clave-Prueba-2026') ->> 'ok',
  'true', 'SOD-4 permitido: la coordinadora verifica');

-- ---------------------------------------------------------------------------
-- SOD-2: quien verifica no aprueba
-- ---------------------------------------------------------------------------
select throws_like($$ select public.sign_record('_t_disp', 'd0000000-0000-4000-8000-000000000001', 'aprobo', 'Clave-Prueba-2026') $$,
  '%SOD_VIOLATION: SOD-2%', 'SOD-2: quien verificó no aprueba');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000006'); -- Gaviria
select is(public.sign_record('_t_disp', 'd0000000-0000-4000-8000-000000000001', 'aprobo', 'Clave-Prueba-2026') ->> 'ok',
  'true', 'SOD-2 permitido: el director técnico aprueba');
reset role;

-- ---------------------------------------------------------------------------
-- SOD-3 y SOD-8: el autor no revisa ni aprueba; el revisor sí puede aprobar
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-4000-8000-000000000010'); -- Sebastián, autor
select throws_like($$ select public.sign_record('_t_doc', 'e0000000-0000-4000-8000-000000000001', 'reviso', 'Clave-Prueba-2026') $$,
  '%SOD_VIOLATION: SOD-8%', 'SOD-8: el autor no revisa su versión');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000005'); -- Lucía revisa
select is(public.sign_record('_t_doc', 'e0000000-0000-4000-8000-000000000001', 'reviso', 'Clave-Prueba-2026') ->> 'ok',
  'true', 'SOD-8 permitido: otra persona revisa');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000010'); -- Sebastián intenta aprobar
select throws_like($$ select public.sign_record('_t_doc', 'e0000000-0000-4000-8000-000000000001', 'aprobo', 'Clave-Prueba-2026') $$,
  '%SOD_VIOLATION: SOD-3%', 'SOD-3: quien crea la versión no la aprueba');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000005'); -- Lucía aprueba lo que revisó
select is(public.sign_record('_t_doc', 'e0000000-0000-4000-8000-000000000001', 'aprobo', 'Clave-Prueba-2026') ->> 'ok',
  'true', 'SOD-3/SOD-8 permitido: el revisor sí puede aprobar');
reset role;
select throws_like($$ update public._t_doc set value = 'Fórmula ClariPlus v04 editada' where id = 'e0000000-0000-4000-8000-000000000001' $$,
  '%RECORD_LOCKED%', 'SOD-10: una versión aprobada no se edita');
select lives_ok($$ update public._t_doc set value = 'Instructivo ClariPlus v04 (borrador)' where id = 'e0000000-0000-4000-8000-000000000002' $$,
  'SOD-10 permitido: una versión en borrador sí se edita');

-- ---------------------------------------------------------------------------
-- SOD-5: quien analiza no aprueba el certificado de ese lote
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-4000-8000-000000000004'); -- Ricardo
select is(public.sign_record('_t_ana', 'c1000000-0000-4000-8000-000000000001', 'ejecuto', 'Clave-Prueba-2026') ->> 'ok',
  'true', 'Ricardo ejecuta el análisis del lote B1');
select throws_like($$ select public.sign_record('_t_cert', 'c2000000-0000-4000-8000-000000000001', 'aprobo', 'Clave-Prueba-2026') $$,
  '%SOD_VIOLATION: SOD-5%', 'SOD-5: quien analizó no aprueba el certificado del mismo lote');
select is(public.sign_record('_t_cert', 'c2000000-0000-4000-8000-000000000002', 'aprobo', 'Clave-Prueba-2026') ->> 'ok',
  'true', 'SOD-5 permitido: aprueba el certificado de otro lote');
reset role;

-- ---------------------------------------------------------------------------
-- SOD-6: quien libera el lote no pudo haber ejecutado pasos de ese lote
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-4000-8000-000000000011'); -- Directora suplente (dt + prod_aux)
select is(public.sign_record('_t_fab', 'f0000000-0000-4000-8000-000000000002', 'ejecuto', 'Clave-Prueba-2026') ->> 'ok',
  'true', 'la directora suplente ejecuta un paso del lote B1');
select throws_like($$ select public.sign_record('_t_lote', '10000000-0000-4000-8000-000000000001', 'libero', 'Clave-Prueba-2026') $$,
  '%SOD_VIOLATION: SOD-6%', 'SOD-6: quien ejecutó pasos del lote no lo libera');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000006'); -- Gaviria
select is(public.sign_record('_t_lote', '10000000-0000-4000-8000-000000000001', 'libero', 'Clave-Prueba-2026') ->> 'ok',
  'true', 'SOD-6 permitido: libera un director técnico que no ejecutó pasos');
reset role;

-- ---------------------------------------------------------------------------
-- SOD-7: admin no firma registros de calidad
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-4000-8000-000000000007'); -- Tomás (admin + cc_jefe)
select throws_like($$ select public.sign_record('_t_cert', 'c2000000-0000-4000-8000-000000000003', 'aprobo', 'Clave-Prueba-2026') $$,
  '%FORBIDDEN_ROLE: SOD-7%', 'SOD-7: el administrador no firma registros de calidad');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000004'); -- Ricardo
select is(public.sign_record('_t_cert', 'c2000000-0000-4000-8000-000000000003', 'aprobo', 'Clave-Prueba-2026') ->> 'ok',
  'true', 'SOD-7 permitido: el jefe de calidad sin rol admin firma');
reset role;

-- ---------------------------------------------------------------------------
-- SOD-9: master y aq_doc no firman registros de ejecución
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-4000-8000-000000000008'); -- Gabriela (master + prod_aux)
select throws_like($$ select public.sign_record('_t_disp', 'd0000000-0000-4000-8000-000000000002', 'ejecuto', 'Clave-Prueba-2026') $$,
  '%FORBIDDEN_ROLE: SOD-9%', 'SOD-9: el usuario master no firma ejecución');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000009'); -- Valentina (aq_doc + prod_aux)
select throws_like($$ select public.sign_record('_t_disp', 'd0000000-0000-4000-8000-000000000002', 'ejecuto', 'Clave-Prueba-2026') $$,
  '%FORBIDDEN_ROLE: SOD-9%', 'SOD-9: la analista de gestión documental no firma ejecución');
reset role;
select pg_temp.login_as('a0000000-0000-4000-8000-000000000001'); -- Diego
select is(public.sign_record('_t_disp', 'd0000000-0000-4000-8000-000000000002', 'ejecuto', 'Clave-Prueba-2026') ->> 'ok',
  'true', 'SOD-9 permitido: el auxiliar de producción firma ejecución');
reset role;

-- ---------------------------------------------------------------------------
-- Rol sin permiso para el significado
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-4000-8000-000000000010'); -- Sebastián (idi)
select throws_like($$ select public.sign_record('_t_disp', 'd0000000-0000-4000-8000-000000000003', 'ejecuto', 'Clave-Prueba-2026') $$,
  '%FORBIDDEN_ROLE%', 'un rol sin permiso de firma recibe FORBIDDEN_ROLE');
reset role;

select * from finish();
rollback;
