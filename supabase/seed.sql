-- seed.sql · Datos ficticios del Prompt 0B (AGENTS.md regla 9). SOLO PARA ENTORNO LOCAL Y CI:
-- `supabase start` / `supabase db reset` lo cargan; `supabase db push` NO lo aplica a la nube.
-- Nunca se cargan datos reales. Contraseña de desarrollo común: Grufarcol.Dev.2026
-- Correos con dominio reservado .test (no existe en internet).

do $$
declare
  v_password constant text := 'Grufarcol.Dev.2026';
  v_user record;
begin
  for v_user in
    select * from (values
      ('a1000000-0000-4000-8000-000000000001'::uuid, 'camila.ortega@grufarcol.test', 'Camila Ortega', 'Comercial', 'comercial'::text, null::timestamptz),
      ('a1000000-0000-4000-8000-000000000002', 'sebastian.rojas@grufarcol.test', 'Sebastián Rojas', 'Químico formulador (I+D)', 'idi', null),
      ('a1000000-0000-4000-8000-000000000003', 'marta.quintero@grufarcol.test', 'Marta Quintero', 'Auxiliar de bodega', 'bodega_aux', null),
      ('a1000000-0000-4000-8000-000000000004', 'hernan.salgado@grufarcol.test', 'Hernán Salgado', 'Jefe de bodega', 'bodega_jefe', null),
      ('a1000000-0000-4000-8000-000000000005', 'diego.cardenas@grufarcol.test', 'Diego Cárdenas', 'Auxiliar de producción', 'prod_aux', null),
      ('a1000000-0000-4000-8000-000000000006', 'paola.mejia@grufarcol.test', 'Paola Mejía', 'Coordinadora de producción', 'prod_coord', null),
      ('a1000000-0000-4000-8000-000000000007', 'natalia.ruiz@grufarcol.test', 'Natalia Ruiz', 'Auxiliar de laboratorio', 'lab_aux', null),
      ('a1000000-0000-4000-8000-000000000008', 'ricardo.pena@grufarcol.test', 'Ricardo Peña', 'Jefe de control de calidad', 'cc_jefe', null),
      ('a1000000-0000-4000-8000-000000000009', 'lucia.barrera@grufarcol.test', 'Lucía Barrera', 'Directora de aseguramiento de calidad', 'aq_dir', null),
      ('a1000000-0000-4000-8000-000000000010', 'esteban.gaviria@grufarcol.test', 'Dr. Esteban Gaviria', 'Director técnico', 'dt', null),
      ('a1000000-0000-4000-8000-000000000011', 'tomas.herrera@grufarcol.test', 'Tomás Herrera', 'Administrador del sistema', 'admin', null),
      ('a1000000-0000-4000-8000-000000000012', 'ines.valencia@grufarcol.test', 'Inés Valencia', 'Auditora invitada', 'auditor', '2026-11-30T23:59:59-05:00'),
      ('a1000000-0000-4000-8000-000000000013', 'gabriela.torres@grufarcol.test', 'Gabriela Torres', 'Usuario master', 'master', null),
      ('a1000000-0000-4000-8000-000000000014', 'valentina.cruz@grufarcol.test', 'Valentina Cruz', 'Analista de gestión documental', 'aq_doc', null),
      ('a1000000-0000-4000-8000-000000000015', 'marcela.duarte@grufarcol.test', 'Marcela Duarte', 'Gerente general', 'gerencia', null)
    ) as t(id, email, full_name, job_title, role, expires_at)
  loop
    if not exists (select 1 from auth.users where id = v_user.id) then
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, reauthentication_token, phone_change, phone_change_token
      ) values (
        '00000000-0000-0000-0000-000000000000', v_user.id, 'authenticated', 'authenticated', v_user.email,
        extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', v_user.full_name, 'job_title', v_user.job_title),
        now(), now(), '', '', '', '', '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_user.id, v_user.id::text,
              jsonb_build_object('sub', v_user.id::text, 'email', v_user.email, 'email_verified', true),
              'email', now(), now(), now());
    end if;

    if not exists (select 1 from public.user_roles where user_id = v_user.id and role = v_user.role and revoked_at is null) then
      insert into public.user_roles (user_id, role, expires_at) values (v_user.id, v_user.role, v_user.expires_at);
    end if;
  end loop;
end $$;

-- Áreas de los usuarios ficticios (organigrama de ejemplo, D-06) y jefes de área del Prompt 0B.
update public.profiles p
set area_id = a.id
from (values
  ('camila.ortega@grufarcol.test', 'COM'), ('sebastian.rojas@grufarcol.test', 'IDI'),
  ('marta.quintero@grufarcol.test', 'GLG'), ('hernan.salgado@grufarcol.test', 'GLG'),
  ('diego.cardenas@grufarcol.test', 'PRD'), ('paola.mejia@grufarcol.test', 'PRD'),
  ('natalia.ruiz@grufarcol.test', 'CC'), ('ricardo.pena@grufarcol.test', 'CC'),
  ('lucia.barrera@grufarcol.test', 'GCA'), ('esteban.gaviria@grufarcol.test', 'DT'),
  ('tomas.herrera@grufarcol.test', 'ADM'), ('gabriela.torres@grufarcol.test', 'DT'),
  ('valentina.cruz@grufarcol.test', 'GCA'), ('marcela.duarte@grufarcol.test', 'DG')
) as v(email, area_code)
join public.organizational_areas a on a.code = v.area_code
where p.email = v.email and p.area_id is distinct from a.id;

update public.organizational_areas oa
set head_user_id = p.id
from (values
  ('GCA', 'lucia.barrera@grufarcol.test'), ('DT', 'esteban.gaviria@grufarcol.test'),
  ('CC', 'ricardo.pena@grufarcol.test'), ('GLG', 'hernan.salgado@grufarcol.test'),
  ('DG', 'marcela.duarte@grufarcol.test')
) as v(area_code, email)
join public.profiles p on p.email = v.email
where oa.code = v.area_code and oa.head_user_id is distinct from p.id;

-- =====================================================================================
-- E3 · Sistema de gestión documental (Prompt 0B, «Documentos controlados», v1.3)
-- Listado maestro, versiones y firmas, solicitudes SD-2026-0011, SC-2026-0005 y AN-2026-0002,
-- copias distribuidas, capacitación de PRD-PR-003-FR-01 v03 y plantillas de proceso.
-- Los textos de las secciones y los pasos de las plantillas son ilustrativos (ficticios).
-- =====================================================================================
create or replace function pg_temp.seed_content(p_title text, p_scope boolean default true)
returns jsonb
language sql
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'objetivo', 'Establecer ' || lower(p_title) || '.',
    'alcance', case when p_scope then 'Aplica a los procesos de GRUFARCOL que usan este documento.' end,
    'responsables', 'Dueño del proceso; Aseguramiento de la calidad.',
    'desarrollo', '1. Diligenciar los campos con información puntual y exacta.' || chr(10) || '2. Registrar las fechas en formato dd-mm-aaaa y la hora en 24 h.' || chr(10) || '3. Escribir «N.A.» cuando un campo no aplique.',
    'documentos_relacionados', 'GCA-PR-001 Procedimiento para la elaboración de documentos.',
    'control_cambios', 'Ver historial de actualizaciones.'));
$$;

do $$
declare
  v_valentina constant uuid := 'a1000000-0000-4000-8000-000000000014';
  v_lucia constant uuid := 'a1000000-0000-4000-8000-000000000009';
  v_esteban constant uuid := 'a1000000-0000-4000-8000-000000000010';
  v_gabriela constant uuid := 'a1000000-0000-4000-8000-000000000013';
  v_hernan constant uuid := 'a1000000-0000-4000-8000-000000000004';
  v_marcela constant uuid := 'a1000000-0000-4000-8000-000000000015';
  v_doc record;
  v_ver record;
  v_doc_id uuid;
  v_ver_id uuid;
  v_prev uuid;
  v_training uuid;
  v_user record;
  v_n int := 0;
begin
  if exists (select 1 from public.controlled_documents where code = 'GCA-PR-001') then
    return;
  end if;

  -- Documentos: código, título, tipo, proceso, padre, regla de vigencia, vencimiento del registro.
  for v_doc in
    select * from (values
      ('e2000000-0000-4000-8000-000000000001'::uuid, 'GCA-PR-001', 'Procedimiento para la elaboración de documentos', 'PR', 'GCA', null::text, null::text, null::date),
      ('e2000000-0000-4000-8000-000000000002', 'GCA-PR-002', 'Procedimiento para el registro y control de documentos', 'PR', 'GCA', null, null, null),
      ('e2000000-0000-4000-8000-000000000003', 'GCA-PR-001-FR-01', 'Formato listado maestro de documentos', 'FR', 'GCA', 'GCA-PR-001', null, null),
      ('e2000000-0000-4000-8000-000000000004', 'GCA-PR-001-FR-02', 'Formato registro de firmas', 'FR', 'GCA', 'GCA-PR-001', null, null),
      ('e2000000-0000-4000-8000-000000000005', 'PRD-PR-003-FR-01', 'Formato registro de fabricación', 'FR', 'PRD', 'PRD-PR-003', null, null),
      ('e2000000-0000-4000-8000-000000000006', 'PRD-PR-001-FR-01', 'Formato prealistamiento y despeje de línea', 'FR', 'PRD', 'PRD-PR-001', null, null),
      ('e2000000-0000-4000-8000-000000000007', 'PRD-PR-004-FR-01', 'Formato registro de envase', 'FR', 'PRD', 'PRD-PR-004', null, null),
      ('e2000000-0000-4000-8000-000000000008', 'CC-PR-002-FR-01', 'Formato certificado analítico de producto terminado', 'FR', 'CC', 'CC-PR-002', null, null),
      ('e2000000-0000-4000-8000-000000000009', 'CC-PC-001', 'Protocolo de estabilidad preliminar', 'PC', 'CC', null, null, null),
      ('e2000000-0000-4000-8000-000000000010', 'IDI-IN-012', 'Instructivo de manufactura ClariPlus', 'IN', 'IDI', null, 'registro_sanitario', date '2030-09-30'),
      ('e2000000-0000-4000-8000-000000000011', 'IDI-EP-007', 'Especificación de producto terminado ClariPlus', 'EP', 'IDI', null, null, null),
      ('e2000000-0000-4000-8000-000000000012', 'GLG-PR-004', 'Procedimiento de almacenamiento y ubicación de materiales', 'PR', 'GLG', null, null, null),
      ('e2000000-0000-4000-8000-000000000013', 'ADM-PR-002-FR-04', 'Formato control de visitas', 'FR', 'ADM', 'ADM-PR-002', null, null)
    ) as t(id, code, title, type_code, process, parent_code, rule, reg_expiry)
  loop
    insert into public.controlled_documents (id, code, title, type_id, process_id, parent_code, sub_type, sub_number,
      status, validity_rule, regulatory_expiry_date, route_id, created_by, updated_by)
    values (v_doc.id, v_doc.code, v_doc.title, (select id from public.document_types where type_code = v_doc.type_code),
      (select id from public.organizational_areas where code = v_doc.process), v_doc.parent_code,
      case when v_doc.parent_code is not null then v_doc.type_code end,
      case when v_doc.parent_code is not null then right(v_doc.code, 2)::int end,
      'en_elaboracion', v_doc.rule, v_doc.reg_expiry,
      (select id from public.approval_routes where code = case when v_doc.process = 'ADM' then 'administrativa' else 'tecnica' end),
      v_valentina, v_valentina);
  end loop;

  -- Versiones: documento, versión, estado, autor, emisión, revisión, descripción del cambio.
  for v_ver in
    select * from (values
      ('GCA-PR-001', 1, 'obsoleto', v_valentina, date '2022-04-17', date '2025-04-17', 'Creación del documento'),
      ('GCA-PR-001', 2, 'vigente', v_valentina, date '2025-04-17', date '2028-04-17', 'Actualización de la codificación'),
      ('GCA-PR-002', 1, 'vigente', v_valentina, date '2025-04-17', date '2028-04-17', 'Creación del documento'),
      ('GCA-PR-001-FR-01', 1, 'vigente', v_valentina, date '2025-04-17', date '2028-04-17', 'Creación del documento'),
      ('GCA-PR-001-FR-02', 1, 'vigente', v_valentina, date '2025-04-17', date '2028-04-17', 'Creación del documento'),
      ('PRD-PR-003-FR-01', 1, 'obsoleto', v_valentina, date '2023-01-10', date '2026-01-10', 'Creación del documento'),
      ('PRD-PR-003-FR-01', 2, 'obsoleto', v_valentina, date '2023-03-02', date '2026-03-02', 'Ajuste de campos'),
      ('PRD-PR-003-FR-01', 3, 'vigente', v_valentina, date '2023-05-15', date '2026-05-15', 'Inclusión de codificación'),
      ('PRD-PR-001-FR-01', 4, 'vigente', v_valentina, date '2024-01-20', date '2027-01-20', 'Inclusión del rótulo de limpieza'),
      ('PRD-PR-004-FR-01', 2, 'vigente', v_valentina, date '2024-02-15', date '2027-02-15', 'Ajuste del control de peso'),
      ('CC-PR-002-FR-01', 2, 'vigente', v_valentina, date '2024-02-15', date '2027-02-15', 'Ajuste de parámetros'),
      ('CC-PC-001', 1, 'vigente', v_valentina, date '2026-02-15', date '2029-02-15', 'Creación del documento'),
      ('IDI-IN-012', 3, 'vigente', v_valentina, date '2026-08-25', date '2030-09-30', 'Fórmula v3 (P-0007-1)'),
      ('IDI-EP-007', 2, 'vigente', v_valentina, date '2025-10-30', date '2026-10-30', 'Ajuste de densidad'),
      ('ADM-PR-002-FR-04', 1, 'vigente', v_valentina, date '2024-03-01', date '2027-03-01', 'Creación del documento')
    ) as t(code, version_no, status, author, issue, review, change)
  loop
    select id into v_doc_id from public.controlled_documents where code = v_ver.code;
    insert into public.document_versions (document_id, version_no, status, author_id, content, content_hash, supersedes_id,
      change_description, issue_date, review_due_date, effective_at, obsoleted_at, locked_at, created_by, updated_by)
    select v_doc_id, v_ver.version_no, v_ver.status, v_ver.author,
      pg_temp.seed_content(d.title, t.requires_scope), public.record_hash(pg_temp.seed_content(d.title, t.requires_scope)),
      (select x.id from public.document_versions x where x.document_id = v_doc_id and x.version_no = v_ver.version_no - 1),
      v_ver.change, v_ver.issue, v_ver.review,
      v_ver.issue::timestamptz + interval '13 hours',
      case when v_ver.status = 'obsoleto' then v_ver.review::timestamptz end,
      v_ver.issue::timestamptz + interval '12 hours', v_ver.author, v_ver.author
    from public.controlled_documents d join public.document_types t on t.id = d.type_id where d.id = v_doc_id
    returning id into v_ver_id;
    -- Cuadro de firmas: Actualizado (Valentina Cruz), Revisado (Lucía Barrera), Aprobado (Dr. Esteban Gaviria).
    insert into public.signatures (user_id, record_table, record_id, meaning, signed_as, record_hash, short_signature,
      signer_name, group_key, reauth_method, signed_at, created_by, updated_by)
    select s.uid, 'document_versions', v_ver_id, s.meaning::public.signature_meaning, s.role,
      public.record_hash(app_private.signable_row('document_versions', to_jsonb(dv))),
      coalesce(sr.short_signature, p.full_name), p.full_name, v_doc_id::text, 'password',
      v_ver.issue::timestamptz + s.offs, s.uid, s.uid
    from public.document_versions dv,
      (values (v_valentina, 'actualizo', 'aq_doc', interval '8 hours'), (v_lucia, 'reviso', 'aq_dir', interval '9 hours'),
              (v_esteban, 'aprobo', 'dt', interval '10 hours')) as s(uid, meaning, role, offs)
    join public.profiles p on p.id = s.uid
    left join public.signature_registry sr on sr.user_id = s.uid
    where dv.id = v_ver_id;
    if v_ver.status = 'vigente' then
      update public.controlled_documents
      set status = 'vigente', current_version_id = v_ver_id, next_review_date = v_ver.review
      where id = v_doc_id;
    end if;
  end loop;

  -- GLG-PR-004 v01: EN REVISIÓN (autor Hernán Salgado; Valentina Cruz estandarizó y asignó el código).
  insert into public.document_requests (code, kind, requested_by, process_id, type_id, proposed_title, reason,
    requested_distribution, status, template_delivered_at, created_by, updated_by)
  values ('SD-2026-0011', 'creacion', v_hernan, (select id from public.organizational_areas where code = 'GLG'),
    (select id from public.document_types where type_code = 'PR'), 'Procedimiento de almacenamiento y ubicación de materiales',
    'Documentar las reglas de ubicación de las bodegas', array[(select id from public.organizational_areas where code = 'GLG')],
    'en_curso', '2026-09-21 09:00-05', v_hernan, v_hernan);
  insert into public.document_versions (document_id, request_id, version_no, status, author_id, content, created_by, updated_by)
  values ('e2000000-0000-4000-8000-000000000012', (select id from public.document_requests where code = 'SD-2026-0011'), 1,
    'en_revision', v_hernan, pg_temp.seed_content('el almacenamiento y la ubicación de materiales'), v_hernan, v_hernan)
  returning id into v_ver_id;
  update public.document_versions set content_hash = public.record_hash(content) where id = v_ver_id;
  insert into public.standardization_checks (version_id, checklist, observations, result, checked_by, checked_at, created_by)
  values (v_ver_id, '{"secciones_minimas": true, "infinitivo": true, "sin_terminos_subjetivos": true, "encabezado": true, "unidades_si": true, "na": true}',
    '[]', 'cumple', v_valentina, '2026-09-28 10:00-05', v_valentina);
  insert into public.signatures (user_id, record_table, record_id, meaning, signed_as, record_hash, short_signature, signer_name,
    group_key, reauth_method, signed_at, created_by, updated_by)
  select v_hernan, 'document_versions', v_ver_id, 'actualizo', 'bodega_jefe',
    public.record_hash(app_private.signable_row('document_versions', to_jsonb(dv))), coalesce(sr.short_signature, 'H. Salgado'),
    'Hernán Salgado', dv.document_id::text, 'password', '2026-09-29 15:00-05', v_hernan, v_hernan
  from public.document_versions dv left join public.signature_registry sr on sr.user_id = v_hernan where dv.id = v_ver_id;

  -- SC-2026-0005: modificación técnica de PRD-PR-003-FR-01 (origen DEV-2026-0017), v04 PRELIMINAR de Gabriela Torres.
  insert into public.document_change_requests (code, document_id, origin, origin_ref, reason, impact, technical_change,
    status, parent_review, requested_by, created_by, updated_by)
  values ('SC-2026-0005', 'e2000000-0000-4000-8000-000000000005', 'desviacion', 'DEV-2026-0017',
    'Agregar control de temperatura de la fase oleosa cada 10 minutos',
    'No afecta lotes en curso; aplica a lotes creados después de quedar vigente', true, 'en_elaboracion', 'pendiente',
    v_lucia, v_lucia, v_lucia);
  insert into public.document_versions (document_id, change_request_id, version_no, status, author_id, content,
    change_description, technical_change, supersedes_id, created_by, updated_by)
  select 'e2000000-0000-4000-8000-000000000005', (select id from public.document_change_requests where code = 'SC-2026-0005'), 4,
    'preliminar', v_gabriela, content, 'Agregar control de temperatura de la fase oleosa cada 10 minutos (DEV-2026-0017 / SC-2026-0005)',
    true, id, v_gabriela, v_gabriela
  from public.document_versions where document_id = 'e2000000-0000-4000-8000-000000000005' and version_no = 3;

  -- Copias controladas entregadas (control de documentos).
  insert into public.document_distribution (version_id, area_id, delivered_at, delivered_by, created_by)
  select dv.id, a.id, dv.effective_at, v_valentina, v_valentina
  from public.document_versions dv join public.controlled_documents d on d.id = dv.document_id
  join public.organizational_areas a on a.code = any(case
    when d.code like 'PRD-%' then array['PRD', 'CC']
    when d.code like 'CC-%' then array['CC']
    when d.code like 'IDI-%' then array['IDI', 'PRD']
    when d.code = 'ADM-PR-002-FR-04' then array['ADM', 'PRD', 'CC', 'GLG']
    else array['GCA'] end)
  where dv.status = 'vigente';

  -- AN-2026-0002: anulación del ADM-PR-002-FR-04, aprobada por Lucía Barrera; recogidas 3 de 4 copias (falta Administrativo).
  insert into public.document_requests (code, kind, requested_by, document_id, reason, status, created_by, updated_by)
  values ('SD-2026-0010', 'anulacion', v_marcela, 'e2000000-0000-4000-8000-000000000013',
    'El control de visitas se lleva en el sistema de portería', 'en_curso', v_marcela, v_marcela);
  insert into public.document_annulments (code, document_id, request_id, requested_by, reason, status, decision, decided_by,
    decided_at, decision_reason, recall_status, created_by, updated_by)
  values ('AN-2026-0002', 'e2000000-0000-4000-8000-000000000013', (select id from public.document_requests where code = 'SD-2026-0010'),
    v_marcela, 'El control de visitas se lleva en el sistema de portería', 'aprobada', 'aprobada', v_lucia, '2026-10-01 11:00-05',
    'Anulación viable', 'pendiente', v_marcela, v_lucia);
  update public.document_distribution dd set recalled_at = '2026-10-02 10:00-05', recalled_by = v_valentina, recall_note = 'Copia recogida'
  from public.document_versions dv, public.organizational_areas a
  where dd.version_id = dv.id and dv.document_id = 'e2000000-0000-4000-8000-000000000013' and a.id = dd.area_id and a.code <> 'ADM';

  -- Documento externo (nivel Normatividad), por confirmar.
  insert into public.controlled_documents (code, origin, title, status, external_issuer, external_version,
    external_pending_confirmation, created_by, updated_by)
  values ('EXT-001', 'externo', 'Norma de buenas prácticas de manufactura aplicable', 'vigente',
    'Autoridad sanitaria (por confirmar)', 'Por confirmar', true, v_valentina, v_valentina);

  -- Capacitación de PRD-PR-003-FR-01 v03: 14 personas, 12 aprobadas; Diego Cárdenas 70 %; Paola Mejía sin intento.
  select id into v_ver_id from public.document_versions where document_id = 'e2000000-0000-4000-8000-000000000005' and version_no = 3;
  insert into public.document_trainings (version_id, trainer_id, method, pass_score, due_date, requires_assessment, questions, created_by)
  values (v_ver_id, v_valentina, 'plataforma', 80, '2026-10-12', true,
    (select jsonb_agg(jsonb_build_object('q', q, 'options', o) order by n) from (values
      (1, '¿Cómo se registran las fechas en el formato?', '["dd-mm-aaaa", "mm/dd/aa", "Como prefiera el operario"]'::jsonb),
      (2, '¿Qué se escribe cuando un campo no aplica?', '["Se deja en blanco", "N.A.", "Una raya"]'::jsonb),
      (3, '¿Cómo se corrige un dato equivocado?', '["Con corrector", "Se tacha con motivo, firma corta y fecha", "Se borra"]'::jsonb),
      (4, '¿Quién verifica los pasos con verificación de segunda persona?', '["El mismo operario", "Otra persona autorizada", "Nadie"]'::jsonb),
      (5, '¿En qué formato se registra la hora?', '["12 h con a. m./p. m.", "24 h", "Libre"]'::jsonb),
      (6, '¿Qué indica la versión del encabezado?', '["La versión vigente del formato", "El número del lote", "La fecha"]'::jsonb),
      (7, '¿Qué se hace si un valor queda fuera de rango?', '["Se registra y se abre una desviación", "Se ajusta el valor", "Se ignora"]'::jsonb),
      (8, '¿Qué firma se registra en el formato?', '["La firma corta registrada", "Cualquier rúbrica", "Las iniciales del jefe"]'::jsonb),
      (9, '¿Dónde se consulta la versión vigente?', '["En el listado maestro", "En una copia impresa antigua", "En el correo"]'::jsonb),
      (10, '¿Qué unidades se usan?', '["Sistema Internacional", "Las del proveedor", "Cualquiera"]'::jsonb)
    ) as t(n, q, o)), v_valentina)
  returning id into v_training;
  insert into app_private.training_answer_keys (training_id, answers) values (v_training, array[0, 1, 1, 1, 1, 0, 0, 0, 0, 0]);
  for v_user in
    select p.id, p.email from public.profiles p
    where p.email like '%@grufarcol.test' and p.email <> 'tomas.herrera@grufarcol.test' order by p.email
  loop
    insert into public.training_assignments (training_id, user_id, assigned_at, created_by)
    values (v_training, v_user.id, '2026-09-28 08:00-05', v_valentina);
    if v_user.email = 'diego.cardenas@grufarcol.test' then
      insert into public.training_attempts (training_id, user_id, attempt_no, kind, answers, score, passed, attempted_at, created_by)
      values (v_training, v_user.id, 1, 'cuestionario', '[0, 1, 1, 1, 1, 0, 0, 1, 1, 1]', 70, false, '2026-10-02 14:00-05', v_user.id);
    elsif v_user.email <> 'paola.mejia@grufarcol.test' then
      v_n := v_n + 1;
      insert into public.training_attempts (training_id, user_id, attempt_no, kind, answers, score, passed, certificate_code, attempted_at, created_by)
      values (v_training, v_user.id, 1, 'cuestionario', '[0, 1, 1, 1, 1, 0, 0, 0, 0, 0]', 100, true,
        'CT-2026-' || lpad(v_n::text, 4, '0'), '2026-09-30 10:00-05', v_user.id);
    end if;
  end loop;

  -- Plantillas de proceso: Despeje v04, Fabricación v03 (vigente) y v04 (borrador de Gabriela Torres), Envase v02.
  update public.stage_definitions set governing_document_id = 'e2000000-0000-4000-8000-000000000006' where code = 'despeje';
  update public.stage_definitions set governing_document_id = 'e2000000-0000-4000-8000-000000000005' where code = 'fabricacion';
  update public.stage_definitions set governing_document_id = 'e2000000-0000-4000-8000-000000000007' where code = 'envase';

  insert into public.process_templates (id, stage_id, document_version_id, status, created_by)
  select v.tid, (select id from public.stage_definitions where code = v.stage), dv.id, 'borrador', v_gabriela
  from (values
    ('e3000000-0000-4000-8000-000000000001'::uuid, 'despeje', 'e2000000-0000-4000-8000-000000000006'::uuid, 4),
    ('e3000000-0000-4000-8000-000000000002', 'fabricacion', 'e2000000-0000-4000-8000-000000000005', 3),
    ('e3000000-0000-4000-8000-000000000003', 'fabricacion', 'e2000000-0000-4000-8000-000000000005', 4),
    ('e3000000-0000-4000-8000-000000000004', 'envase', 'e2000000-0000-4000-8000-000000000007', 2)
  ) as v(tid, stage, doc, version_no)
  join public.document_versions dv on dv.document_id = v.doc and dv.version_no = v.version_no;

  insert into public.process_template_steps (template_id, order_no, label, text, params, requires_equipment,
    requires_verification, checklist_item, created_by)
  select s.tid, s.n, s.label, s.text, s.params::jsonb, s.equipment, s.verify, s.checklist, v_gabriela
  from (values
    ('e3000000-0000-4000-8000-000000000001'::uuid, 1, '1', 'Área libre de materiales de lote anterior', '[]', null::text, true, true),
    ('e3000000-0000-4000-8000-000000000001', 2, '2', 'Equipos limpios y con estado vigente', '[]', null, true, true),
    ('e3000000-0000-4000-8000-000000000001', 3, '3', 'Documentación del lote anterior retirada', '[]', null, true, true),
    ('e3000000-0000-4000-8000-000000000001', 4, '4', 'Materiales conciliados', '[]', null, true, true)
  ) as s(tid, n, label, text, params, equipment, verify, checklist);

  -- Fabricación v03 (11 pasos) y v04 (borrador con el paso nuevo 5B).
  insert into public.process_template_steps (template_id, order_no, label, text, params, requires_equipment,
    requires_verification, checklist_item, created_by)
  select t.tid, s.n + case when t.v4 and s.n > 5 then 1 else 0 end, s.label, s.text, s.params::jsonb, s.equipment, s.verify, false, v_gabriela
  from (values ('e3000000-0000-4000-8000-000000000002'::uuid, false), ('e3000000-0000-4000-8000-000000000003', true)) as t(tid, v4),
  (values
    (1, '1', 'Verificar despeje de línea y limpieza de equipos', '[]', null::text, true),
    (2, '2', 'Cargar agua purificada MP-001', '[{"name": "Cantidad", "unit": "kg", "min": 1884, "max": 1884, "frequency": "por lote"}]', 'TQ-101', false),
    (3, '3', 'Calentar fase acuosa a 70–75 °C', '[{"name": "Temperatura", "unit": "°C", "min": 70, "max": 75, "frequency": "cada 30 min"}]', 'TQ-101', false),
    (4, '4', 'Disolver glicerina y poloxámero', '[]', null, false),
    (5, '5', 'Calentar fase oleosa a 70–75 °C', '[{"name": "Temperatura", "unit": "°C", "min": 70, "max": 75, "frequency": "cada 30 min"}]', 'TQ-101', false),
    (6, '6', 'Homogeneizar a 3.000 rpm por 15 min', '[{"name": "Velocidad", "unit": "rpm", "min": 3000, "max": 3000, "frequency": "15 min"}]', 'HM-02', false),
    (7, '7', 'Enfriar a 35 °C y agregar perfume', '[{"name": "Temperatura", "unit": "°C", "min": 35, "max": 35, "frequency": "una vez"}]', 'TQ-101', false),
    (8, '8', 'Agregar fenoxietanol y etilhexilglicerina', '[]', null, true),
    (9, '9', 'Ajustar pH', '[{"name": "pH", "unit": "", "min": 5.0, "max": 6.0, "frequency": "una vez"}]', null, false),
    (10, '10', 'Tomar muestra para control de calidad', '[]', null, false),
    (11, '11', 'Transferir granel con rótulo', '[{"name": "Granel", "unit": "kg", "min": null, "max": null, "frequency": "una vez"}]', null, false)
  ) as s(n, label, text, params, equipment, verify);
  insert into public.process_template_steps (template_id, order_no, label, text, params, requires_equipment,
    requires_verification, checklist_item, created_by)
  values ('e3000000-0000-4000-8000-000000000003', 6, '5B', 'Medir temperatura de fase oleosa cada 10 minutos (70–75 °C)',
    '[{"name": "Temperatura de fase oleosa", "unit": "°C", "min": 70, "max": 75, "frequency": "cada 10 min"}]', 'TQ-101', false, false, v_gabriela);

  insert into public.process_template_steps (template_id, order_no, label, text, params, requires_equipment,
    requires_verification, checklist_item, created_by)
  values
    ('e3000000-0000-4000-8000-000000000004', 1, '1', 'Verificar el despeje de la línea de envase', '[]', 'LL-03', true, false, v_gabriela),
    ('e3000000-0000-4000-8000-000000000004', 2, '2', 'Controlar el peso neto de 200 mL', '[{"name": "Peso neto", "unit": "g", "min": 197.0, "max": 203.0, "frequency": "cada 30 min"}]', 'LL-03', false, false, v_gabriela),
    ('e3000000-0000-4000-8000-000000000004', 3, '3', 'Verificar el lote y el vencimiento impresos', '[]', null, true, false, v_gabriela);

  -- Las plantillas de versiones aprobadas quedan bloqueadas (AC-20).
  update public.process_templates t set locked_at = dv.effective_at, status = 'aprobada'
  from public.document_versions dv where dv.id = t.document_version_id and dv.status = 'vigente';

  -- Numeración: los próximos códigos siguen a los del Prompt 0B.
  update public.numbering_sequences set last_value = greatest(last_value, 11), year = 2026 where key = 'document_request';
  update public.numbering_sequences set last_value = greatest(last_value, 5), year = 2026 where key = 'document_change_request';
  update public.numbering_sequences set last_value = greatest(last_value, 2), year = 2026 where key = 'document_annulment';
  update public.numbering_sequences set last_value = greatest(last_value, v_n), year = 2026 where key = 'training_certificate';
  update public.numbering_sequences set last_value = greatest(last_value, 1) where key = 'external_document';
end $$;

-- =====================================================================================
-- E4 · Documentos maestros de producto (Prompt 0B, v1.0 y v1.1)
-- Materiales, productos PRD-001 y PRD-014, brief BR-2026-0011, prototipos P-0007 (reformular),
-- P-0008 (descartado) y P-0007-1 (aprobado), estudios de estabilidad, fórmula v3 (IDI-FM-001,
-- código supuesto D-49), especificación IDI-EP-007 v02, instructivo IDI-IN-012 v03 y costos.
-- Valores intermedios de las lecturas, funciones de las materias primas, métodos de análisis y
-- códigos de los materiales de envase son ilustrativos (ficticios).
-- =====================================================================================
do $$
declare
  v_camila constant uuid := 'a1000000-0000-4000-8000-000000000001';
  v_sebastian constant uuid := 'a1000000-0000-4000-8000-000000000002';
  v_natalia constant uuid := 'a1000000-0000-4000-8000-000000000007';
  v_ricardo constant uuid := 'a1000000-0000-4000-8000-000000000008';
  v_lucia constant uuid := 'a1000000-0000-4000-8000-000000000009';
  v_esteban constant uuid := 'a1000000-0000-4000-8000-000000000010';
  v_marcela constant uuid := 'a1000000-0000-4000-8000-000000000015';
  v_valentina constant uuid := 'a1000000-0000-4000-8000-000000000014';
  v_prd uuid := 'e4000000-0000-4000-8000-000000000001';
  v_p200 uuid := 'e4000000-0000-4000-8000-000000000011';
  v_p400 uuid := 'e4000000-0000-4000-8000-000000000012';
  v_brief uuid := 'e4000000-0000-4000-8000-000000000101';
  v_p7 uuid := 'e4000000-0000-4000-8000-000000000201';
  v_p8 uuid := 'e4000000-0000-4000-8000-000000000202';
  v_p71 uuid := 'e4000000-0000-4000-8000-000000000203';
  v_protocol uuid;
  v_study uuid;
  v_test record;
  v_tp text;
  v_r int;
  v_off interval;
  v_start timestamptz;
  v_doc uuid := 'e4000000-0000-4000-8000-000000000301';
  v_ver uuid := 'e4000000-0000-4000-8000-000000000302';
  v_formula uuid := 'e4000000-0000-4000-8000-000000000303';
  v_spec uuid;
  v_instr uuid;
  v_cs uuid;
begin
  if exists (select 1 from public.products where code = 'PRD-001')
     or not exists (select 1 from public.controlled_documents where code = 'CC-PC-001') then
    return;
  end if;
  select current_version_id into v_protocol from public.controlled_documents where code = 'CC-PC-001';

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
    ('EM-CAJA-400', 'Caja 400 mL', 'empaque', 'und', null, false);

  insert into public.products (id, code, name, line_id, titular, sanitary_registration, sanitary_registration_expires, shelf_life_months)
  values (v_prd, 'PRD-001', 'Loción micelar ClariPlus', (select id from public.product_lines where code = 'COS'),
          'GRUFARCOL S.A.S.', 'NSO-FICT-2025-01234', '2030-09-30', 24),
         ('e4000000-0000-4000-8000-000000000002', 'PRD-014', 'Suspensión oral Ibuprofeno 100 mg/5 mL',
          (select id from public.product_lines where code = 'MED'), 'GRUFARCOL S.A.S.', null, null, null);
  insert into public.product_presentations (id, product_id, code, name, net_content, unit) values
    (v_p200, v_prd, '200', '200 mL', 200, 'mL'), (v_p400, v_prd, '400', '400 mL', 400, 'mL');
  update public.controlled_documents set regulatory_expiry_date = '2030-09-30' where code in ('IDI-IN-012', 'IDI-EP-007');

  -- Brief BR-2026-0011 (aprobado por el Dr. Gaviria).
  insert into public.briefs (id, code, product_id, execution_date, project_name, project_type, product_category, justification,
    sources_description, sensorial, target, channels, margin_pct, suggested_price_by_presentation, legal_requirements,
    implementation_costs, recommendations, status, created_by, updated_by)
  values (v_brief, 'BR-2026-0011', v_prd, '2026-06-15', 'Loción micelar ClariPlus 400 mL', 'nuevo_portafolio', 'cosmetico',
    'Ampliar la línea de higiene facial con un producto para piel sensible',
    'Estudio de góndola en 12 farmacias y 2 tiendas en línea, junio 2026',
    '{"aroma": "suave", "color": "incoloro", "apariencia": "translúcida"}',
    '{"estrato": "3–5", "rango_edad": "25–45 años", "sexo": "Mujeres", "ingresos": "2 a 6 salarios mínimos", "para_quien": "Mujeres de 25 a 45 años con piel sensible", "psicograficos": "Busca rutinas simples y productos suaves", "actitud_compra": "Compara precio y componentes", "frecuencia_consumo": "Mensual"}',
    array['cadenas', 'subtiendas'], 45,
    '[{"presentation": "400 mL", "price": 28900}, {"presentation": "200 mL", "price": 17900}]',
    'Notificación sanitaria obligatoria; rotulado según norma vigente', 'Moldes y artes de etiqueta', 'Lanzar primero en farmacias',
    'aprobado', v_camila, v_esteban);
  insert into public.brief_competitors (brief_id, order_no, manufacturer, product_name, container, cap_type, label_type, claims, actives,
    price, net_content_ml, aroma, color, appearance, created_by) values
    (v_brief, 1, 'Lumia', 'Agua micelar sensible', 'PET transparente', 'Flip-top', 'Autoadhesiva',
     'Sin perfume agresivo, dermatológicamente probado', 'Glicerina', 32500, 400, null, null, null, v_camila),
    (v_brief, 2, 'Dermia', 'Solución micelar', 'PET', 'Rosca', 'Envolvente', 'Hipoalergénica', 'Manzanilla', 26900, 400, null, null, null, v_camila),
    (v_brief, 3, 'Pura', 'Micelar facial', 'Vidrio', 'Bomba dosificadora', 'Serigrafiada', null, null, 41000, 250, null, null, null, v_camila);
  insert into public.signatures (user_id, record_table, record_id, meaning, signed_as, record_hash, short_signature, signer_name,
    reauth_method, signed_at, created_by, updated_by)
  select s.uid, 'briefs', v_brief, s.m::public.signature_meaning, s.role,
    public.record_hash(app_private.signable_row('briefs', (select to_jsonb(b) from public.briefs b where b.id = v_brief))),
    coalesce(sr.short_signature, p.full_name), p.full_name, 'password', s.at, s.uid, s.uid
  from (values (v_camila, 'actualizo', 'comercial', timestamptz '2026-06-15 16:00-05'),
               (v_esteban, 'aprobo', 'dt', timestamptz '2026-06-18 10:00-05')) as s(uid, m, role, at)
  join public.profiles p on p.id = s.uid left join public.signature_registry sr on sr.user_id = s.uid;
  update public.briefs set locked_at = '2026-06-18 10:00-05' where id = v_brief;

  -- Prototipos.
  insert into public.formula_prototypes (id, brief_id, code, parent_prototype_id, iteration_no, product_type, target_description, benefit,
    concept, draft_instruction, status, status_reason, approved_at, created_by, updated_by) values
    (v_p7, v_brief, 'P-0007', null, 0, 'Loción micelar · cosmético', 'Mujeres 25–45 años con piel sensible',
     'Limpieza suave con efecto calmante', 'Loción micelar con extracto de manzanilla',
     '1. Calentar fase acuosa a 70–75 °C.\n2. Disolver glicerina.\n3. Enfriar y agregar el extracto.', 'reformular',
     'Separación de fase a los 7 días, calentamiento', null, v_sebastian, v_ricardo),
    (v_p8, v_brief, 'P-0008', null, 0, 'Loción micelar · cosmético', 'Mismo público', 'Limpieza suave sin enjuague',
     'Loción micelar sin extracto', '', 'descartado', 'Descartado frente a P-0007', null, v_sebastian, v_sebastian),
    (v_p71, v_brief, 'P-0007-1', v_p7, 1, 'Loción micelar · cosmético', 'Mismo público',
     'Limpieza suave, estable en calentamiento y enfriamiento', 'Mejora de P-0007 con poloxámero 1,5 %',
     '1. Calentar fase acuosa a 70–75 °C.\n2. Disolver glicerina y poloxámero.\n3. Enfriar a 35 °C y agregar perfume.', 'aprobado',
     null, '2026-08-25 11:00-05', v_sebastian, v_esteban);
  insert into public.prototype_items (prototype_id, material_id, pct, function, order_no, created_by)
  select v.pid, m.id, v.pct, m.default_function, v.n, v_sebastian
  from (values
    (v_p71, 'MP-001', 94.20, 1), (v_p71, 'MP-014', 3.00, 2), (v_p71, 'MP-022', 1.50, 3), (v_p71, 'MP-031', 0.80, 4),
    (v_p71, 'MP-040', 0.30, 5), (v_p71, 'MP-032', 0.10, 6), (v_p71, 'MP-055', 0.05, 7), (v_p71, 'MP-060', 0.05, 8),
    (v_p7, 'MP-001', 95.70, 1), (v_p7, 'MP-014', 3.00, 2), (v_p7, 'MP-031', 0.80, 3), (v_p7, 'MP-040', 0.30, 4),
    (v_p7, 'MP-032', 0.10, 5), (v_p7, 'MP-060', 0.10, 6),
    (v_p8, 'MP-001', 96.00, 1), (v_p8, 'MP-014', 3.00, 2), (v_p8, 'MP-031', 0.80, 3), (v_p8, 'MP-032', 0.10, 4), (v_p8, 'MP-060', 0.10, 5)
  ) as v(pid, code, pct, n) join public.materials m on m.code = v.code;
  insert into public.prototype_approvals (prototype_id, approver_role, approver, approver_name, reason, reauth_method, decided_at, created_by) values
    (v_p71, 'gerencia', v_marcela, 'Marcela Duarte', 'Conforme Gerencia', 'password', '2026-08-24 15:00-05', v_marcela),
    (v_p71, 'dt', v_esteban, 'Dr. Esteban Gaviria', 'Conforme Dirección técnica', 'password', '2026-08-25 11:00-05', v_esteban);

  -- Estudios de estabilidad: P-0007 (cerrado anticipadamente «No cumple») y P-0007-1 (cumple).
  for v_study, v_start in
    select * from (values ('e4000000-0000-4000-8000-000000000401'::uuid, timestamptz '2026-07-01 08:00-05'),
                          ('e4000000-0000-4000-8000-000000000402'::uuid, timestamptz '2026-07-20 08:00-05')) as s(id, st)
  loop
    insert into public.stability_studies (id, prototype_id, protocol_document_version_id, start_date, end_date, status, created_by)
    values (v_study, case when v_study = 'e4000000-0000-4000-8000-000000000401' then v_p7 else v_p71 end, v_protocol,
            v_start, v_start + interval '30 days', 'en_curso', v_sebastian);
    insert into public.stability_tests (study_id, test_type, required, condition_min, condition_max, unit, replicates, lab, external_lab_name,
      report_file, sample_volume_ml, method, created_by)
    values (v_study, 'calentamiento', true, 42, 48, '°C', 3, 'interno', null, null, null, null, v_sebastian),
           (v_study, 'enfriamiento', true, 0, 8, '°C', 3, 'interno', null, null, null, null, v_sebastian),
           (v_study, 'microbiologica', true, null, null, 'UFC/g', 1, 'externo', 'Laboratorio Externo Andino',
            case when v_study = 'e4000000-0000-4000-8000-000000000402' then 'IM-2026-0188' end, null, null, v_sebastian),
           (v_study, 'viscosidad', true, null, null, 'mPa·s', 3, 'interno', null, null,
            case when v_study = 'e4000000-0000-4000-8000-000000000402' then 300 end, null, v_sebastian),
           (v_study, 'densidad', true, null, null, 'g/mL', 1, 'interno', null, null, null, 'picnometro', v_sebastian);
    for v_test in select * from public.stability_tests where study_id = v_study loop
      foreach v_tp in array case when v_test.test_type in ('calentamiento', 'enfriamiento')
                                 then array['0h', '12h', '24h', '3d', '7d', '15d', '30d'] else array['0h', '30d'] end loop
        v_off := case v_tp when '0h' then interval '0' when '12h' then interval '12 hours' when '24h' then interval '24 hours'
                           when '3d' then interval '3 days' when '7d' then interval '7 days' when '15d' then interval '15 days'
                           else interval '30 days' end;
        for v_r in 1 .. v_test.replicates loop
          insert into public.stability_readings (test_id, time_point, replicate, due_at, unit, created_by)
          values (v_test.id, v_tp, v_r, v_start + v_off, v_test.unit, v_sebastian);
        end loop;
      end loop;
    end loop;
  end loop;

  -- Lecturas de P-0007-1 (todas) y de P-0007 (hasta los 7 días; separación de fase en calentamiento a los 7 d).
  update public.stability_readings r set
    recorded_at = r.due_at + interval '1 hour', recorded_by = v_natalia, locked_at = r.due_at + interval '1 hour',
    temperature = case t.test_type
      when 'calentamiento' then case when r.time_point = '0h' then (array[45.1, 44.8, 45.3])[r.replicate]
                                     when r.time_point = '30d' then (array[45.0, 45.2, 44.9])[r.replicate] else 45.0 + (r.replicate - 2) * 0.1 end
      when 'enfriamiento' then case when r.time_point = '0h' then (array[4.2, 4.0, 4.3])[r.replicate]
                                    when r.time_point = '30d' then (array[4.1, 4.3, 4.0])[r.replicate] else 4.1 end end,
    ph = case t.test_type
      when 'calentamiento' then case when r.time_point = '0h' then (array[5.6, 5.6, 5.5])[r.replicate]
                                     when r.time_point = '30d' then (array[5.4, 5.5, 5.4])[r.replicate] else 5.5 end
      when 'enfriamiento' then case when r.time_point = '30d' then (array[5.6, 5.5, 5.6])[r.replicate] else 5.6 end end,
    organoleptic = case when t.test_type in ('calentamiento', 'enfriamiento')
      then '{"aspecto": "líquido translúcido", "color": "incoloro", "olor": "característico", "cambio": false}'::jsonb end,
    analytes = case when t.test_type = 'microbiologica'
      then '{"mesofilos": {"qualifier": "<", "value": 10}, "pseudomonas": "ausente", "staphylococcus": "ausente", "ecoli": "ausente"}'::jsonb end,
    value = case t.test_type
      when 'viscosidad' then case when r.time_point = '0h' then (array[11.8, 12.0, 11.9])[r.replicate] else (array[11.6, 11.7, 11.8])[r.replicate] end
      when 'densidad' then case when r.time_point = '0h' then 1.004 else 1.003 end end,
    in_range = case when t.test_type in ('calentamiento', 'enfriamiento') then true end
  from public.stability_tests t
  where t.id = r.test_id and t.study_id = 'e4000000-0000-4000-8000-000000000402';

  update public.stability_readings r set
    recorded_at = r.due_at + interval '1 hour', recorded_by = v_natalia, locked_at = r.due_at + interval '1 hour',
    temperature = case when t.test_type = 'calentamiento' then 45.0 + (r.replicate - 2) * 0.1 else 4.1 end,
    ph = 5.6, in_range = true,
    organoleptic = case when t.test_type = 'calentamiento' and r.time_point = '7d'
      then '{"aspecto": "separación de fase", "color": "incoloro", "olor": "característico", "cambio": true}'::jsonb
      else '{"aspecto": "líquido translúcido", "color": "incoloro", "olor": "característico", "cambio": false}'::jsonb end
  from public.stability_tests t
  where t.id = r.test_id and t.study_id = 'e4000000-0000-4000-8000-000000000401'
    and t.test_type in ('calentamiento', 'enfriamiento') and r.time_point in ('0h', '12h', '24h', '3d', '7d');

  update public.stability_studies set status = 'cerrado_anticipado', result = 'no_cumple',
    early_close_reason = 'Separación de fase a los 7 días, calentamiento', closed_by = v_ricardo,
    closed_at = '2026-07-08 10:00-05', locked_at = '2026-07-08 10:00-05'
  where id = 'e4000000-0000-4000-8000-000000000401';
  update public.stability_studies set status = 'completo', result = 'cumple', conclusions = 'Sin cambios organolépticos; pH, viscosidad y microbiología estables a los 30 días.',
    closed_by = v_ricardo, closed_at = '2026-08-19 16:00-05', locked_at = '2026-08-19 16:00-05'
  where id = 'e4000000-0000-4000-8000-000000000402';
  insert into public.signatures (user_id, record_table, record_id, meaning, signed_as, record_hash, short_signature, signer_name,
    reason, reauth_method, signed_at, created_by, updated_by)
  select v_ricardo, 'stability_studies', s.id, 'aprobo', 'cc_jefe',
    public.record_hash(app_private.signable_row('stability_studies', to_jsonb(s))),
    coalesce((select short_signature from public.signature_registry where user_id = v_ricardo), 'Ricardo Peña'), 'Ricardo Peña',
    s.early_close_reason, 'password', s.closed_at, v_ricardo, v_ricardo
  from public.stability_studies s where s.id in ('e4000000-0000-4000-8000-000000000401', 'e4000000-0000-4000-8000-000000000402');

  -- Fórmula v3 (IDI-FM-001), vigente desde el 25-08-2026 y con la vigencia del registro sanitario.
  insert into public.controlled_documents (id, code, title, type_id, process_id, status, validity_rule, regulatory_expiry_date,
    route_id, created_by, updated_by)
  values (v_doc, 'IDI-FM-001', 'Fórmula maestra ClariPlus', (select id from public.document_types where type_code = 'FM'),
    (select id from public.organizational_areas where code = 'IDI'), 'en_elaboracion', 'registro_sanitario', '2030-09-30',
    (select id from public.approval_routes where code = 'tecnica'), v_valentina, v_valentina);
  insert into public.document_versions (id, document_id, version_no, status, author_id, content, content_hash, change_description,
    issue_date, review_due_date, effective_at, created_by, updated_by)
  values (v_ver, v_doc, 3, 'vigente', v_sebastian, pg_temp.seed_content('Fórmula maestra ClariPlus', false),
    public.record_hash(pg_temp.seed_content('Fórmula maestra ClariPlus', false)), 'Fórmula v3 desde el prototipo P-0007-1',
    '2026-08-25', '2030-09-30', '2026-08-25 13:00-05', v_sebastian, v_sebastian);
  insert into public.formulas (id, document_version_id, product_id, prototype_id, batch_size, created_by)
  values (v_formula, v_ver, v_prd, v_p71, 2000, v_sebastian);
  insert into public.formula_items (formula_id, material_id, pct, function, order_no, created_by)
  select v_formula, material_id, pct, function, order_no, v_sebastian from public.prototype_items where prototype_id = v_p71;
  update public.formulas set locked_at = '2026-08-25 12:00-05' where id = v_formula;
  update public.document_versions set locked_at = '2026-08-25 12:00-05' where id = v_ver;
  insert into public.signatures (user_id, record_table, record_id, meaning, signed_as, record_hash, short_signature, signer_name,
    group_key, reauth_method, signed_at, created_by, updated_by)
  select s.uid, 'document_versions', v_ver, s.m::public.signature_meaning, s.role,
    public.record_hash(app_private.signable_row('document_versions', (select to_jsonb(v) from public.document_versions v where v.id = v_ver))),
    coalesce(sr.short_signature, p.full_name), p.full_name, v_doc::text, 'password', s.at, s.uid, s.uid
  from (values (v_sebastian, 'actualizo', 'idi', timestamptz '2026-08-25 08:00-05'), (v_lucia, 'reviso', 'aq_dir', timestamptz '2026-08-25 09:00-05'),
               (v_esteban, 'aprobo', 'dt', timestamptz '2026-08-25 11:30-05')) as s(uid, m, role, at)
  join public.profiles p on p.id = s.uid left join public.signature_registry sr on sr.user_id = s.uid;
  update public.controlled_documents set status = 'vigente', current_version_id = v_ver, next_review_date = '2030-09-30' where id = v_doc;
  insert into public.document_distribution (version_id, area_id, delivered_at, delivered_by, created_by)
  select v_ver, a.id, '2026-08-25 13:00-05', v_valentina, v_valentina from public.organizational_areas a where a.code in ('IDI', 'PRD');

  -- Contenido de la especificación IDI-EP-007 v02 y del instructivo IDI-IN-012 v03 (versiones vigentes de la semilla de E3).
  insert into public.specifications (document_version_id, scope, product_id, created_by)
  select current_version_id, 'pt', v_prd, v_sebastian from public.controlled_documents where code = 'IDI-EP-007'
  returning id into v_spec;
  insert into public.spec_parameters (specification_id, order_no, name, method, min_value, max_value, unit, text_limit, created_by) values
    (v_spec, 1, 'pH', 'Potenciometría', 5.0, 6.0, null, null, v_sebastian),
    (v_spec, 2, 'Densidad', 'Picnometría', 0.990, 1.020, 'g/mL', null, v_sebastian),
    (v_spec, 3, 'Aspecto', 'Visual', null, null, null, 'Líquido translúcido incoloro', v_sebastian),
    (v_spec, 4, 'Olor', 'Organoléptico', null, null, null, 'Característico', v_sebastian),
    (v_spec, 5, 'Recuento total de aerobios mesófilos', 'Recuento en placa', null, 100, 'UFC/g', '< 100 UFC/g', v_sebastian),
    (v_spec, 6, 'Pseudomonas aeruginosa', 'Método microbiológico', null, null, null, 'Ausente', v_sebastian);
  update public.specifications set locked_at = '2025-10-30 12:00-05' where id = v_spec;

  insert into public.instructions (document_version_id, product_id, stage, created_by)
  select current_version_id, v_prd, 'fabricacion', v_sebastian from public.controlled_documents where code = 'IDI-IN-012'
  returning id into v_instr;
  insert into public.instruction_steps (instruction_id, order_no, label, text, requires_equipment, requires_verification, params, created_by)
  select v_instr, s.order_no, s.label, s.text, s.requires_equipment, s.requires_verification, s.params, v_sebastian
  from public.process_template_steps s where s.template_id = 'e3000000-0000-4000-8000-000000000002';
  update public.instructions set locked_at = '2026-08-25 12:00-05' where id = v_instr;

  -- Hoja de costos de la fórmula v3 (lote de 2.000 kg; $ por kg y por unidad del Prompt 0B).
  insert into public.cost_sheets (formula_id, batch_size, density, industrial_lot_units, created_by)
  values (v_formula, 2000, 1, jsonb_build_object(v_p200::text, 5000, v_p400::text, 2500), v_sebastian)
  returning id into v_cs;
  insert into public.cost_sheet_lines (cost_sheet_id, kind, material_id, description, unit_cost, qty, unit, created_by)
  select v_cs, 'ingrediente', m.id, m.name, v.cost, round(i.pct * 20, 4), 'kg', v_sebastian
  from (values ('MP-001', 150), ('MP-014', 6800), ('MP-022', 38000), ('MP-031', 52000), ('MP-040', 95000),
               ('MP-032', 140000), ('MP-055', 9500), ('MP-060', 380000)) as v(code, cost)
  join public.materials m on m.code = v.code join public.formula_items i on i.material_id = m.id and i.formula_id = v_formula;
  insert into public.cost_sheet_lines (cost_sheet_id, kind, presentation_id, description, unit_cost, qty, unit, created_by)
  values (v_cs, 'envase', v_p200, 'Envase PET 200 mL', 650, 1, 'und', v_sebastian), (v_cs, 'tapa', v_p200, 'Tapa flip-top', 180, 1, 'und', v_sebastian),
         (v_cs, 'etiqueta', v_p200, 'Etiqueta 200 mL', 120, 1, 'und', v_sebastian), (v_cs, 'caja', v_p200, 'Caja 200 mL', 150, 1, 'und', v_sebastian),
         (v_cs, 'envase', v_p400, 'Envase PET 400 mL', 980, 1, 'und', v_sebastian), (v_cs, 'tapa', v_p400, 'Tapa flip-top', 180, 1, 'und', v_sebastian),
         (v_cs, 'etiqueta', v_p400, 'Etiqueta 400 mL', 150, 1, 'und', v_sebastian), (v_cs, 'caja', v_p400, 'Caja 400 mL', 200, 1, 'und', v_sebastian);

  update public.numbering_sequences set last_value = greatest(last_value, 11), year = 2026 where key = 'brief';
  update public.numbering_sequences set last_value = greatest(last_value, 8) where key = 'prototype';
end $$;
