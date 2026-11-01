-- Demostración de Producción para el proyecto de desarrollo en la nube (solicitud del responsable, 31/10/2026).
-- La nube solo tiene catálogos (D-63): aquí se cargan los documentos vigentes de ClariPlus que exige una orden de
-- producción (fórmula IDI-FM-001 v03, especificación IDI-EP-007 v02, instructivo IDI-IN-012 v03 y los formatos de
-- despeje PRD-PR-001-FR-01 v04, fabricación PRD-PR-003-FR-01 v03 y envase PRD-PR-004-FR-01 v02 con sus plantillas),
-- lotes de insumo del 0B y la balanza de respaldo BAL-015. Después, seed-remote ejecuta el bloque E7 de seed.sql
-- (OP-2026-0042 / L-2610-018 y OP-2026-0043 / L-2610-019). Todo es ficticio y se reemplaza en la entrega.
-- Idempotente: no hace nada si IDI-FM-001 ya existe. Uso: npm run seed:remote -- --produccion --confirmar
do $$
declare
  v_valentina constant uuid := 'a1000000-0000-4000-8000-000000000014';
  v_lucia constant uuid := 'a1000000-0000-4000-8000-000000000009';
  v_esteban constant uuid := 'a1000000-0000-4000-8000-000000000010';
  v_gabriela constant uuid := 'a1000000-0000-4000-8000-000000000013';
  v_sebastian constant uuid := 'a1000000-0000-4000-8000-000000000002';
  v_marta constant uuid := 'a1000000-0000-4000-8000-000000000003';
  v_prd uuid := (select id from public.products where code = 'PRD-001');
  v_d record;
  v_doc uuid;
  v_ver uuid;
  v_spec uuid;
  v_instr uuid;
  v_l record;
  v_lot uuid;
  v_content jsonb;
begin
  if exists (select 1 from public.controlled_documents where code = 'IDI-FM-001') or v_prd is null then
    return;
  end if;

  -- Documentos vigentes con su cuadro de firmas (Actualizó, Revisó, Aprobó).
  for v_d in
    select * from (values
      ('e2000000-0000-4000-8000-000000000005'::uuid, 'PRD-PR-003-FR-01', 'Formato registro de fabricación', 'FR', 'PRD', 'PRD-PR-003', 3, date '2023-05-15', date '2026-05-15', null::date, v_valentina, 'Inclusión de codificación'),
      ('e2000000-0000-4000-8000-000000000006', 'PRD-PR-001-FR-01', 'Formato prealistamiento y despeje de línea', 'FR', 'PRD', 'PRD-PR-001', 4, date '2024-01-20', date '2027-01-20', null, v_valentina, 'Inclusión del rótulo de limpieza'),
      ('e2000000-0000-4000-8000-000000000007', 'PRD-PR-004-FR-01', 'Formato registro de envase', 'FR', 'PRD', 'PRD-PR-004', 2, date '2024-02-15', date '2027-02-15', null, v_valentina, 'Ajuste del control de peso'),
      ('e2000000-0000-4000-8000-000000000010', 'IDI-IN-012', 'Instructivo de manufactura ClariPlus', 'IN', 'IDI', null, 3, date '2026-08-25', date '2030-09-30', date '2030-09-30', v_valentina, 'Fórmula v3 (P-0007-1)'),
      ('e2000000-0000-4000-8000-000000000011', 'IDI-EP-007', 'Especificación de producto terminado ClariPlus', 'EP', 'IDI', null, 2, date '2025-10-30', date '2026-10-30', date '2030-09-30', v_valentina, 'Ajuste de densidad'),
      ('e4000000-0000-4000-8000-000000000301', 'IDI-FM-001', 'Fórmula maestra ClariPlus', 'FM', 'IDI', null, 3, date '2026-08-25', date '2030-09-30', date '2030-09-30', v_sebastian, 'Fórmula v3 desde el prototipo P-0007-1')
    ) as t(id, code, title, type_code, process, parent_code, version_no, issue, review, reg_expiry, author, change)
  loop
    insert into public.controlled_documents (id, code, title, type_id, process_id, parent_code, sub_type, sub_number, status,
      validity_rule, regulatory_expiry_date, route_id, created_by, updated_by)
    values (v_d.id, v_d.code, v_d.title, (select id from public.document_types where type_code = v_d.type_code),
      (select id from public.organizational_areas where code = v_d.process), v_d.parent_code,
      case when v_d.parent_code is not null then v_d.type_code end,
      case when v_d.parent_code is not null then right(v_d.code, 2)::int end, 'en_elaboracion',
      case when v_d.reg_expiry is not null then 'registro_sanitario' end, v_d.reg_expiry,
      (select id from public.approval_routes where code = 'tecnica'), v_valentina, v_valentina);
    v_content := jsonb_build_object('objetivo', 'Establecer ' || lower(v_d.title) || '.',
      'responsables', 'Dueño del proceso; Aseguramiento de la calidad.',
      'desarrollo', '1. Diligenciar los campos con información puntual y exacta.',
      'documentos_relacionados', 'GCA-PR-001 Procedimiento para la elaboración de documentos.',
      'control_cambios', 'Ver historial de actualizaciones.');
    insert into public.document_versions (document_id, version_no, status, author_id, content, content_hash, change_description,
      issue_date, review_due_date, effective_at, locked_at, created_by, updated_by)
    values (v_d.id, v_d.version_no, 'vigente', v_d.author, v_content, public.record_hash(v_content), v_d.change, v_d.issue,
      v_d.review, v_d.issue::timestamptz + interval '13 hours', v_d.issue::timestamptz + interval '12 hours', v_d.author, v_d.author)
    returning id into v_ver;
    insert into public.signatures (user_id, record_table, record_id, meaning, signed_as, record_hash, short_signature,
      signer_name, group_key, reauth_method, signed_at, created_by, updated_by)
    select s.uid, 'document_versions', v_ver, s.meaning::public.signature_meaning, s.role,
      public.record_hash(app_private.signable_row('document_versions', to_jsonb(dv))), coalesce(sr.short_signature, p.full_name),
      p.full_name, v_d.id::text, 'password', v_d.issue::timestamptz + s.offs, s.uid, s.uid
    from public.document_versions dv,
      (values (v_d.author, 'actualizo', case when v_d.author = v_sebastian then 'idi' else 'aq_doc' end, interval '8 hours'),
              (v_lucia, 'reviso', 'aq_dir', interval '9 hours'), (v_esteban, 'aprobo', 'dt', interval '10 hours')) as s(uid, meaning, role, offs)
    join public.profiles p on p.id = s.uid left join public.signature_registry sr on sr.user_id = s.uid
    where dv.id = v_ver;
    update public.controlled_documents set status = 'vigente', current_version_id = v_ver, next_review_date = v_d.review
    where id = v_d.id;
  end loop;

  -- Plantillas de proceso vigentes: despeje v04, fabricación v03 y envase v02 (pasos del 0B).
  update public.stage_definitions set governing_document_id = 'e2000000-0000-4000-8000-000000000006' where code = 'despeje';
  update public.stage_definitions set governing_document_id = 'e2000000-0000-4000-8000-000000000005' where code = 'fabricacion';
  update public.stage_definitions set governing_document_id = 'e2000000-0000-4000-8000-000000000007' where code = 'envase';
  insert into public.process_templates (id, stage_id, document_version_id, status, created_by)
  select v.tid, (select id from public.stage_definitions where code = v.stage),
    (select current_version_id from public.controlled_documents where id = v.doc), 'borrador', v_gabriela
  from (values ('e3000000-0000-4000-8000-000000000001'::uuid, 'despeje', 'e2000000-0000-4000-8000-000000000006'::uuid),
               ('e3000000-0000-4000-8000-000000000002', 'fabricacion', 'e2000000-0000-4000-8000-000000000005'),
               ('e3000000-0000-4000-8000-000000000004', 'envase', 'e2000000-0000-4000-8000-000000000007')) as v(tid, stage, doc);
  insert into public.process_template_steps (template_id, order_no, label, text, params, requires_equipment, requires_verification,
    checklist_item, created_by)
  select s.tid, s.n, s.label, s.text, s.params::jsonb, s.equipment, s.verify, s.checklist, v_gabriela
  from (values
    ('e3000000-0000-4000-8000-000000000001'::uuid, 1, '1', 'Área libre de materiales de lote anterior', '[]', null::text, true, true),
    ('e3000000-0000-4000-8000-000000000001', 2, '2', 'Equipos limpios y con estado vigente', '[]', null, true, true),
    ('e3000000-0000-4000-8000-000000000001', 3, '3', 'Documentación del lote anterior retirada', '[]', null, true, true),
    ('e3000000-0000-4000-8000-000000000001', 4, '4', 'Materiales conciliados', '[]', null, true, true),
    ('e3000000-0000-4000-8000-000000000002', 1, '1', 'Verificar despeje de línea y limpieza de equipos', '[]', null, true, false),
    ('e3000000-0000-4000-8000-000000000002', 2, '2', 'Cargar agua purificada MP-001', '[{"name": "Cantidad", "unit": "kg", "min": 1884, "max": 1884, "frequency": "por lote"}]', 'TQ-101', false, false),
    ('e3000000-0000-4000-8000-000000000002', 3, '3', 'Calentar fase acuosa a 70–75 °C', '[{"name": "Temperatura", "unit": "°C", "min": 70, "max": 75, "frequency": "cada 30 min"}]', 'TQ-101', false, false),
    ('e3000000-0000-4000-8000-000000000002', 4, '4', 'Disolver glicerina y poloxámero', '[]', null, false, false),
    ('e3000000-0000-4000-8000-000000000002', 5, '5', 'Calentar fase oleosa a 70–75 °C', '[{"name": "Temperatura", "unit": "°C", "min": 70, "max": 75, "frequency": "cada 30 min"}]', 'TQ-101', false, false),
    ('e3000000-0000-4000-8000-000000000002', 6, '6', 'Homogeneizar a 3.000 rpm por 15 min', '[{"name": "Velocidad", "unit": "rpm", "min": 3000, "max": 3000, "frequency": "15 min"}]', 'HM-02', false, false),
    ('e3000000-0000-4000-8000-000000000002', 7, '7', 'Enfriar a 35 °C y agregar perfume', '[{"name": "Temperatura", "unit": "°C", "min": 35, "max": 35, "frequency": "una vez"}]', 'TQ-101', false, false),
    ('e3000000-0000-4000-8000-000000000002', 8, '8', 'Agregar fenoxietanol y etilhexilglicerina', '[]', null, true, false),
    ('e3000000-0000-4000-8000-000000000002', 9, '9', 'Ajustar pH', '[{"name": "pH", "unit": "", "min": 5.0, "max": 6.0, "frequency": "una vez"}]', null, false, false),
    ('e3000000-0000-4000-8000-000000000002', 10, '10', 'Tomar muestra para control de calidad', '[]', null, false, false),
    ('e3000000-0000-4000-8000-000000000002', 11, '11', 'Transferir granel con rótulo', '[{"name": "Granel", "unit": "kg", "min": null, "max": null, "frequency": "una vez"}]', null, false, false),
    ('e3000000-0000-4000-8000-000000000004', 1, '1', 'Verificar el despeje de la línea de envase', '[]', 'LL-03', true, false),
    ('e3000000-0000-4000-8000-000000000004', 2, '2', 'Controlar el peso neto de 200 mL', '[{"name": "Peso neto", "unit": "g", "min": 197.0, "max": 203.0, "frequency": "cada 30 min"}]', 'LL-03', false, false),
    ('e3000000-0000-4000-8000-000000000004', 3, '3', 'Verificar el lote y el vencimiento impresos', '[]', null, true, false)
  ) as s(tid, n, label, text, params, equipment, verify, checklist);
  update public.process_templates set locked_at = now(), status = 'aprobada'
  where id in ('e3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000004');

  -- Fórmula v3 (0B), especificación de producto terminado y pasos del instructivo de manufactura.
  insert into public.formulas (id, document_version_id, product_id, batch_size, created_by)
  values ('e4000000-0000-4000-8000-000000000303',
    (select current_version_id from public.controlled_documents where code = 'IDI-FM-001'), v_prd, 2000, v_sebastian);
  insert into public.formula_items (formula_id, material_id, pct, function, order_no, created_by)
  select 'e4000000-0000-4000-8000-000000000303', m.id, v.pct, m.default_function, v.n, v_sebastian
  from (values ('MP-001', 94.20, 1), ('MP-014', 3.00, 2), ('MP-022', 1.50, 3), ('MP-031', 0.80, 4), ('MP-040', 0.30, 5),
               ('MP-032', 0.10, 6), ('MP-055', 0.05, 7), ('MP-060', 0.05, 8)) as v(code, pct, n)
  join public.materials m on m.code = v.code;
  update public.formulas set locked_at = now() where id = 'e4000000-0000-4000-8000-000000000303';
  insert into public.specifications (document_version_id, scope, product_id, created_by)
  values ((select current_version_id from public.controlled_documents where code = 'IDI-EP-007'), 'pt', v_prd, v_sebastian)
  returning id into v_spec;
  insert into public.spec_parameters (specification_id, order_no, name, method, min_value, max_value, unit, text_limit, created_by) values
    (v_spec, 1, 'pH', 'Potenciometría', 5.0, 6.0, null, null, v_sebastian),
    (v_spec, 2, 'Densidad', 'Picnometría', 0.990, 1.020, 'g/mL', null, v_sebastian),
    (v_spec, 3, 'Aspecto', 'Visual', null, null, null, 'Líquido translúcido incoloro', v_sebastian),
    (v_spec, 4, 'Olor', 'Organoléptico', null, null, null, 'Característico', v_sebastian),
    (v_spec, 5, 'Recuento total de aerobios mesófilos', 'Recuento en placa', null, 100, 'UFC/g', '< 100 UFC/g', v_sebastian),
    (v_spec, 6, 'Pseudomonas aeruginosa', 'Método microbiológico', null, null, null, 'Ausente', v_sebastian);
  update public.specifications set locked_at = now() where id = v_spec;
  insert into public.instructions (document_version_id, product_id, stage, created_by)
  values ((select current_version_id from public.controlled_documents where code = 'IDI-IN-012'), v_prd, 'fabricacion', v_sebastian)
  returning id into v_instr;
  insert into public.instruction_steps (instruction_id, order_no, label, text, requires_equipment, requires_verification, params, created_by)
  select v_instr, s.order_no, s.label, s.text, s.requires_equipment, s.requires_verification, s.params, v_sebastian
  from public.process_template_steps s where s.template_id = 'e3000000-0000-4000-8000-000000000002';
  update public.instructions set locked_at = now() where id = v_instr;

  -- Lotes de insumo del 0B que usa la dispensación de L-2610-018 (el bloque E7 agrega los demás).
  for v_l in
    select * from (values
      ('MP-2026-0187', 'MP-014', 'GLI-2509-A', date '2027-09-30', 40.0, 'MP-E03-P2-01', 'aprobado'),
      ('MP-2026-0204', 'MP-014', 'GLI-2511-B', date '2027-12-31', 120.0, 'MP-E03-P2-02', 'aprobado'),
      ('MP-2026-0190', 'MP-022', 'POL-2508-B', date '2027-08-28', 100.0, 'MP-E02-P1-01', 'aprobado'),
      ('MP-2026-0188', 'MP-032', 'ETI-2507-C', date '2027-07-28', 10.0, 'MP-E04-P1-02', 'aprobado'),
      ('MP-2026-0198', 'MP-031', 'FEN-2510-C', date '2028-03-15', 50.0, 'MP-E01-P1-02', 'cuarentena')
    ) as t(code, mat, slot, expiry, qty, loc, status)
  loop
    insert into public.material_lots (material_id, internal_code, supplier_id, supplier_lot, expiry_date, qty_received, unit,
      received_at, received_by, coa_ref, status, released_at, released_by, created_by, updated_by)
    values ((select id from public.materials where code = v_l.mat), v_l.code,
      (select id from public.external_parties where name = 'Química Andina S.A.S.'), v_l.slot, v_l.expiry, v_l.qty, 'kg',
      '2026-09-22 09:00-05', v_marta, 'CoA-' || v_l.slot || '.pdf', v_l.status,
      case when v_l.status = 'aprobado' then timestamptz '2026-09-25 09:00-05' end,
      case when v_l.status = 'aprobado' then 'a1000000-0000-4000-8000-000000000008'::uuid end, v_marta, v_marta)
    returning id into v_lot;
    insert into public.inventory_movements (lot_id, type, qty, to_location_id, reason, created_at, created_by, updated_by)
    values (v_lot, 'recepcion', v_l.qty, (select id from public.storage_locations where code = v_l.loc),
      'Recibido en cuarentena · CoA adjunto', '2026-09-22 09:00-05', v_marta, v_marta);
  end loop;

  -- Balanza de respaldo apta (ilustrativa, D-70): BAL-014 tiene la calibración vencida (0B).
  insert into public.equipment (code, name, equipment_type, plant_area, critical, capacity, requires_qualification,
    requires_cleaning, created_by, updated_by)
  values ('BAL-015', 'Balanza 300 kg de respaldo', 'balanza', 'dispensacion', true, '300 kg · d = 0,1 g', false, false,
    'a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000004')
  on conflict (code) do nothing;
  insert into public.equipment_events (equipment_id, type, performed_on, result, due_on, provider, reference, recorded_by, locked_at)
  select e.id, t.type, date '2026-10-01', 'conforme', date '2027-10-01', 'Metrología Andina', t.ref,
    'a1000000-0000-4000-8000-000000000004', now()
  from public.equipment e, (values ('calibracion', 'CAL-BAL015-2026'), ('mantenimiento', 'OT-2026-140')) as t(type, ref)
  where e.code = 'BAL-015' and not exists (select 1 from public.equipment_events x where x.equipment_id = e.id);
end $$;
