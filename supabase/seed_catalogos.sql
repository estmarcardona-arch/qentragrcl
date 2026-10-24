-- Catálogos ficticios del Prompt 0B para el proyecto de desarrollo en la nube (decisión del responsable,
-- 24/10/2026): materias primas y materiales de envase y empaque, productos PRD-001 y PRD-014 con sus
-- presentaciones y el protocolo de estabilidad CC-PC-001 vigente. No carga briefs, prototipos, documentos
-- maestros ni el listado maestro. Idempotente: no duplica ni modifica lo que ya existe.
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
