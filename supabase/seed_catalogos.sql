-- Catálogos ficticios del Prompt 0B para el proyecto de desarrollo en la nube (decisión del responsable,
-- 24/10/2026): materias primas y materiales de envase y empaque, productos PRD-001 y PRD-014 con sus
-- presentaciones y el protocolo de estabilidad CC-PC-001 vigente. No carga briefs, prototipos, documentos
-- maestros ni el listado maestro. Desde E5 agrega terceros y la estructura de las 9 bodegas (sin lotes).
-- Idempotente: no duplica ni modifica lo que ya existe.
-- Uso: npm run seed:remote -- --catalogos --confirmar
do $$
declare
  v_valentina constant uuid := 'a1000000-0000-4000-8000-000000000014';
  v_lucia constant uuid := 'a1000000-0000-4000-8000-000000000009';
  v_esteban constant uuid := 'a1000000-0000-4000-8000-000000000010';
  v_doc constant uuid := 'e2000000-0000-4000-8000-000000000009';
  v_prd constant uuid := 'e4000000-0000-4000-8000-000000000001';
  v_ver uuid;
  v_content jsonb;
begin
  insert into public.materials (code, name, type, unit, default_function, requires_coa) values
    ('MP-001', 'Agua purificada', 'mp', 'kg', 'Vehículo', true),
    ('MP-014', 'Glicerina', 'mp', 'kg', 'Humectante', true),
    ('MP-022', 'Poloxámero 184', 'mp', 'kg', 'Tensoactivo suave', true),
    ('MP-031', 'Fenoxietanol', 'mp', 'kg', 'Conservante', true),
    ('MP-040', 'Extracto de manzanilla', 'mp', 'kg', 'Activo calmante', true),
    ('MP-032', 'Etilhexilglicerina', 'mp', 'kg', 'Coconservante', true),
    ('MP-055', 'Ácido cítrico', 'mp', 'kg', 'Regulador de pH', true),
    ('MP-060', 'Perfume', 'mp', 'kg', 'Fragancia', true),
    ('EN-PET-200', 'Envase PET 200 mL', 'envase', 'und', null, false),
    ('EN-PET-400', 'Envase PET 400 mL', 'envase', 'und', null, false),
    ('EN-TAPA-FT', 'Tapa flip-top', 'envase', 'und', null, false),
    ('EM-ETQ-200', 'Etiqueta 200 mL', 'empaque', 'und', null, false),
    ('EM-ETQ-400', 'Etiqueta 400 mL', 'empaque', 'und', null, false),
    ('EM-CAJA-200', 'Caja 200 mL', 'empaque', 'und', null, false),
    ('EM-CAJA-400', 'Caja 400 mL', 'empaque', 'und', null, false)
  on conflict (code) do nothing;

  insert into public.products (id, code, name, line_id, titular, sanitary_registration, sanitary_registration_expires, shelf_life_months)
  values (v_prd, 'PRD-001', 'Loción micelar ClariPlus', (select id from public.product_lines where code = 'COS'),
          'GRUFARCOL S.A.S.', 'NSO-FICT-2025-01234', '2030-09-30', 24),
         ('e4000000-0000-4000-8000-000000000002', 'PRD-014', 'Suspensión oral Ibuprofeno 100 mg/5 mL',
          (select id from public.product_lines where code = 'MED'), 'GRUFARCOL S.A.S.', null, null, null)
  on conflict (code) do nothing;
  insert into public.product_presentations (id, product_id, code, name, net_content, unit)
  select v.id, p.id, v.code, v.name, v.net, 'mL'
  from (values ('e4000000-0000-4000-8000-000000000011'::uuid, '200', '200 mL', 200),
               ('e4000000-0000-4000-8000-000000000012'::uuid, '400', '400 mL', 400)) as v(id, code, name, net)
  join public.products p on p.code = 'PRD-001'
  on conflict (product_id, code) do nothing;

  -- Protocolo de estabilidad preliminar CC-PC-001 v01 vigente (lo exige start_stability_study).
  if exists (select 1 from public.controlled_documents where code = 'CC-PC-001') then
    return;
  end if;
  insert into public.controlled_documents (id, code, title, type_id, process_id, status, route_id, created_by, updated_by)
  values (v_doc, 'CC-PC-001', 'Protocolo de estabilidad preliminar', (select id from public.document_types where type_code = 'PC'),
    (select id from public.organizational_areas where code = 'CC'), 'en_elaboracion',
    (select id from public.approval_routes where code = 'tecnica'), v_valentina, v_valentina);
  v_content := jsonb_build_object(
    'objetivo', 'Establecer el protocolo de estabilidad preliminar.',
    'alcance', 'Aplica a los procesos de GRUFARCOL que usan este documento.',
    'responsables', 'Dueño del proceso; Aseguramiento de la calidad.',
    'desarrollo', '1. Diligenciar los campos con información puntual y exacta.' || chr(10)
      || '2. Registrar las fechas en formato dd-mm-aaaa y la hora en 24 h.' || chr(10) || '3. Escribir «N.A.» cuando un campo no aplique.',
    'documentos_relacionados', 'GCA-PR-001 Procedimiento para la elaboración de documentos.',
    'control_cambios', 'Ver historial de actualizaciones.');
  insert into public.document_versions (document_id, version_no, status, author_id, content, content_hash, change_description,
    issue_date, review_due_date, effective_at, locked_at, created_by, updated_by)
  values (v_doc, 1, 'vigente', v_valentina, v_content, public.record_hash(v_content), 'Creación del documento',
    '2026-02-15', '2029-02-15', '2026-02-15 13:00', '2026-02-15 12:00', v_valentina, v_valentina)
  returning id into v_ver;
  -- Cuadro de firmas: Actualizado (Valentina Cruz), Revisado (Lucía Barrera), Aprobado (Dr. Esteban Gaviria).
  insert into public.signatures (user_id, record_table, record_id, meaning, signed_as, record_hash, short_signature,
    signer_name, group_key, reauth_method, signed_at, created_by, updated_by)
  select s.uid, 'document_versions', v_ver, s.meaning::public.signature_meaning, s.role,
    public.record_hash(app_private.signable_row('document_versions', to_jsonb(dv))),
    coalesce(sr.short_signature, p.full_name), p.full_name, v_doc::text, 'password',
    timestamptz '2026-02-15 00:00' + s.offs, s.uid, s.uid
  from public.document_versions dv,
    (values (v_valentina, 'actualizo', 'aq_doc', interval '8 hours'), (v_lucia, 'reviso', 'aq_dir', interval '9 hours'),
            (v_esteban, 'aprobo', 'dt', interval '10 hours')) as s(uid, meaning, role, offs)
  join public.profiles p on p.id = s.uid
  left join public.signature_registry sr on sr.user_id = s.uid
  where dv.id = v_ver;
  update public.controlled_documents
  set status = 'vigente', current_version_id = v_ver, next_review_date = '2029-02-15'
  where id = v_doc;
end;
$$;

-- E5 · Terceros y estructura de bodegas del Prompt 0B (sin lotes ni movimientos): 9 bodegas, 276 ubicaciones,
-- estante E01 de materias primas en zona de cuarentena. Aprobación de las externas por Lucía Barrera (D-20).
do $$
declare
  v_hernan constant uuid := 'a1000000-0000-4000-8000-000000000004';
  v_lucia constant uuid := 'a1000000-0000-4000-8000-000000000009';
  v_maq uuid;
  v_sur uuid;
  v_wh uuid;
  v_w record;
begin
  if exists (select 1 from public.warehouses where code = 'BOD-MP') then
    return;
  end if;
  insert into public.external_parties (name, kind, contact, created_by, updated_by) values
    ('Química Andina S.A.S.', 'proveedor', 'Compras · Bogotá', v_hernan, v_hernan),
    ('Insumos del Valle Ltda.', 'proveedor', 'Ventas · Cali', v_hernan, v_hernan)
  on conflict (name) do nothing;
  insert into public.external_parties (name, kind, address, qualified, qualification_expires, qualification_ref, qualified_by,
    qualified_at, created_by, updated_by)
  values ('Maquilas del Norte S.A.S.', 'maquilador', 'Zona industrial norte', true, '2027-03-31', 'Auditoría de calificación AUD-2026-03',
    v_lucia, '2026-03-31 10:00-05', v_hernan, v_hernan),
         ('Almacenes del Sur', 'almacenamiento', null, true, '2026-09-30', 'Auditoría de calificación AUD-2025-09',
    v_lucia, '2025-09-30 10:00-05', v_hernan, v_hernan)
  on conflict (name) do nothing;
  select id into v_maq from public.external_parties where name = 'Maquilas del Norte S.A.S.';
  select id into v_sur from public.external_parties where name = 'Almacenes del Sur';

  for v_w in
    select * from (values
      ('BOD-MP', 'Bodega de materias primas', 'materias_primas', 'MP', 6, 4, 2, array['materia_prima'], false, null::uuid),
      ('BOD-ME', 'Bodega de material de envase', 'material_envase', 'ME', 4, 3, 4, array['material_envase'], false, null),
      ('BOD-EM', 'Bodega de material de empaque', 'material_empaque', 'EM', 3, 3, 4, array['material_empaque'], false, null),
      ('BOD-GR', 'Bodega de granel', 'granel', 'GR', 2, 2, 2, array['granel'], false, null),
      ('BOD-PT', 'Bodega de producto terminado', 'producto_terminado', 'PT', 8, 4, 3, array['producto_terminado'], false, null),
      ('BOD-RE', 'Bodega de rechazo', 'rechazo', 'RE', 1, 2, 4,
        array['materia_prima', 'material_envase', 'material_empaque', 'granel', 'producto_terminado'], true, null),
      ('BOD-DV', 'Bodega de devolución', 'devolucion', 'DV', 1, 2, 4,
        array['materia_prima', 'material_envase', 'material_empaque', 'granel', 'producto_terminado'], false, null),
      ('BOD-EXT-01', 'Bodega externa — Maquilas del Norte S.A.S.', 'material_envase', 'EXT-01', 2, 3, 4,
        array['material_envase', 'granel', 'producto_terminado'], false, v_maq),
      ('BOD-EXT-02', 'Bodega externa — Almacenes del Sur', 'material_envase', 'EXT-02', 0, 0, 0, array['material_envase'], false, v_sur)
    ) as t(code, name, func, prefix, racks, levels, positions, allowed, secured, party)
  loop
    insert into public.warehouses (code, name, function, site_type, external_party_id, location_prefix, secured, status, address,
      created_by, updated_by)
    values (v_w.code, v_w.name, v_w.func, case when v_w.party is null then 'interna' else 'externa' end, v_w.party, v_w.prefix,
      v_w.secured, 'activa', case when v_w.party is not null then 'Dirección por completar' end, v_hernan, v_hernan)
    returning id into v_wh;
    insert into public.warehouse_allowed_types (warehouse_id, material_class, created_by)
    select v_wh, a, v_hernan from unnest(v_w.allowed) a;
    if v_w.racks > 0 then
      perform app_private.generate_locations(v_wh, v_w.racks, v_w.levels, v_w.positions);
    end if;
    if v_w.party is not null then
      insert into public.signatures (user_id, record_table, record_id, meaning, signed_as, record_hash, short_signature,
        signer_name, reauth_method, signed_at, created_by, updated_by)
      select v_lucia, 'warehouses', w.id, 'aprobo', 'aq_dir', public.record_hash(app_private.signable_row('warehouses', to_jsonb(w))),
        coalesce(sr.short_signature, 'L. Barrera'), 'Lucía Barrera', 'password', '2026-04-02 09:00-05', v_lucia, v_lucia
      from public.warehouses w left join public.signature_registry sr on sr.user_id = v_lucia where w.id = v_wh;
    end if;
  end loop;
  update public.racks set zone = 'cuarentena'
  where code = 'E01' and warehouse_id = (select id from public.warehouses where code = 'BOD-MP');
end;
$$;
