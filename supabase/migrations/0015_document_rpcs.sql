-- 0015_document_rpcs.sql · Etapa E3 (PRD F2B)
-- RPC del sistema de gestión documental (PRD 2.5, 8, 9; RF-05, RF-92…103). Cada una valida rol,
-- estado y segregación (SOD-8, SOD-10) y escribe con su bitácora en una sola transacción.
-- Códigos de error: FORBIDDEN_ROLE, SOD_VIOLATION, RECORD_LOCKED, INVALID_TRANSITION, NOT_STANDARDIZED,
-- STYLE_CHECK_FAILED, ROUTE_INCOMPLETE, RECALL_PENDING, PARENT_DOCUMENT_REVIEW_REQUIRED,
-- TRAINING_REQUIRED, TRAINING_NOT_PASSED, DOCUMENT_NOT_EFFECTIVE.

-- Las firmas de documentos las lee todo usuario con acceso al SGD (cuadro de firmas).
create policy "document readers read document signatures" on public.signatures
  for select to authenticated using (record_table = 'document_versions' and public.can_read_documents());

-- ---------------------------------------------------------------------------
-- 1. Ayudas internas
-- ---------------------------------------------------------------------------
create or replace function app_private.require_document_author()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.has_module_permission('sistema_de_gestion_documental', 'create')
          or public.has_any_role(array['aq_dir', 'dt', 'gerencia'])) then
    raise exception 'FORBIDDEN_ROLE: su rol no permite solicitar ni redactar documentos controlados';
  end if;
end;
$$;

create or replace function app_private.require_aq_doc()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('aq_doc') then
    raise exception 'FORBIDDEN_ROLE: solo Aseguramiento de la calidad (analista de gestión documental) realiza esta acción';
  end if;
end;
$$;

-- Jefe de área: jefe registrado de un área o rol de jefatura (PRD 2.5.6).
create or replace function app_private.is_area_head(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.organizational_areas where head_user_id = p_user and active)
      or public.user_active_roles(p_user) && array['bodega_jefe', 'prod_coord', 'cc_jefe', 'aq_dir', 'dt', 'gerencia'];
$$;

create or replace function app_private.lock_version(p_version uuid)
returns public.document_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.document_versions;
begin
  select * into v from public.document_versions where id = p_version for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la versión del documento';
  end if;
  return v;
end;
$$;

create or replace function app_private.version_type(p_version public.document_versions)
returns public.document_types
language sql
stable
security definer
set search_path = ''
as $$
  select t.* from public.document_types t
  where t.id = coalesce(
    (select d.type_id from public.controlled_documents d where d.id = (p_version).document_id),
    (select r.type_id from public.document_requests r where r.id = (p_version).request_id));
$$;

create or replace function app_private.version_label(p_version public.document_versions)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select d.code from public.controlled_documents d where d.id = (p_version).document_id), 'preliminar')
         || ' v' || lpad((p_version).version_no::text, 2, '0');
$$;

-- Plantilla editable: estructura obligatoria del tipo (PRD 2.5.3).
create or replace function app_private.document_template(p_type_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'objetivo', '',
    'alcance', case when coalesce(t.requires_scope, true) then '' end,
    'responsables', '',
    'desarrollo', '',
    'documentos_relacionados', '',
    'control_cambios', ''))
  from (select 1) x left join public.document_types t on t.id = p_type_id;
$$;

-- Firma de una versión (actualizo/reviso/aprobo): reautenticación, huella y bitácora.
create or replace function app_private.sign_document_version(
  p_version uuid, p_meaning public.signature_meaning, p_password text, p_reason text, p_signed_as text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_auth jsonb;
  v_row jsonb;
  v_name text;
  v_short text;
  v_sig public.signatures;
begin
  v_auth := app_private.verify_reauth(v_uid, p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  select to_jsonb(v) into v_row from public.document_versions v where v.id = p_version;
  select full_name into v_name from public.profiles where id = v_uid;
  select short_signature into v_short from public.signature_registry where user_id = v_uid;
  insert into public.signatures (
    user_id, record_table, record_id, meaning, signed_as, record_hash, short_signature, signer_name,
    group_key, reason, reauth_method, created_by, updated_by
  ) values (
    v_uid, 'document_versions', p_version, p_meaning, p_signed_as,
    public.record_hash(app_private.signable_row('document_versions', v_row)),
    coalesce(v_short, v_name), v_name, v_row ->> 'document_id', nullif(trim(p_reason), ''),
    v_auth ->> 'method', v_uid, v_uid
  ) returning * into v_sig;
  return jsonb_build_object('ok', true, 'signature_id', v_sig.id, 'signed_at', v_sig.signed_at,
                            'short_signature', v_sig.short_signature, 'signer_name', v_sig.signer_name);
end;
$$;

revoke execute on function app_private.require_document_author() from public, anon, authenticated;
revoke execute on function app_private.require_aq_doc() from public, anon, authenticated;
revoke execute on function app_private.is_area_head(uuid) from public, anon, authenticated;
revoke execute on function app_private.lock_version(uuid) from public, anon, authenticated;
revoke execute on function app_private.version_type(public.document_versions) from public, anon, authenticated;
revoke execute on function app_private.version_label(public.document_versions) from public, anon, authenticated;
revoke execute on function app_private.document_template(uuid) from public, anon, authenticated;
revoke execute on function app_private.sign_document_version(uuid, public.signature_meaning, text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Revisor de redacción (PRD 2.5.3, RF-94, AC-33)
-- ---------------------------------------------------------------------------
-- Devuelve las observaciones: secciones mínimas vacías, términos subjetivos y renglones del objetivo y
-- del desarrollo que no inician con un verbo en infinitivo. Función pura: la usa también el editor.
create or replace function public.style_observations(p_content jsonb, p_type_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_type public.document_types;
  v_obs jsonb := '[]';
  v_sections text[][] := array[
    ['objetivo', 'Objetivo'], ['alcance', 'Alcance'], ['responsables', 'Responsables'],
    ['desarrollo', 'Desarrollo'], ['documentos_relacionados', 'Documentos relacionados y anexos'],
    ['control_cambios', 'Control de cambios']];
  v_i int;
  v_key text;
  v_label text;
  v_text text;
  v_term text;
  v_line text;
  v_word text;
  v_n int;
begin
  select * into v_type from public.document_types where id = p_type_id;
  p_content := coalesce(p_content, '{}');

  for v_i in 1 .. array_length(v_sections, 1) loop
    v_key := v_sections[v_i][1];
    v_label := v_sections[v_i][2];
    continue when v_key = 'alcance' and found and not v_type.requires_scope;
    v_text := coalesce(p_content ->> v_key, '');
    if length(trim(v_text)) = 0 then
      v_obs := v_obs || jsonb_build_object('section', v_key, 'rule', 'seccion_minima',
        'message', format('Falta la sección «%s».', v_label));
      continue;
    end if;
    for v_term in select jsonb_array_elements_text(coalesce(public.get_setting('style_forbidden_terms'), '[]')) loop
      if position(lower(v_term) in lower(v_text)) > 0 then
        v_obs := v_obs || jsonb_build_object('section', v_key, 'rule', 'termino_subjetivo',
          'message', format('%s: el término «%s» es subjetivo o impreciso; reemplácelo por un criterio medible.', v_label, v_term));
      end if;
    end loop;
    if v_key in ('objetivo', 'desarrollo') then
      v_n := 0;
      foreach v_line in array regexp_split_to_array(v_text, E'\n') loop
        v_n := v_n + 1;
        v_line := trim(regexp_replace(v_line, '^\s*([0-9]+(\.[0-9]+)*[.)]?|[-•*])\s*', ''));
        continue when length(v_line) = 0 or v_line ~ ':\s*$';
        v_word := lower(substring(v_line from '^([[:alpha:]áéíóúñüÁÉÍÓÚÑÜ]+)'));
        if v_word is null or v_word !~ '(ar|er|ir|ír)(se|lo|la|los|las|le|les)?$' then
          v_obs := v_obs || jsonb_build_object('section', v_key, 'rule', 'infinitivo',
            'message', format('%s, renglón %s: «%s» no inicia con un verbo en infinitivo.', v_label, v_n, left(v_line, 60)));
        end if;
      end loop;
    end if;
  end loop;
  return v_obs;
end;
$$;

revoke execute on function public.style_observations(jsonb, uuid) from public, anon;
grant execute on function public.style_observations(jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Solicitud y preliminar (RF-93)
-- ---------------------------------------------------------------------------
create or replace function public.request_document(
  p_kind text,
  p_document_id uuid,
  p_process_id uuid,
  p_type_id uuid,
  p_parent_document_id uuid,
  p_title text,
  p_reason text,
  p_distribution uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_doc public.controlled_documents;
  v_cur public.document_versions;
  v_req public.document_requests;
  v_ver public.document_versions;
  v_ann public.document_annulments;
begin
  perform app_private.require_document_author();
  perform app_private.require_reason(p_reason);
  if p_kind not in ('creacion', 'modificacion', 'anulacion') then
    raise exception 'INVALID_FIELD: tipo de solicitud desconocido: %', p_kind;
  end if;

  if p_kind = 'creacion' then
    if p_type_id is null or not exists (select 1 from public.document_types where id = p_type_id and active) then
      raise exception 'INVALID_FIELD: indique el tipo de documento';
    end if;
    if p_process_id is null or not exists (
      select 1 from public.organizational_areas where id = p_process_id and process_code is not null and active) then
      raise exception 'INVALID_FIELD: indique un proceso con sigla para el código';
    end if;
    if p_parent_document_id is not null and not exists (
      select 1 from public.controlled_documents where id = p_parent_document_id and status <> 'anulado') then
      raise exception 'RECORD_NOT_FOUND: no existe el procedimiento padre';
    end if;
  else
    select * into v_doc from public.controlled_documents where id = p_document_id;
    if not found then
      raise exception 'RECORD_NOT_FOUND: no existe el documento';
    end if;
    if v_doc.status <> 'vigente' then
      raise exception 'INVALID_TRANSITION: el documento % no está vigente (está %)', v_doc.code, v_doc.status;
    end if;
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);
  insert into public.document_requests (code, kind, requested_by, document_id, process_id, type_id,
    parent_document_id, proposed_title, reason, requested_distribution, status, template_delivered_at)
  values (public.next_number('document_request'), p_kind, v_uid, p_document_id,
    coalesce(p_process_id, v_doc.process_id), coalesce(p_type_id, v_doc.type_id),
    coalesce(p_parent_document_id, v_doc.parent_document_id), coalesce(nullif(trim(p_title), ''), v_doc.title),
    trim(p_reason), coalesce(p_distribution, '{}'), 'abierta',
    case when p_kind <> 'anulacion' then now() end)
  returning * into v_req;

  if p_kind = 'creacion' then
    insert into public.document_versions (request_id, version_no, status, author_id, content)
    values (v_req.id, 1, 'solicitado', v_uid, app_private.document_template(p_type_id))
    returning * into v_ver;
  elsif p_kind = 'modificacion' then
    if exists (select 1 from public.document_versions where document_id = v_doc.id and status not in ('vigente', 'obsoleto')) then
      raise exception 'INVALID_TRANSITION: el documento % ya tiene una versión en curso', v_doc.code;
    end if;
    select * into v_cur from public.document_versions where id = v_doc.current_version_id;
    insert into public.document_versions (document_id, request_id, version_no, status, author_id, content, supersedes_id)
    values (v_doc.id, v_req.id, (select max(version_no) + 1 from public.document_versions where document_id = v_doc.id),
            'solicitado', v_uid, coalesce(v_cur.content, app_private.document_template(v_doc.type_id)), v_cur.id)
    returning * into v_ver;
  else
    if not app_private.is_area_head(v_uid) then
      raise exception 'FORBIDDEN_ROLE: la anulación de un documento la solicita un jefe de área (PRD 2.5.6)';
    end if;
    if exists (select 1 from public.document_annulments where document_id = v_doc.id and status in ('solicitada', 'aprobada')) then
      raise exception 'INVALID_TRANSITION: el documento % ya tiene una anulación en curso', v_doc.code;
    end if;
    insert into public.document_annulments (code, document_id, request_id, requested_by, reason)
    values (public.next_number('document_annulment'), v_doc.id, v_req.id, v_uid, trim(p_reason))
    returning * into v_ann;
  end if;
  perform set_config('app.audit_reason', '', true);

  return jsonb_build_object('request_id', v_req.id, 'request_code', v_req.code, 'version_id', v_ver.id,
                            'annulment_id', v_ann.id, 'annulment_code', v_ann.code);
end;
$$;

-- El autor redacta el preliminar sobre la plantilla editable. Una versión fuera de borrador no se edita (SOD-10).
create or replace function public.save_document_draft(
  p_version uuid,
  p_content jsonb,
  p_change_description text default null,
  p_technical_change boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.document_versions := app_private.lock_version(p_version);
  v_clean jsonb := '{}';
  v_key text;
begin
  if v.status not in ('solicitado', 'preliminar') or v.locked_at is not null then
    raise exception 'RECORD_LOCKED: la versión % ya no es un borrador; cree una versión nueva en borrador', app_private.version_label(v);
  end if;
  if v.author_id <> auth.uid() then
    raise exception 'FORBIDDEN_ROLE: solo el autor redacta el preliminar';
  end if;
  if jsonb_typeof(p_content) <> 'object' then
    raise exception 'INVALID_FIELD: el contenido debe tener secciones';
  end if;
  for v_key in select jsonb_object_keys(app_private.document_template((app_private.version_type(v)).id)) loop
    v_clean := v_clean || jsonb_build_object(v_key, coalesce(p_content ->> v_key, ''));
  end loop;
  update public.document_versions
  set content = v_clean, status = 'preliminar',
      change_description = coalesce(p_change_description, change_description),
      technical_change = coalesce(p_technical_change, technical_change)
  where id = p_version;
end;
$$;

create or replace function public.submit_for_standardization(p_version uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.document_versions := app_private.lock_version(p_version);
begin
  if v.author_id <> auth.uid() then
    raise exception 'FORBIDDEN_ROLE: solo el autor envía el preliminar a estandarización';
  end if;
  if v.status <> 'preliminar' then
    raise exception 'INVALID_TRANSITION: la versión está %; solo un preliminar se envía a estandarización', v.status;
  end if;
  if v.version_no > 1 and length(trim(v.change_description)) = 0 then
    raise exception 'INVALID_FIELD: describa el cambio (control de cambios) antes de enviar';
  end if;
  update public.document_versions set status = 'en_estandarizacion' where id = p_version;
  update public.document_requests set status = 'en_curso' where id = v.request_id and status = 'abierta';
  update public.document_change_requests set status = 'en_elaboracion' where id = v.change_request_id and status = 'abierta';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Estandarización y código (RF-93, RF-94; AC-26, AC-28, AC-33)
-- ---------------------------------------------------------------------------
-- p_checklist: verificaciones manuales de la analista {"encabezado": true, "unidades_si": true, "na": true}.
create or replace function public.run_style_check(p_version uuid, p_checklist jsonb default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.document_versions;
  v_obs jsonb;
  v_item text;
  v_labels jsonb := '{"encabezado": "Encabezado completo", "unidades_si": "Unidades del Sistema Internacional", "na": "«N.A.» cuando no aplica"}';
  v_result text;
  v_check public.standardization_checks;
begin
  perform app_private.require_aq_doc();
  v := app_private.lock_version(p_version);
  if v.status <> 'en_estandarizacion' then
    raise exception 'INVALID_TRANSITION: la versión está %; solo se estandariza un preliminar enviado', v.status;
  end if;
  v_obs := public.style_observations(v.content, (app_private.version_type(v)).id);
  for v_item in select jsonb_object_keys(v_labels) loop
    if coalesce((p_checklist ->> v_item)::boolean, true) is false then
      v_obs := v_obs || jsonb_build_object('section', 'lista', 'rule', v_item,
        'message', format('Lista de chequeo: «%s» no cumple.', v_labels ->> v_item));
    end if;
  end loop;
  v_result := case when jsonb_array_length(v_obs) = 0 then 'cumple' else 'no_cumple' end;

  insert into public.standardization_checks (version_id, checklist, observations, result, checked_by)
  values (p_version, jsonb_build_object(
            'secciones_minimas', not exists (select 1 from jsonb_array_elements(v_obs) o where o ->> 'rule' = 'seccion_minima'),
            'infinitivo', not exists (select 1 from jsonb_array_elements(v_obs) o where o ->> 'rule' = 'infinitivo'),
            'sin_terminos_subjetivos', not exists (select 1 from jsonb_array_elements(v_obs) o where o ->> 'rule' = 'termino_subjetivo'),
            'encabezado', coalesce((p_checklist ->> 'encabezado')::boolean, true),
            'unidades_si', coalesce((p_checklist ->> 'unidades_si')::boolean, true),
            'na', coalesce((p_checklist ->> 'na')::boolean, true)),
          v_obs, v_result, auth.uid())
  returning * into v_check;

  update public.document_versions
  set style_check_result = jsonb_build_object('result', v_result, 'observations', v_obs, 'check_id', v_check.id),
      status = case when v_result = 'cumple' then status else 'preliminar' end
  where id = p_version;

  if v_result = 'no_cumple' then
    -- Se devuelve al solicitante con las observaciones (queda registrado; no se revierte).
    return jsonb_build_object('ok', false, 'code', 'STYLE_CHECK_FAILED', 'observations', v_obs, 'check_id', v_check.id);
  end if;
  return jsonb_build_object('ok', true, 'observations', '[]'::jsonb, 'check_id', v_check.id);
end;
$$;

-- Solo aq_doc: genera el código (PPP-TT-NNN o PPP-TT-NNN-LL-##), la versión y el listado maestro.
create or replace function public.request_document_code(
  p_version uuid,
  p_title text default null,
  p_route_id uuid default null,
  p_regulatory_expiry date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.document_versions;
  v_req public.document_requests;
  v_type public.document_types;
  v_area public.organizational_areas;
  v_parent public.controlled_documents;
  v_prefix text;
  v_n int;
  v_code text;
  v_doc public.controlled_documents;
  v_last public.standardization_checks;
  v_title text;
begin
  perform app_private.require_aq_doc();
  v := app_private.lock_version(p_version);
  if v.status <> 'en_estandarizacion' then
    raise exception 'INVALID_TRANSITION: la versión está %; el código se asigna a un preliminar estandarizado', v.status;
  end if;
  select * into v_last from public.standardization_checks where version_id = p_version order by checked_at desc, id desc limit 1;
  if not found or v_last.result <> 'cumple' then
    raise exception 'NOT_STANDARDIZED: el preliminar no ha pasado la estandarización (lista de chequeo y revisor de redacción)';
  end if;

  if v.document_id is null then
    select * into v_req from public.document_requests where id = v.request_id;
    select * into v_type from public.document_types where id = v_req.type_id;
    select * into v_area from public.organizational_areas where id = v_req.process_id;
    v_title := trim(coalesce(nullif(trim(p_title), ''), v_req.proposed_title, ''));
    if v_title = '' or lower(v_title) not like lower(v_type.name) || '%' then
      raise exception 'INVALID_FIELD: el título debe iniciar con el nombre del tipo («%…»)', v_type.name;
    end if;

    if v_req.parent_document_id is not null then
      select * into v_parent from public.controlled_documents where id = v_req.parent_document_id;
      v_prefix := v_parent.code || '-' || v_type.type_code || '-';
      perform pg_advisory_xact_lock(hashtext('doc_code:' || v_prefix));
      select coalesce(max(sub_number), 0) + 1 into v_n from public.controlled_documents
      where parent_code = v_parent.code and sub_type = v_type.type_code;
      if v_n > 99 then
        raise exception 'INVALID_TRANSITION: se agotaron los consecutivos de % (máximo 99)', v_prefix;
      end if;
      v_code := v_prefix || lpad(v_n::text, 2, '0');
    else
      v_prefix := v_area.process_code || '-' || v_type.type_code || '-';
      perform pg_advisory_xact_lock(hashtext('doc_code:' || v_prefix));
      select coalesce(max(substring(code from length(v_prefix) + 1 for 3)::int), 0) + 1 into v_n
      from public.controlled_documents where code ~ ('^' || v_prefix || '[0-9]{3}$');
      if v_n > 999 then
        raise exception 'INVALID_TRANSITION: se agotaron los consecutivos de % (máximo 999)', v_prefix;
      end if;
      v_code := v_prefix || lpad(v_n::text, 3, '0');
    end if;

    perform set_config('app.audit_reason', 'Asignación de código ' || v_code, true);
    insert into public.controlled_documents (code, origin, title, type_id, process_id, parent_document_id, parent_code,
      sub_type, sub_number, status, regulatory_expiry_date, route_id, default_distribution)
    values (v_code, 'interno', v_title, v_type.id, v_area.id, v_parent.id, v_parent.code,
      case when v_parent.id is not null then v_type.type_code end, case when v_parent.id is not null then v_n end,
      'en_elaboracion', p_regulatory_expiry,
      coalesce(p_route_id, v_type.default_route_id,
               (select id from public.approval_routes where code = case when v_area.process_code in ('ADM', 'TH') then 'administrativa' else 'tecnica' end)),
      v_req.requested_distribution)
    returning * into v_doc;
    update public.document_versions set document_id = v_doc.id, status = 'codificado' where id = p_version;
  else
    select * into v_doc from public.controlled_documents where id = v.document_id;
    perform set_config('app.audit_reason', 'Estandarizada la versión ' || lpad(v.version_no::text, 2, '0') || ' de ' || v_doc.code, true);
    if p_regulatory_expiry is not null then
      update public.controlled_documents set regulatory_expiry_date = p_regulatory_expiry where id = v_doc.id;
    end if;
    if p_route_id is not null then
      update public.controlled_documents set route_id = p_route_id where id = v_doc.id;
    end if;
    update public.document_versions set status = 'codificado' where id = p_version;
  end if;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('document_id', v_doc.id, 'code', v_doc.code, 'version_no', v.version_no);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Revisión, aprobación y publicación (RF-95, RF-96, RF-100; AC-23, AC-29, AC-30)
-- ---------------------------------------------------------------------------
create or replace function public.submit_for_review(p_version uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v public.document_versions := app_private.lock_version(p_version);
  v_res jsonb;
begin
  if v.status <> 'codificado' then
    raise exception 'INVALID_TRANSITION: la versión está %; se envía a revisión después de codificada', v.status;
  end if;
  if v.author_id <> v_uid and not public.has_role('aq_doc') then
    raise exception 'FORBIDDEN_ROLE: envía a revisión el autor o la analista de gestión documental';
  end if;
  update public.document_versions set content_hash = public.record_hash(content) where id = p_version;
  v_res := app_private.sign_document_version(p_version, 'actualizo', p_password, null,
    case when v.author_id = v_uid then (public.user_active_roles(v_uid))[1] else 'aq_doc' end);
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  update public.document_versions set status = 'en_revision' where id = p_version;
  return v_res;
end;
$$;

create or replace function public.review_document(p_version uuid, p_password text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v public.document_versions := app_private.lock_version(p_version);
  v_doc public.controlled_documents;
  v_step public.approval_route_steps;
  v_as text;
  v_res jsonb;
begin
  if v.status <> 'en_revision' then
    raise exception 'INVALID_TRANSITION: la versión está %; no está en revisión', v.status;
  end if;
  select * into v_doc from public.controlled_documents where id = v.document_id;
  select * into v_step from public.approval_route_steps where route_id = v_doc.route_id and step = 'revision';
  select r into v_as from unnest(v_step.roles) r where public.has_role(r) limit 1;
  if v_as is null and v_step.includes_author_head and exists (
    select 1 from public.profiles p join public.organizational_areas a on a.id = p.area_id
    where p.id = v.author_id and a.head_user_id = v_uid) then
    v_as := (public.user_active_roles(v_uid))[1];
  end if;
  if v_as is null then
    raise exception 'FORBIDDEN_ROLE: revisa el jefe inmediato del autor o Aseguramiento de la calidad';
  end if;
  perform public.check_sod(v_uid, 'document_versions', p_version, 'reviso', to_jsonb(v));
  v_res := app_private.sign_document_version(p_version, 'reviso', p_password, p_reason, v_as);
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  update public.document_versions set status = 'en_aprobacion' where id = p_version;
  return v_res;
end;
$$;

create or replace function public.approve_document(p_version uuid, p_password text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v public.document_versions := app_private.lock_version(p_version);
  v_doc public.controlled_documents;
  v_route public.approval_routes;
  v_step public.approval_route_steps;
  v_as text;
  v_res jsonb;
begin
  if v.status <> 'en_aprobacion' or v.locked_at is not null then
    raise exception 'INVALID_TRANSITION: la versión % no está pendiente de aprobación', app_private.version_label(v);
  end if;
  if not exists (select 1 from public.signatures where record_table = 'document_versions' and record_id = p_version and meaning = 'reviso') then
    raise exception 'ROUTE_INCOMPLETE: falta la firma de revisión';
  end if;
  select * into v_doc from public.controlled_documents where id = v.document_id;
  select * into v_route from public.approval_routes where id = v_doc.route_id;
  select * into v_step from public.approval_route_steps where route_id = v_route.id and step = 'aprobacion';
  select r into v_as from unnest(v_step.roles) r where public.has_role(r) limit 1;
  if v_as is null then
    raise exception 'FORBIDDEN_ROLE: aprueba % (%)', array_to_string(v_step.roles, ' o '), v_route.name;
  end if;
  perform public.check_sod(v_uid, 'document_versions', p_version, 'aprobo', to_jsonb(v));
  if not v_route.allow_reviewer_as_approver and exists (
    select 1 from public.signatures where record_table = 'document_versions' and record_id = p_version
      and meaning = 'reviso' and user_id = v_uid) then
    raise exception 'SOD_VIOLATION: en esta ruta quien revisa no aprueba';
  end if;
  v_res := app_private.sign_document_version(p_version, 'aprobo', p_password, p_reason, v_as);
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  -- SOD-10: la versión aprobada queda bloqueada, y también su plantilla de proceso.
  update public.document_versions set locked_at = now() where id = p_version;
  update public.process_templates set locked_at = now(), status = 'aprobada' where document_version_id = p_version;
  return v_res;
end;
$$;

create or replace function public.publish_document(p_version uuid, p_distribution uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v public.document_versions;
  v_doc public.controlled_documents;
  v_prev public.document_versions;
  v_cr public.document_change_requests;
  v_pending text;
  v_issue date := public.bogota_today();
  v_due date;
  v_areas uuid[];
  v_area uuid;
  v_copies int := 0;
begin
  perform app_private.require_aq_doc();
  v := app_private.lock_version(p_version);
  if v.status <> 'en_aprobacion' or not exists (
    select 1 from public.signatures where record_table = 'document_versions' and record_id = p_version and meaning = 'aprobo') then
    raise exception 'ROUTE_INCOMPLETE: la versión % no tiene la aprobación', app_private.version_label(v);
  end if;
  select * into v_doc from public.controlled_documents where id = v.document_id for update;

  -- RF-100: un cambio técnico en un formato exige revisar su procedimiento padre.
  if v.technical_change and (v_doc.parent_document_id is not null or v_doc.parent_code is not null) then
    select * into v_cr from public.document_change_requests where id = v.change_request_id;
    if not found or coalesce(v_cr.parent_review, 'pendiente') = 'pendiente' then
      raise exception 'PARENT_DOCUMENT_REVIEW_REQUIRED: este cambio técnico exige revisar el procedimiento % antes de publicar',
        coalesce(v_doc.parent_code, '(padre)');
    end if;
  end if;

  -- RF-96: no se publica sin recoger las copias de la versión anterior.
  select * into v_prev from public.document_versions where id = v_doc.current_version_id for update;
  if v_prev.id is not null then
    select string_agg(coalesce(a.name, dd.recipient), ', ') into v_pending
    from public.document_distribution dd left join public.organizational_areas a on a.id = dd.area_id
    where dd.version_id = v_prev.id and dd.recalled_at is null;
    if v_pending is not null then
      raise exception 'RECALL_PENDING: recoja antes las copias de la versión % en: %', lpad(v_prev.version_no::text, 2, '0'), v_pending;
    end if;
  end if;

  v_due := public.compute_review_due_date(v_doc.type_id, v_issue, v_doc.regulatory_expiry_date);
  perform set_config('app.audit_reason', 'Publicación de ' || v_doc.code || ' v' || lpad(v.version_no::text, 2, '0'), true);
  perform set_config('app.signing_record', 'document_versions:' || p_version, true);
  update public.document_versions
  set status = 'vigente', issue_date = v_issue, review_due_date = v_due, effective_at = now()
  where id = p_version;
  if v_prev.id is not null then
    perform set_config('app.signing_record', 'document_versions:' || v_prev.id, true);
    update public.document_versions set status = 'obsoleto', obsoleted_at = now() where id = v_prev.id;
  end if;
  perform set_config('app.signing_record', '', true);

  update public.controlled_documents
  set status = 'vigente', current_version_id = p_version, next_review_date = v_due
  where id = v_doc.id;

  v_areas := coalesce(p_distribution, nullif(v_doc.default_distribution, '{}'),
                      (select requested_distribution from public.document_requests where id = v.request_id), '{}');
  foreach v_area in array v_areas loop
    insert into public.document_distribution (version_id, area_id, copy_type, delivered_by)
    values (p_version, v_area, 'controlada', v_uid);
    v_copies := v_copies + 1;
  end loop;
  if p_distribution is not null then
    update public.controlled_documents set default_distribution = p_distribution where id = v_doc.id;
  end if;

  update public.document_change_requests
  set status = 'cerrada', closed_with_version_id = p_version, closed_at = now()
  where id = v.change_request_id;
  update public.document_requests set status = 'cerrada' where id = v.request_id;
  perform set_config('app.audit_reason', '', true);

  return jsonb_build_object('code', v_doc.code, 'issue_date', v_issue, 'review_due_date', v_due, 'copies', v_copies);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Copias y control de documentos (RF-96, RF-103)
-- ---------------------------------------------------------------------------
create or replace function public.issue_copy(p_version uuid, p_area_id uuid, p_recipient text, p_copy_type text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.document_versions;
  v_id uuid;
begin
  perform app_private.require_aq_doc();
  select * into v from public.document_versions where id = p_version;
  if not found or v.status <> 'vigente' then
    raise exception 'INVALID_TRANSITION: solo se entregan copias de una versión vigente';
  end if;
  if p_copy_type not in ('controlada', 'no_controlada') or (p_area_id is null and nullif(trim(p_recipient), '') is null) then
    raise exception 'INVALID_FIELD: indique el tipo de copia y el proceso o el destinatario';
  end if;
  insert into public.document_distribution (version_id, area_id, recipient, copy_type, delivered_by)
  values (p_version, p_area_id, nullif(trim(p_recipient), ''), p_copy_type, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.recall_copy(p_distribution uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dd public.document_distribution;
  v_doc uuid;
begin
  perform app_private.require_aq_doc();
  select * into v_dd from public.document_distribution where id = p_distribution for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la copia';
  end if;
  if v_dd.recalled_at is not null then
    raise exception 'INVALID_TRANSITION: la copia ya fue recogida';
  end if;
  update public.document_distribution set recalled_at = now(), recalled_by = auth.uid(), recall_note = nullif(trim(p_note), '')
  where id = p_distribution;
  select document_id into v_doc from public.document_versions where id = v_dd.version_id;
  update public.document_annulments a set recall_status = 'completa'
  where a.document_id = v_doc and a.status = 'aprobada' and a.recall_status = 'pendiente'
    and not exists (
      select 1 from public.document_distribution dd join public.document_versions dv on dv.id = dd.version_id
      where dv.document_id = v_doc and dd.recalled_at is null);
end;
$$;

-- Marca de la descarga (RF-103): «Copia controlada», «Copia no controlada» u «OBSOLETO», con usuario y fecha.
create or replace function public.log_document_download(p_version uuid, p_copy_type text default 'controlada')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.document_versions;
  v_doc public.controlled_documents;
  v_copy text;
  v_row public.document_downloads;
begin
  if not public.can_read_documents() then
    raise exception 'FORBIDDEN_ROLE: su rol no tiene acceso a los documentos controlados';
  end if;
  select * into v from public.document_versions where id = p_version;
  if not found or v.document_id is null then
    raise exception 'RECORD_NOT_FOUND: no existe la versión del documento';
  end if;
  select * into v_doc from public.controlled_documents where id = v.document_id;
  if v.status = 'obsoleto' or v_doc.status = 'anulado' then
    v_copy := 'obsoleto';
  elsif v.status <> 'vigente' or p_copy_type = 'no_controlada' then
    v_copy := 'no_controlada';
  else
    v_copy := 'controlada';
  end if;
  insert into public.document_downloads (version_id, user_id, copy_type) values (p_version, auth.uid(), v_copy)
  returning * into v_row;
  return jsonb_build_object('copy_type', v_copy, 'downloaded_at', v_row.downloaded_at,
    'user_name', (select full_name from public.profiles where id = auth.uid()));
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Control de cambios y revisión del procedimiento padre (RF-100)
-- ---------------------------------------------------------------------------
create or replace function public.register_change_request(
  p_document_id uuid,
  p_origin text,
  p_origin_ref text,
  p_reason text,
  p_impact text,
  p_technical_change boolean,
  p_author_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_doc public.controlled_documents;
  v_cur public.document_versions;
  v_cr public.document_change_requests;
  v_ver public.document_versions;
  v_author uuid := coalesce(p_author_id, auth.uid());
begin
  perform app_private.require_document_author();
  perform app_private.require_reason(p_reason);
  if p_author_id is not null and p_author_id <> v_uid and not public.has_any_role(array['aq_doc', 'aq_dir']) then
    raise exception 'FORBIDDEN_ROLE: solo Aseguramiento de la calidad asigna el autor de un cambio';
  end if;
  select * into v_doc from public.controlled_documents where id = p_document_id for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el documento';
  end if;
  if v_doc.status <> 'vigente' then
    raise exception 'INVALID_TRANSITION: el documento % no está vigente', v_doc.code;
  end if;
  if exists (select 1 from public.document_versions where document_id = v_doc.id and status not in ('vigente', 'obsoleto')) then
    raise exception 'INVALID_TRANSITION: el documento % ya tiene una versión en curso', v_doc.code;
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);
  insert into public.document_change_requests (code, document_id, origin, origin_ref, reason, impact,
    technical_change, status, parent_review, requested_by)
  values (public.next_number('document_change_request'), v_doc.id, p_origin, nullif(trim(p_origin_ref), ''),
    trim(p_reason), coalesce(trim(p_impact), ''), coalesce(p_technical_change, false), 'abierta',
    case when coalesce(p_technical_change, false) and (v_doc.parent_document_id is not null or v_doc.parent_code is not null)
         then 'pendiente' end, v_uid)
  returning * into v_cr;

  select * into v_cur from public.document_versions where id = v_doc.current_version_id;
  insert into public.document_versions (document_id, change_request_id, version_no, status, author_id, content,
    change_description, technical_change, supersedes_id)
  values (v_doc.id, v_cr.id, (select max(version_no) + 1 from public.document_versions where document_id = v_doc.id),
    'solicitado', v_author, v_cur.content, trim(p_reason), coalesce(p_technical_change, false), v_cur.id)
  returning * into v_ver;
  perform set_config('app.audit_reason', '', true);

  return jsonb_build_object('change_request_id', v_cr.id, 'code', v_cr.code, 'version_id', v_ver.id,
                            'parent_review', v_cr.parent_review);
end;
$$;

create or replace function public.set_parent_review(p_change_request uuid, p_decision text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cr public.document_change_requests;
begin
  if not public.has_any_role(array['aq_dir', 'aq_doc']) then
    raise exception 'FORBIDDEN_ROLE: la revisión del procedimiento padre la registra Aseguramiento de la calidad';
  end if;
  perform app_private.require_reason(p_note);
  select * into v_cr from public.document_change_requests where id = p_change_request for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la solicitud de cambio';
  end if;
  if v_cr.parent_review is distinct from 'pendiente' then
    raise exception 'INVALID_TRANSITION: la solicitud % no tiene revisión del procedimiento padre pendiente', v_cr.code;
  end if;
  if p_decision not in ('sin_cambio', 'nueva_version') then
    raise exception 'INVALID_FIELD: la revisión del padre es «sin_cambio» o «nueva_version»';
  end if;
  perform set_config('app.audit_reason', trim(p_note), true);
  update public.document_change_requests
  set parent_review = p_decision, parent_review_by = auth.uid(), parent_review_at = now(), parent_review_note = trim(p_note)
  where id = p_change_request;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Anulación (RF-99; AC-32)
-- ---------------------------------------------------------------------------
create or replace function public.decide_annulment(p_annulment uuid, p_decision text, p_reason text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ann public.document_annulments;
  v_auth jsonb;
  v_open int;
begin
  if not public.has_role('aq_dir') then
    raise exception 'FORBIDDEN_ROLE: la viabilidad de una anulación la decide la dirección de Aseguramiento de la calidad';
  end if;
  perform app_private.require_reason(p_reason);
  if p_decision not in ('aprobada', 'rechazada') then
    raise exception 'INVALID_FIELD: la decisión es «aprobada» o «rechazada»';
  end if;
  select * into v_ann from public.document_annulments where id = p_annulment for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la anulación';
  end if;
  if v_ann.status <> 'solicitada' then
    raise exception 'INVALID_TRANSITION: la anulación % ya está %', v_ann.code, v_ann.status;
  end if;
  if v_ann.requested_by = v_uid then
    raise exception 'SOD_VIOLATION: usted solicitó esta anulación; la decide otra persona';
  end if;
  v_auth := app_private.verify_reauth(v_uid, p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  select count(*) into v_open from public.document_distribution dd
  join public.document_versions dv on dv.id = dd.version_id
  where dv.document_id = v_ann.document_id and dd.recalled_at is null;

  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.document_annulments
  set status = p_decision, decision = p_decision, decided_by = v_uid, decided_at = now(), decision_reason = trim(p_reason),
      recall_status = case when p_decision = 'aprobada' then case when v_open > 0 then 'pendiente' else 'completa' end else 'no_aplica' end
  where id = p_annulment;
  if p_decision = 'rechazada' then
    update public.document_requests set status = 'rechazada' where id = v_ann.request_id;
  end if;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('ok', true, 'status', p_decision, 'copies_to_recall', v_open);
end;
$$;

create or replace function public.close_annulment(p_annulment uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ann public.document_annulments;
  v_doc public.controlled_documents;
  v_pending text;
begin
  if not public.has_any_role(array['aq_doc', 'aq_dir']) then
    raise exception 'FORBIDDEN_ROLE: la anulación la cierra Aseguramiento de la calidad';
  end if;
  perform app_private.require_reason(p_reason);
  select * into v_ann from public.document_annulments where id = p_annulment for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la anulación';
  end if;
  if v_ann.status <> 'aprobada' then
    raise exception 'INVALID_TRANSITION: la anulación % está %; se cierra una vez aprobada', v_ann.code, v_ann.status;
  end if;
  select string_agg(coalesce(a.name, dd.recipient), ', ') into v_pending
  from public.document_distribution dd
  join public.document_versions dv on dv.id = dd.version_id
  left join public.organizational_areas a on a.id = dd.area_id
  where dv.document_id = v_ann.document_id and dd.recalled_at is null;
  if v_pending is not null then
    raise exception 'RECALL_PENDING: no se puede cerrar la anulación: falta recoger la copia de %', v_pending;
  end if;

  select * into v_doc from public.controlled_documents where id = v_ann.document_id for update;
  perform set_config('app.audit_reason', trim(p_reason), true);
  if v_doc.current_version_id is not null then
    perform set_config('app.signing_record', 'document_versions:' || v_doc.current_version_id, true);
    update public.document_versions set status = 'obsoleto', obsoleted_at = now() where id = v_doc.current_version_id;
    perform set_config('app.signing_record', '', true);
  end if;
  update public.controlled_documents set status = 'anulado', annulled_at = now() where id = v_doc.id;
  update public.document_annulments set status = 'cerrada', recall_status = 'completa', closed_at = now(), closed_by = auth.uid()
  where id = p_annulment;
  update public.document_requests set status = 'cerrada' where id = v_ann.request_id;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Capacitación (RF-97; AC-25, AC-31)
-- ---------------------------------------------------------------------------
-- p_questions: [{"q": "…", "options": ["…", "…"], "answer": 0}, …]; vacío = confirmación de lectura.
create or replace function public.assign_training(
  p_version uuid,
  p_users uuid[],
  p_due_date date,
  p_questions jsonb default '[]',
  p_pass_score numeric default null,
  p_method text default 'plataforma'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.document_versions;
  v_training public.document_trainings;
  v_q jsonb;
  v_public jsonb := '[]';
  v_answers int[] := '{}';
  v_user uuid;
begin
  if not public.has_role('aq_doc') then
    raise exception 'FORBIDDEN_ROLE: la capacitación la asigna la analista de gestión documental';
  end if;
  select * into v from public.document_versions where id = p_version;
  if not found or v.status <> 'vigente' then
    raise exception 'INVALID_TRANSITION: solo se divulga una versión vigente';
  end if;
  if coalesce(cardinality(p_users), 0) = 0 then
    raise exception 'INVALID_FIELD: asigne al menos una persona';
  end if;
  for v_q in select * from jsonb_array_elements(coalesce(p_questions, '[]')) loop
    if coalesce(length(trim(v_q ->> 'q')), 0) = 0 or jsonb_typeof(v_q -> 'options') <> 'array'
       or jsonb_array_length(v_q -> 'options') < 2 or (v_q ->> 'answer')::int not between 0 and jsonb_array_length(v_q -> 'options') - 1 then
      raise exception 'INVALID_FIELD: cada pregunta necesita texto, al menos dos opciones y la respuesta correcta';
    end if;
    v_public := v_public || jsonb_build_object('q', trim(v_q ->> 'q'), 'options', v_q -> 'options');
    v_answers := v_answers || (v_q ->> 'answer')::int;
  end loop;

  insert into public.document_trainings (version_id, trainer_id, method, pass_score, due_date, requires_assessment, questions)
  values (p_version, auth.uid(), coalesce(p_method, 'plataforma'),
    coalesce(p_pass_score, (public.get_setting('training_pass_score') #>> '{}')::numeric, 80), p_due_date,
    jsonb_array_length(v_public) > 0, v_public)
  returning * into v_training;
  insert into app_private.training_answer_keys (training_id, answers) values (v_training.id, v_answers);
  foreach v_user in array p_users loop
    insert into public.training_assignments (training_id, user_id) values (v_training.id, v_user)
    on conflict do nothing;
  end loop;
  return v_training.id;
end;
$$;

create or replace function public.register_training_attempt(p_training uuid, p_answers int[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_t public.document_trainings;
  v_key int[];
  v_total int;
  v_ok int := 0;
  v_i int;
  v_score numeric(5, 2);
  v_passed boolean;
  v_cert text;
  v_no int;
begin
  select * into v_t from public.document_trainings where id = p_training;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la capacitación';
  end if;
  if not exists (select 1 from public.training_assignments where training_id = p_training and user_id = v_uid) then
    raise exception 'FORBIDDEN_ROLE: esta capacitación no está asignada a usted';
  end if;
  if not exists (select 1 from public.document_versions where id = v_t.version_id and status = 'vigente') then
    raise exception 'INVALID_TRANSITION: la versión ya no está vigente';
  end if;
  if exists (select 1 from public.training_attempts where training_id = p_training and user_id = v_uid and passed) then
    raise exception 'INVALID_TRANSITION: usted ya aprobó esta capacitación';
  end if;
  if not v_t.requires_assessment then
    raise exception 'INVALID_TRANSITION: esta capacitación se cumple con la confirmación de lectura';
  end if;
  select answers into v_key from app_private.training_answer_keys where training_id = p_training;
  v_total := cardinality(v_key);
  if coalesce(cardinality(p_answers), 0) <> v_total then
    raise exception 'INVALID_FIELD: responda las % preguntas', v_total;
  end if;
  for v_i in 1 .. v_total loop
    if p_answers[v_i] = v_key[v_i] then
      v_ok := v_ok + 1;
    end if;
  end loop;
  v_score := round(100.0 * v_ok / v_total, 2);
  v_passed := v_score >= v_t.pass_score;
  if v_passed then
    v_cert := public.next_number('training_certificate');
  end if;
  select coalesce(max(attempt_no), 0) + 1 into v_no from public.training_attempts where training_id = p_training and user_id = v_uid;
  insert into public.training_attempts (training_id, user_id, attempt_no, kind, answers, score, passed, certificate_code)
  values (p_training, v_uid, v_no, 'cuestionario', to_jsonb(p_answers), v_score, v_passed, v_cert);

  if not v_passed then
    return jsonb_build_object('ok', false, 'code', 'TRAINING_NOT_PASSED', 'score', v_score, 'pass_score', v_t.pass_score,
                              'attempt_no', v_no);
  end if;
  return jsonb_build_object('ok', true, 'score', v_score, 'pass_score', v_t.pass_score, 'certificate_code', v_cert,
                            'attempt_no', v_no);
end;
$$;

create or replace function public.acknowledge_read(p_training uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_t public.document_trainings;
  v_cert text;
begin
  select * into v_t from public.document_trainings where id = p_training;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la capacitación';
  end if;
  if not exists (select 1 from public.training_assignments where training_id = p_training and user_id = v_uid) then
    raise exception 'FORBIDDEN_ROLE: esta capacitación no está asignada a usted';
  end if;
  if v_t.requires_assessment then
    raise exception 'INVALID_TRANSITION: esta capacitación exige presentar el cuestionario';
  end if;
  if exists (select 1 from public.training_attempts where training_id = p_training and user_id = v_uid and passed) then
    raise exception 'INVALID_TRANSITION: usted ya confirmó la lectura';
  end if;
  v_cert := public.next_number('training_certificate');
  insert into public.training_attempts (training_id, user_id, attempt_no, kind, passed, certificate_code)
  values (p_training, v_uid, 1, 'lectura', true, v_cert);
  return jsonb_build_object('ok', true, 'certificate_code', v_cert);
end;
$$;

-- Regla de capacitación antes de ejecutar (AC-25, D-19). La usarán las RPC de ejecución (E6).
create or replace function public.assert_training(p_version uuid, p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v public.document_versions;
  v_type public.document_types;
  v_mode text := coalesce(public.get_setting('training_enforcement') #>> '{}', 'bloquear');
begin
  select * into v from public.document_versions where id = p_version;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la versión del documento';
  end if;
  v_type := app_private.version_type(v);
  if not v_type.requires_training or exists (
    select 1 from public.training_attempts ta join public.document_trainings dt on dt.id = ta.training_id
    where dt.version_id = p_version and ta.user_id = v_user and ta.passed) then
    return jsonb_build_object('ok', true);
  end if;
  if v_mode = 'bloquear' then
    raise exception 'TRAINING_REQUIRED: debe aprobar la capacitación de % antes de ejecutar este paso', app_private.version_label(v);
  end if;
  return jsonb_build_object('ok', true, 'warning', format('Capacitación de %s pendiente', app_private.version_label(v)));
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Congelación de versión (AC-19, RF-101): una OP o lote solo usa versiones vigentes
-- ---------------------------------------------------------------------------
create or replace function public.assert_document_effective(p_version_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v public.document_versions;
  v_doc public.controlled_documents;
  v_warnings jsonb := '[]';
  v_label text;
begin
  foreach v_id in array coalesce(p_version_ids, '{}') loop
    select * into v from public.document_versions where id = v_id;
    if not found then
      raise exception 'DOCUMENT_NOT_EFFECTIVE: la versión % no existe', v_id;
    end if;
    select * into v_doc from public.controlled_documents where id = v.document_id;
    v_label := app_private.version_label(v);
    if v.status <> 'vigente' or v_doc.status <> 'vigente' then
      raise exception 'DOCUMENT_NOT_EFFECTIVE: % no está vigente (%)', v_label, v.status;
    end if;
    if v_doc.next_review_date is not null and v_doc.next_review_date < public.bogota_today() then
      if coalesce((public.get_setting('overdue_review_blocks_orders'))::boolean, false) then
        raise exception 'DOCUMENT_NOT_EFFECTIVE: % tiene la revisión vencida desde %', v_label, to_char(v_doc.next_review_date, 'DD/MM/YYYY');
      end if;
      v_warnings := v_warnings || jsonb_build_object('code', v_doc.code,
        'message', format('%s tiene la revisión vencida desde %s', v_label, to_char(v_doc.next_review_date, 'DD/MM/YYYY')));
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'warnings', v_warnings);
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Edición maestra de plantillas de proceso (RF-05; AC-20, AC-23)
-- ---------------------------------------------------------------------------
-- p_steps: [{"label": "5B", "text": "…", "params": [{"name": "Temperatura", "unit": "°C", "min": 70, "max": 75, "frequency": "cada 10 min"}],
--            "requires_equipment": "TQ-101", "requires_verification": true, "checklist_item": false}, …]
create or replace function public.save_template_draft(p_stage_code text, p_version uuid, p_steps jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_stage public.stage_definitions;
  v_doc public.controlled_documents;
  v public.document_versions;
  v_cur public.document_versions;
  v_tpl public.process_templates;
  v_step jsonb;
  v_i int := 0;
begin
  if not public.has_module_permission('plantillas_de_proceso', 'create') then
    raise exception 'FORBIDDEN_ROLE: crea versiones de plantillas el usuario master (o el autor asignado)';
  end if;
  perform app_private.require_reason(p_reason);
  select * into v_stage from public.stage_definitions where code = p_stage_code and active;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la etapa %', p_stage_code;
  end if;
  select * into v_doc from public.controlled_documents where id = v_stage.governing_document_id;
  if not found then
    raise exception 'INVALID_TRANSITION: la etapa % no tiene documento controlado; solicítelo a Aseguramiento de la calidad', v_stage.name;
  end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) = 0 then
    raise exception 'INVALID_FIELD: la plantilla necesita al menos un paso';
  end if;

  if p_version is not null then
    v := app_private.lock_version(p_version);
    if v.document_id is distinct from v_doc.id then
      raise exception 'INVALID_FIELD: la versión no es de la plantilla de %', v_stage.name;
    end if;
  else
    select * into v from public.document_versions
    where document_id = v_doc.id and status not in ('vigente', 'obsoleto') for update;
  end if;

  if v.id is not null and (v.status not in ('solicitado', 'preliminar') or v.locked_at is not null) then
    raise exception 'RECORD_LOCKED: la versión % está % y no se edita; cree una versión nueva en borrador',
      app_private.version_label(v), replace(v.status, '_', ' ');
  end if;
  if v.id is not null and v.author_id <> v_uid then
    raise exception 'INVALID_TRANSITION: la versión % en curso es de otro autor', app_private.version_label(v);
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);
  if v.id is null then
    select * into v_cur from public.document_versions where id = v_doc.current_version_id;
    insert into public.document_versions (document_id, version_no, status, author_id, content, change_description, supersedes_id)
    values (v_doc.id, (select max(version_no) + 1 from public.document_versions where document_id = v_doc.id), 'preliminar',
            v_uid, coalesce(v_cur.content, app_private.document_template(v_doc.type_id)), trim(p_reason), v_cur.id)
    returning * into v;
  else
    update public.document_versions set status = 'preliminar', change_description = trim(p_reason) where id = v.id;
  end if;

  select * into v_tpl from public.process_templates where document_version_id = v.id;
  if not found then
    insert into public.process_templates (stage_id, document_version_id) values (v_stage.id, v.id) returning * into v_tpl;
  end if;
  delete from public.process_template_steps where template_id = v_tpl.id;
  for v_step in select * from jsonb_array_elements(p_steps) loop
    v_i := v_i + 1;
    insert into public.process_template_steps (template_id, order_no, label, text, params, requires_equipment,
      requires_verification, checklist_item)
    values (v_tpl.id, v_i, coalesce(nullif(trim(v_step ->> 'label'), ''), v_i::text), trim(v_step ->> 'text'),
      coalesce(v_step -> 'params', '[]'), nullif(trim(v_step ->> 'requires_equipment'), ''),
      coalesce((v_step ->> 'requires_verification')::boolean, false), coalesce((v_step ->> 'checklist_item')::boolean, false));
  end loop;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('version_id', v.id, 'version_no', v.version_no, 'steps', v_i);
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Permisos de ejecución
-- ---------------------------------------------------------------------------
revoke execute on function public.request_document(text, uuid, uuid, uuid, uuid, text, text, uuid[]) from public, anon;
revoke execute on function public.save_document_draft(uuid, jsonb, text, boolean) from public, anon;
revoke execute on function public.submit_for_standardization(uuid) from public, anon;
revoke execute on function public.run_style_check(uuid, jsonb) from public, anon;
revoke execute on function public.request_document_code(uuid, text, uuid, date) from public, anon;
revoke execute on function public.submit_for_review(uuid, text) from public, anon;
revoke execute on function public.review_document(uuid, text, text) from public, anon;
revoke execute on function public.approve_document(uuid, text, text) from public, anon;
revoke execute on function public.publish_document(uuid, uuid[]) from public, anon;
revoke execute on function public.issue_copy(uuid, uuid, text, text) from public, anon;
revoke execute on function public.recall_copy(uuid, text) from public, anon;
revoke execute on function public.log_document_download(uuid, text) from public, anon;
revoke execute on function public.register_change_request(uuid, text, text, text, text, boolean, uuid) from public, anon;
revoke execute on function public.set_parent_review(uuid, text, text) from public, anon;
revoke execute on function public.decide_annulment(uuid, text, text, text) from public, anon;
revoke execute on function public.close_annulment(uuid, text) from public, anon;
revoke execute on function public.assign_training(uuid, uuid[], date, jsonb, numeric, text) from public, anon;
revoke execute on function public.register_training_attempt(uuid, int[]) from public, anon;
revoke execute on function public.acknowledge_read(uuid) from public, anon;
revoke execute on function public.assert_training(uuid, uuid) from public, anon;
revoke execute on function public.assert_document_effective(uuid[]) from public, anon;
revoke execute on function public.save_template_draft(text, uuid, jsonb, text) from public, anon;

grant execute on function public.request_document(text, uuid, uuid, uuid, uuid, text, text, uuid[]) to authenticated;
grant execute on function public.save_document_draft(uuid, jsonb, text, boolean) to authenticated;
grant execute on function public.submit_for_standardization(uuid) to authenticated;
grant execute on function public.run_style_check(uuid, jsonb) to authenticated;
grant execute on function public.request_document_code(uuid, text, uuid, date) to authenticated;
grant execute on function public.submit_for_review(uuid, text) to authenticated;
grant execute on function public.review_document(uuid, text, text) to authenticated;
grant execute on function public.approve_document(uuid, text, text) to authenticated;
grant execute on function public.publish_document(uuid, uuid[]) to authenticated;
grant execute on function public.issue_copy(uuid, uuid, text, text) to authenticated;
grant execute on function public.recall_copy(uuid, text) to authenticated;
grant execute on function public.log_document_download(uuid, text) to authenticated;
grant execute on function public.register_change_request(uuid, text, text, text, text, boolean, uuid) to authenticated;
grant execute on function public.set_parent_review(uuid, text, text) to authenticated;
grant execute on function public.decide_annulment(uuid, text, text, text) to authenticated;
grant execute on function public.close_annulment(uuid, text) to authenticated;
grant execute on function public.assign_training(uuid, uuid[], date, jsonb, numeric, text) to authenticated;
grant execute on function public.register_training_attempt(uuid, int[]) to authenticated;
grant execute on function public.acknowledge_read(uuid) to authenticated;
grant execute on function public.assert_training(uuid, uuid) to authenticated;
grant execute on function public.assert_document_effective(uuid[]) to authenticated;
grant execute on function public.save_template_draft(text, uuid, jsonb, text) to authenticated;
