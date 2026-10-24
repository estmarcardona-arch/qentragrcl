-- 0018_briefs_prototypes_stability.sql · Etapa E4 (PRD F3)
-- Brief ampliado (RF-10), prototipos con consecutivo de mejora (RF-15) y estudio de estabilidad
-- preliminar con cronograma, lecturas y cierre firmado (RF-16). Aprobación del prototipo como
-- fórmula por Gerencia y Dirección técnica (+ cliente si es maquila), solo con estabilidad conforme
-- y al menos 2 prototipos del brief (AC-13). Criterios de cumplimiento por producto (D-13).

insert into public.numbering_sequences (key, format, description) values
  ('brief', 'BR-{YYYY}-{NNNN}', 'Briefs de producto (RF-10). Formato del Prompt 0B.'),
  ('prototype', 'P-{NNNN}', 'Prototipos de fórmula (RF-15): P-0007; las mejoras agregan -1, -2…');

insert into public.app_settings (key, value, description) values
  ('stability_protocol_code', '"CC-PC-001"',
   'Código del protocolo de estabilidad preliminar (documento controlado vigente) que rige cada estudio (RF-16).');

-- Firma genérica de un registro con reautenticación (huella sin columnas de ciclo de vida).
create or replace function app_private.sign_simple(
  p_table text, p_id uuid, p_meaning public.signature_meaning, p_password text, p_reason text, p_signed_as text)
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
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', p_table) into v_row using p_id;
  select full_name into v_name from public.profiles where id = v_uid;
  select short_signature into v_short from public.signature_registry where user_id = v_uid;
  insert into public.signatures (user_id, record_table, record_id, meaning, signed_as, record_hash, short_signature,
    signer_name, reason, reauth_method, created_by, updated_by)
  values (v_uid, p_table, p_id, p_meaning, p_signed_as, public.record_hash(app_private.signable_row(p_table, v_row)),
    coalesce(v_short, v_name), v_name, nullif(trim(p_reason), ''), v_auth ->> 'method', v_uid, v_uid)
  returning * into v_sig;
  return jsonb_build_object('ok', true, 'signature_id', v_sig.id, 'signed_at', v_sig.signed_at,
                            'short_signature', v_sig.short_signature, 'signer_name', v_sig.signer_name);
end;
$$;

revoke execute on function app_private.sign_simple(text, uuid, public.signature_meaning, text, text, text)
  from public, anon, authenticated;

create or replace function app_private.first_role(p_roles text[])
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r from unnest(p_roles) r where public.has_role(r) limit 1;
$$;

revoke execute on function app_private.first_role(text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Brief (RF-10)
-- ---------------------------------------------------------------------------
create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  product_id uuid references public.products (id),
  execution_date date,
  project_name text not null default '',
  project_type text check (project_type in ('innovador', 'nuevo_portafolio', 'modificacion_renovacion', 'extension_linea', 'maquila_tercero')),
  product_category text check (product_category in ('cosmetico', 'medicamento')),
  justification text not null default '',
  sources_description text not null default '',
  sensorial jsonb not null default '{}',
  target jsonb not null default '{}',
  channels text[] not null default '{}' check (channels <@ array['cadenas', 'subtiendas', 'mercado_tradicional', 'otros']),
  channels_other text,
  margin_pct numeric(6, 2) check (margin_pct is null or margin_pct between 0 and 100),
  suggested_price_by_presentation jsonb not null default '[]',
  legal_requirements text not null default '',
  implementation_costs text not null default '',
  recommendations text not null default '',
  status text not null default 'borrador' check (status in ('borrador', 'enviado', 'aprobado', 'devuelto')),
  return_reason text,
  version int not null default 1,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.briefs is 'Brief de producto (PRD 6.3, RF-10): borrador → enviado → aprobado (o devuelto con motivo).';

create table public.brief_competitors (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs (id),
  order_no int not null,
  manufacturer text not null default '',
  product_name text not null default '',
  container text,
  cap_type text,
  label_type text,
  claims text,
  actives text,
  price numeric(14, 2) check (price is null or price >= 0),
  net_content_ml numeric(14, 4) check (net_content_ml is null or net_content_ml > 0),
  price_per_ml numeric(14, 4) generated always as (case when net_content_ml > 0 then round(price / net_content_ml, 4) end) stored,
  aroma text,
  color text,
  appearance text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (brief_id, order_no)
);

alter table public.briefs enable row level security;
alter table public.brief_competitors enable row level security;
select app_private.register_table('public.briefs', p_signable => true, p_no_delete => true);
select app_private.register_table('public.brief_competitors');
insert into public.signable_tables (table_name, label, kind, is_document, author_column)
values ('briefs', 'Brief de producto', 'brief', false, 'created_by');

-- ---------------------------------------------------------------------------
-- 2. Prototipos (RF-15) y su aprobación como fórmula
-- ---------------------------------------------------------------------------
create table public.formula_prototypes (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs (id),
  code text not null unique,
  parent_prototype_id uuid references public.formula_prototypes (id),
  iteration_no int not null default 0 check (iteration_no >= 0),
  product_type text not null default '',
  target_description text not null default '',
  benefit text not null default '',
  concept text not null default '',
  draft_instruction text not null default '',
  status text not null default 'borrador' check (status in ('borrador', 'en_estabilidad', 'reformular', 'seleccionado', 'aprobado', 'descartado')),
  status_reason text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.formula_prototypes is
  'Prototipos (RF-15): P-0007, mejoras P-0007-1. «descartado» es un estado agregado para el prototipo no elegido (Prompt 0B, P-0008).';

create table public.prototype_items (
  id uuid primary key default gen_random_uuid(),
  prototype_id uuid not null references public.formula_prototypes (id),
  material_id uuid not null references public.materials (id),
  pct numeric(9, 4) not null check (pct > 0 and pct <= 100),
  phase text,
  function text,
  order_no int not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (prototype_id, order_no)
);

create table public.prototype_approvals (
  id uuid primary key default gen_random_uuid(),
  prototype_id uuid not null references public.formula_prototypes (id),
  approver_role text not null check (approver_role in ('gerencia', 'dt', 'cliente')),
  approver uuid not null references public.profiles (id),
  approver_name text not null,
  client_reference text,
  reason text,
  reauth_method text not null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (prototype_id, approver_role)
);

comment on table public.prototype_approvals is
  'Aprobación del prototipo como fórmula: Gerencia y Dirección técnica, y el cliente cuando el brief es maquila a tercero (lo registra Dirección técnica con la referencia de su aceptación).';

alter table public.formula_prototypes enable row level security;
alter table public.prototype_items enable row level security;
alter table public.prototype_approvals enable row level security;
select app_private.register_table('public.formula_prototypes', p_no_delete => true);
select app_private.register_table('public.prototype_items');
select app_private.register_table('public.prototype_approvals', p_append_only => true);

-- ---------------------------------------------------------------------------
-- 3. Estabilidad preliminar (RF-16)
-- ---------------------------------------------------------------------------
create table public.stability_studies (
  id uuid primary key default gen_random_uuid(),
  prototype_id uuid not null references public.formula_prototypes (id),
  kind text not null default 'preliminar' check (kind = 'preliminar'),
  protocol_document_version_id uuid not null references public.document_versions (id),
  start_date timestamptz not null,
  end_date timestamptz not null,
  status text not null default 'en_curso' check (status in ('en_curso', 'completo', 'cerrado_anticipado')),
  result text check (result in ('cumple', 'no_cumple')),
  early_close_reason text,
  conclusions text,
  closed_by uuid references public.profiles (id),
  closed_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create unique index stability_studies_one_open on public.stability_studies (prototype_id) where status = 'en_curso';

create table public.stability_tests (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.stability_studies (id),
  test_type text not null check (test_type in ('calentamiento', 'enfriamiento', 'microbiologica', 'viscosidad', 'densidad')),
  required boolean not null default true,
  condition_min numeric(8, 2),
  condition_max numeric(8, 2),
  unit text,
  duration_days int not null default 30,
  replicates int not null check (replicates between 1 and 3),
  lab text not null default 'interno' check (lab in ('interno', 'externo')),
  external_lab_name text,
  report_file text,
  sample_volume_ml numeric(10, 2),
  method text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (study_id, test_type)
);

create table public.stability_readings (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.stability_tests (id),
  time_point text not null check (time_point in ('0h', '12h', '24h', '3d', '7d', '15d', '30d')),
  replicate int not null check (replicate between 1 and 3),
  due_at timestamptz not null,
  recorded_at timestamptz,
  temperature numeric(8, 2),
  ph numeric(6, 3),
  organoleptic jsonb,
  value numeric(14, 4),
  unit text,
  analytes jsonb,
  in_range boolean,
  within_window boolean,
  recorded_by uuid references public.profiles (id),
  observations text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (test_id, time_point, replicate)
);

comment on table public.stability_readings is
  'Cronograma y lecturas (RF-16): cada fila nace con su due_at al iniciar el estudio; registrar la llena y la bloquea.';

alter table public.stability_studies enable row level security;
alter table public.stability_tests enable row level security;
alter table public.stability_readings enable row level security;
select app_private.register_table('public.stability_studies', p_signable => true, p_no_delete => true);
select app_private.register_table('public.stability_tests', p_no_delete => true);
select app_private.register_table('public.stability_readings', p_signable => true, p_no_delete => true);
insert into public.signable_tables (table_name, label, kind, is_document, author_column)
values ('stability_studies', 'Estudio de estabilidad preliminar', 'estabilidad', false, 'created_by');

-- ---------------------------------------------------------------------------
-- 4. Lectura (RLS) y escritura solo por RPC
-- ---------------------------------------------------------------------------
create or replace function public.can_read_rd()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_permission('brief', 'read')
      or public.has_module_permission('prototipos_estabilidad_y_costos', 'read')
      or public.has_module_permission('formula_especificacion_instructivo', 'read');
$$;

revoke execute on function public.can_read_rd() from public, anon;
grant execute on function public.can_read_rd() to authenticated;

create policy "brief readers" on public.briefs for select to authenticated using (public.has_module_permission('brief', 'read'));
create policy "brief readers" on public.brief_competitors for select to authenticated using (public.has_module_permission('brief', 'read'));
create policy "prototype readers" on public.formula_prototypes for select to authenticated using (public.can_read_rd());
create policy "prototype readers" on public.prototype_items for select to authenticated
  using (public.has_module_permission('prototipos_estabilidad_y_costos', 'read'));
create policy "prototype readers" on public.prototype_approvals for select to authenticated using (public.can_read_rd());
create policy "stability readers" on public.stability_studies for select to authenticated
  using (public.has_module_permission('prototipos_estabilidad_y_costos', 'read'));
create policy "stability readers" on public.stability_tests for select to authenticated
  using (public.has_module_permission('prototipos_estabilidad_y_costos', 'read'));
create policy "stability readers" on public.stability_readings for select to authenticated
  using (public.has_module_permission('prototipos_estabilidad_y_costos', 'read'));
create policy "document readers read rd signatures" on public.signatures for select to authenticated
  using (record_table in ('briefs', 'stability_studies') and public.can_read_rd());

revoke all on table public.briefs, public.brief_competitors, public.formula_prototypes, public.prototype_items,
  public.prototype_approvals, public.stability_studies, public.stability_tests, public.stability_readings from anon;
revoke insert, update, delete, truncate on table public.briefs, public.brief_competitors, public.formula_prototypes,
  public.prototype_items, public.prototype_approvals, public.stability_studies, public.stability_tests,
  public.stability_readings from authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC del brief
-- ---------------------------------------------------------------------------
-- p_data: campos del brief; p_competitors: [{manufacturer, product_name, container, cap_type, label_type, claims,
-- actives, price, net_content_ml, aroma, color, appearance}, …]
create or replace function public.save_brief(p_id uuid, p_data jsonb, p_competitors jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.briefs;
  v_c jsonb;
  v_i int := 0;
begin
  if not public.has_module_permission('brief', 'create') then
    raise exception 'FORBIDDEN_ROLE: el brief lo elabora Comercial';
  end if;
  if p_id is null then
    insert into public.briefs (code) values (public.next_number('brief')) returning * into v;
  else
    select * into v from public.briefs where id = p_id for update;
    if not found then
      raise exception 'RECORD_NOT_FOUND: no existe el brief';
    end if;
    if v.status not in ('borrador', 'devuelto') then
      raise exception 'RECORD_LOCKED: el brief % está %; no se edita', v.code, v.status;
    end if;
    if v.created_by is distinct from auth.uid() then
      raise exception 'FORBIDDEN_ROLE: solo quien elaboró el brief lo edita';
    end if;
  end if;

  update public.briefs b set
    product_id = coalesce((p_data ->> 'product_id')::uuid, b.product_id),
    execution_date = (p_data ->> 'execution_date')::date,
    project_name = coalesce(trim(p_data ->> 'project_name'), ''),
    project_type = nullif(p_data ->> 'project_type', ''),
    product_category = nullif(p_data ->> 'product_category', ''),
    justification = coalesce(p_data ->> 'justification', ''),
    sources_description = coalesce(p_data ->> 'sources_description', ''),
    sensorial = coalesce(p_data -> 'sensorial', '{}'),
    target = coalesce(p_data -> 'target', '{}'),
    channels = coalesce(array(select jsonb_array_elements_text(p_data -> 'channels')), '{}'),
    channels_other = nullif(trim(p_data ->> 'channels_other'), ''),
    margin_pct = (p_data ->> 'margin_pct')::numeric,
    suggested_price_by_presentation = coalesce(p_data -> 'suggested_price_by_presentation', '[]'),
    legal_requirements = coalesce(p_data ->> 'legal_requirements', ''),
    implementation_costs = coalesce(p_data ->> 'implementation_costs', ''),
    recommendations = coalesce(p_data ->> 'recommendations', ''),
    status = 'borrador'
  where b.id = v.id;

  delete from public.brief_competitors where brief_id = v.id;
  for v_c in select * from jsonb_array_elements(coalesce(p_competitors, '[]')) loop
    v_i := v_i + 1;
    insert into public.brief_competitors (brief_id, order_no, manufacturer, product_name, container, cap_type, label_type,
      claims, actives, price, net_content_ml, aroma, color, appearance)
    values (v.id, v_i, coalesce(v_c ->> 'manufacturer', ''), coalesce(v_c ->> 'product_name', ''), v_c ->> 'container',
      v_c ->> 'cap_type', v_c ->> 'label_type', v_c ->> 'claims', v_c ->> 'actives', (v_c ->> 'price')::numeric,
      (v_c ->> 'net_content_ml')::numeric, v_c ->> 'aroma', v_c ->> 'color', v_c ->> 'appearance');
  end loop;
  return jsonb_build_object('id', v.id, 'code', v.code);
end;
$$;

-- Enviar a I+D (firma «Actualicé» de Comercial). Valida los campos obligatorios (RF-10).
create or replace function public.submit_brief(p_id uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.briefs;
  v_missing text[] := '{}';
  v_res jsonb;
begin
  select * into v from public.briefs where id = p_id for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el brief';
  end if;
  if v.created_by is distinct from auth.uid() or not public.has_module_permission('brief', 'sign') then
    raise exception 'FORBIDDEN_ROLE: envía el brief quien lo elaboró (Comercial)';
  end if;
  if v.status not in ('borrador', 'devuelto') then
    raise exception 'INVALID_TRANSITION: el brief % está %', v.code, v.status;
  end if;
  if v.execution_date is null then v_missing := array_append(v_missing, 'fecha de ejecución'); end if;
  if length(trim(v.project_name)) = 0 then v_missing := array_append(v_missing, 'nombre del proyecto'); end if;
  if v.project_type is null then v_missing := array_append(v_missing, 'tipo de proyecto'); end if;
  if v.product_category is null then v_missing := array_append(v_missing, 'medicamento o cosmético'); end if;
  if length(trim(v.justification)) = 0 then v_missing := array_append(v_missing, 'justificación'); end if;
  if cardinality(v.channels) = 0 then v_missing := array_append(v_missing, 'canal de distribución'); end if;
  if v.margin_pct is null then v_missing := array_append(v_missing, 'margen'); end if;
  if array_length(v_missing, 1) > 0 then
    raise exception 'INVALID_FIELD: faltan campos obligatorios: %', array_to_string(v_missing, ', ');
  end if;
  v_res := app_private.sign_simple('briefs', p_id, 'actualizo', p_password, null, 'comercial');
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  update public.briefs set status = 'enviado', return_reason = null where id = p_id;
  return v_res;
end;
$$;

-- Dirección técnica aprueba o devuelve el brief (con contraseña).
create or replace function public.decide_brief(p_id uuid, p_decision text, p_reason text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.briefs;
  v_res jsonb;
begin
  if not public.has_module_permission('brief', 'approve') then
    raise exception 'FORBIDDEN_ROLE: el brief lo aprueba Dirección técnica';
  end if;
  if p_decision not in ('aprobado', 'devuelto') then
    raise exception 'INVALID_FIELD: la decisión es «aprobado» o «devuelto»';
  end if;
  select * into v from public.briefs where id = p_id for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el brief';
  end if;
  if v.status <> 'enviado' then
    raise exception 'INVALID_TRANSITION: el brief % está %; solo se decide un brief enviado', v.code, v.status;
  end if;
  if v.created_by = auth.uid() then
    raise exception 'SOD_VIOLATION: quien elaboró el brief no lo aprueba';
  end if;
  if p_decision = 'devuelto' then
    perform app_private.require_reason(p_reason);
    v_res := app_private.verify_reauth(auth.uid(), p_password);
    if not (v_res ->> 'ok')::boolean then
      return v_res;
    end if;
    perform set_config('app.audit_reason', trim(p_reason), true);
    update public.briefs set status = 'devuelto', return_reason = trim(p_reason) where id = p_id;
    perform set_config('app.audit_reason', '', true);
    return jsonb_build_object('ok', true, 'status', 'devuelto');
  end if;
  v_res := app_private.sign_simple('briefs', p_id, 'aprobo', p_password, p_reason, 'dt');
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  update public.briefs set status = 'aprobado', locked_at = now() where id = p_id;
  return v_res || jsonb_build_object('status', 'aprobado');
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC de prototipos
-- ---------------------------------------------------------------------------
create or replace function app_private.require_rd_author()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('idi') then
    raise exception 'FORBIDDEN_ROLE: los prototipos los elabora el químico formulador (I+D)';
  end if;
end;
$$;

revoke execute on function app_private.require_rd_author() from public, anon, authenticated;

create or replace function app_private.replace_prototype_items(p_prototype uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_it jsonb;
  v_i int := 0;
begin
  delete from public.prototype_items where prototype_id = p_prototype;
  for v_it in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    v_i := v_i + 1;
    if not exists (select 1 from public.materials where id = (v_it ->> 'material_id')::uuid and type = 'mp' and active) then
      raise exception 'INVALID_FIELD: la línea % no es una materia prima activa', v_i;
    end if;
    insert into public.prototype_items (prototype_id, material_id, pct, phase, function, order_no)
    values (p_prototype, (v_it ->> 'material_id')::uuid, (v_it ->> 'pct')::numeric, nullif(v_it ->> 'phase', ''),
            nullif(v_it ->> 'function', ''), v_i);
  end loop;
end;
$$;

revoke execute on function app_private.replace_prototype_items(uuid, jsonb) from public, anon, authenticated;

-- p_data: {product_type, target_description, benefit, concept, draft_instruction}; p_items: [{material_id, pct, phase, function}]
create or replace function public.save_prototype(p_id uuid, p_brief uuid, p_data jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.formula_prototypes;
  v_brief public.briefs;
begin
  perform app_private.require_rd_author();
  if p_id is null then
    select * into v_brief from public.briefs where id = p_brief;
    if not found then
      raise exception 'RECORD_NOT_FOUND: no existe el brief';
    end if;
    if v_brief.status <> 'aprobado' then
      raise exception 'INVALID_TRANSITION: los prototipos parten de un brief aprobado (% está %)', v_brief.code, v_brief.status;
    end if;
    insert into public.formula_prototypes (brief_id, code) values (p_brief, public.next_number('prototype')) returning * into v;
  else
    select * into v from public.formula_prototypes where id = p_id for update;
    if not found then
      raise exception 'RECORD_NOT_FOUND: no existe el prototipo';
    end if;
    if v.status <> 'borrador' then
      raise exception 'RECORD_LOCKED: el prototipo % está %; no se edita', v.code, v.status;
    end if;
  end if;
  update public.formula_prototypes set
    product_type = coalesce(p_data ->> 'product_type', ''), target_description = coalesce(p_data ->> 'target_description', ''),
    benefit = coalesce(p_data ->> 'benefit', ''), concept = coalesce(p_data ->> 'concept', ''),
    draft_instruction = coalesce(p_data ->> 'draft_instruction', '')
  where id = v.id;
  perform app_private.replace_prototype_items(v.id, p_items);
  return jsonb_build_object('id', v.id, 'code', v.code);
end;
$$;

-- Mejora de un prototipo a reformular: consecutivo P-0007-1, P-0007-2…
create or replace function public.create_prototype_improvement(p_parent uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.formula_prototypes;
  v_root public.formula_prototypes;
  v_n int;
  v public.formula_prototypes;
begin
  perform app_private.require_rd_author();
  perform app_private.require_reason(p_reason);
  select * into v_parent from public.formula_prototypes where id = p_parent for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el prototipo';
  end if;
  if v_parent.status <> 'reformular' then
    raise exception 'INVALID_TRANSITION: solo se mejora un prototipo a reformular (% está %)', v_parent.code, v_parent.status;
  end if;
  select * into v_root from public.formula_prototypes where id = coalesce(v_parent.parent_prototype_id, v_parent.id);
  select coalesce(max(iteration_no), 0) + 1 into v_n from public.formula_prototypes
  where parent_prototype_id = v_root.id;
  perform set_config('app.audit_reason', trim(p_reason), true);
  insert into public.formula_prototypes (brief_id, code, parent_prototype_id, iteration_no, product_type,
    target_description, benefit, concept, draft_instruction)
  values (v_parent.brief_id, v_root.code || '-' || v_n, v_root.id, v_n, v_parent.product_type, v_parent.target_description,
    v_parent.benefit, v_parent.concept, v_parent.draft_instruction)
  returning * into v;
  insert into public.prototype_items (prototype_id, material_id, pct, phase, function, order_no)
  select v.id, material_id, pct, phase, function, order_no from public.prototype_items where prototype_id = v_parent.id;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('id', v.id, 'code', v.code);
end;
$$;

create or replace function public.discard_prototype(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.formula_prototypes;
begin
  perform app_private.require_rd_author();
  perform app_private.require_reason(p_reason);
  select * into v from public.formula_prototypes where id = p_id for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el prototipo';
  end if;
  if v.status not in ('borrador', 'reformular') then
    raise exception 'INVALID_TRANSITION: el prototipo % está %; no se descarta', v.code, v.status;
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.formula_prototypes set status = 'descartado', status_reason = trim(p_reason) where id = p_id;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- AC-13: al menos 2 prototipos iniciales por brief.
create or replace function app_private.require_min_prototypes(p_brief uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  select count(*) into v_n from public.formula_prototypes where brief_id = p_brief and parent_prototype_id is null;
  if v_n < 2 then
    raise exception 'MIN_PROTOTYPES: el brief tiene % prototipo(s); se requieren al menos 2 para elegir', v_n;
  end if;
end;
$$;

revoke execute on function app_private.require_min_prototypes(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC de estabilidad (RF-16; AC-16, AC-17, AC-18)
-- ---------------------------------------------------------------------------
create or replace function public.start_stability_study(p_prototype uuid, p_density_required boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proto public.formula_prototypes;
  v_doc public.controlled_documents;
  v_study public.stability_studies;
  v_start timestamptz := now();
  v_test public.stability_tests;
  v_tp text;
  v_r int;
  v_off interval;
  v_points text[];
begin
  perform app_private.require_rd_author();
  select * into v_proto from public.formula_prototypes where id = p_prototype for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el prototipo';
  end if;
  if v_proto.status <> 'borrador' then
    raise exception 'INVALID_TRANSITION: el estudio se inicia sobre un prototipo en borrador (% está %)', v_proto.code, v_proto.status;
  end if;
  if not exists (select 1 from public.prototype_items where prototype_id = p_prototype) then
    raise exception 'INVALID_FIELD: el prototipo % no tiene ingredientes', v_proto.code;
  end if;
  perform app_private.require_min_prototypes(v_proto.brief_id);
  select * into v_doc from public.controlled_documents
  where code = coalesce(public.get_setting('stability_protocol_code') #>> '{}', 'CC-PC-001');
  if not found or v_doc.status <> 'vigente' or v_doc.current_version_id is null then
    raise exception 'DOCUMENT_NOT_EFFECTIVE: el protocolo de estabilidad % no está vigente',
      coalesce(public.get_setting('stability_protocol_code') #>> '{}', 'CC-PC-001');
  end if;

  insert into public.stability_studies (prototype_id, protocol_document_version_id, start_date, end_date)
  values (p_prototype, v_doc.current_version_id, v_start, v_start + interval '30 days')
  returning * into v_study;

  insert into public.stability_tests (study_id, test_type, required, condition_min, condition_max, unit, replicates, lab, method)
  values (v_study.id, 'calentamiento', true, 42, 48, '°C', 3, 'interno', null),
         (v_study.id, 'enfriamiento', true, 0, 8, '°C', 3, 'interno', null),
         (v_study.id, 'microbiologica', true, null, null, 'UFC/g', 1, 'externo', null),
         (v_study.id, 'viscosidad', true, null, null, 'mPa·s', 3, 'interno', null),
         (v_study.id, 'densidad', coalesce(p_density_required, false), null, null, 'g/mL', 1, 'interno', 'picnometro');

  for v_test in select * from public.stability_tests where study_id = v_study.id and required loop
    v_points := case when v_test.test_type in ('calentamiento', 'enfriamiento')
                     then array['0h', '12h', '24h', '3d', '7d', '15d', '30d'] else array['0h', '30d'] end;
    foreach v_tp in array v_points loop
      v_off := case v_tp when '0h' then interval '0' when '12h' then interval '12 hours' when '24h' then interval '24 hours'
                         when '3d' then interval '3 days' when '7d' then interval '7 days' when '15d' then interval '15 days'
                         else interval '30 days' end;
      for v_r in 1 .. v_test.replicates loop
        insert into public.stability_readings (test_id, time_point, replicate, due_at, unit)
        values (v_test.id, v_tp, v_r, v_start + v_off, v_test.unit);
      end loop;
    end loop;
  end loop;

  update public.formula_prototypes set status = 'en_estabilidad' where id = p_prototype;
  return jsonb_build_object('study_id', v_study.id,
    'readings', (select count(*) from public.stability_readings r join public.stability_tests t on t.id = r.test_id where t.study_id = v_study.id));
end;
$$;

-- p_values según la prueba:
--   calentamiento/enfriamiento: {"temperature": 45.1, "ph": 5.6, "organoleptic": {"aspecto": "…", "color": "…", "olor": "…", "cambio": false}}
--   microbiologica: {"analytes": {"mesofilos": {"qualifier": "<", "value": 10}, "pseudomonas": "ausente", "staphylococcus": "ausente", "ecoli": "ausente"},
--                    "lab_name": "…", "report_ref": "IM-2026-0188"}
--   viscosidad: {"value": 11.8, "sample_volume_ml": 300} · densidad: {"value": 1.004}
create or replace function public.record_stability_reading(p_test uuid, p_time_point text, p_replicate int, p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test public.stability_tests;
  v_study public.stability_studies;
  v_read public.stability_readings;
  v_window numeric;
  v_in boolean;
  v_vol numeric;
begin
  if not public.has_any_role(array['lab_aux', 'idi', 'cc_jefe']) then
    raise exception 'FORBIDDEN_ROLE: registran lecturas el laboratorio, I+D o Control de calidad';
  end if;
  select * into v_test from public.stability_tests where id = p_test;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la prueba';
  end if;
  select * into v_study from public.stability_studies where id = v_test.study_id;
  if v_study.status <> 'en_curso' then
    raise exception 'INVALID_TRANSITION: el estudio está %; no admite lecturas', v_study.status;
  end if;
  if not v_test.required then
    raise exception 'INVALID_TRANSITION: la prueba de % no se requiere en este estudio', v_test.test_type;
  end if;
  select * into v_read from public.stability_readings
  where test_id = p_test and time_point = p_time_point and replicate = p_replicate for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: la prueba de % no tiene lectura % · repetición %', v_test.test_type, p_time_point, p_replicate;
  end if;
  if v_read.recorded_at is not null then
    raise exception 'READING_DUPLICATE: la lectura % · repetición % de % ya se registró', p_time_point, p_replicate, v_test.test_type;
  end if;

  if v_test.test_type in ('calentamiento', 'enfriamiento') then
    if (p_values ->> 'temperature') is null or (p_values ->> 'ph') is null
       or coalesce(length(trim(p_values #>> '{organoleptic,aspecto}')), 0) = 0
       or coalesce(length(trim(p_values #>> '{organoleptic,color}')), 0) = 0
       or coalesce(length(trim(p_values #>> '{organoleptic,olor}')), 0) = 0 then
      raise exception 'INVALID_FIELD: registre temperatura, pH y examen organoléptico (aspecto, color y olor)';
    end if;
    v_in := (p_values ->> 'temperature')::numeric between v_test.condition_min and v_test.condition_max;
  elsif v_test.test_type = 'microbiologica' then
    if coalesce(length(trim(p_values ->> 'report_ref')), 0) = 0 and v_test.report_file is null then
      raise exception 'REPORT_MISSING: adjunte el informe del laboratorio externo';
    end if;
    if jsonb_typeof(p_values -> 'analytes') <> 'object' or not (p_values -> 'analytes') ?& array['mesofilos', 'pseudomonas', 'staphylococcus', 'ecoli'] then
      raise exception 'INVALID_FIELD: registre mesófilos aerobios, P. aeruginosa, S. aureus y E. coli';
    end if;
    update public.stability_tests
    set report_file = coalesce(nullif(trim(p_values ->> 'report_ref'), ''), report_file),
        external_lab_name = coalesce(nullif(trim(p_values ->> 'lab_name'), ''), external_lab_name)
    where id = p_test;
  elsif v_test.test_type = 'viscosidad' then
    v_vol := coalesce((p_values ->> 'sample_volume_ml')::numeric, v_test.sample_volume_ml);
    if v_vol is null or v_vol < 250 then
      raise exception 'SAMPLE_TOO_SMALL: la muestra debe ser de al menos 250 mL (registró %)', coalesce(v_vol::text, 'sin volumen');
    end if;
    if (p_values ->> 'value') is null then
      raise exception 'INVALID_FIELD: registre la viscosidad en mPa·s';
    end if;
    update public.stability_tests set sample_volume_ml = v_vol where id = p_test;
  else
    if (p_values ->> 'value') is null then
      raise exception 'INVALID_FIELD: registre la densidad en g/mL (picnómetro)';
    end if;
  end if;

  select c.reading_window_hours into v_window
  from public.formula_prototypes p join public.briefs b on b.id = p.brief_id
  join public.stability_criteria c on c.product_id = b.product_id
  where p.id = v_study.prototype_id;

  update public.stability_readings set
    recorded_at = now(), recorded_by = auth.uid(),
    temperature = (p_values ->> 'temperature')::numeric, ph = (p_values ->> 'ph')::numeric,
    organoleptic = p_values -> 'organoleptic', value = (p_values ->> 'value')::numeric, analytes = p_values -> 'analytes',
    in_range = v_in,
    within_window = case when v_window is null then null else abs(extract(epoch from now() - due_at)) / 3600 <= v_window end,
    observations = nullif(trim(p_values ->> 'observations'), ''),
    locked_at = now()
  where id = v_read.id;
  return jsonb_build_object('ok', true, 'in_range', v_in);
end;
$$;

-- Lecturas obligatorias que faltan (texto para el aviso y el error).
create or replace function public.stability_missing(p_study uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('test', t.test_type, 'time_point', r.time_point, 'missing', r.n) order by t.test_type, r.time_point), '[]')
  from public.stability_tests t
  join lateral (
    select time_point, count(*) as n from public.stability_readings x
    where x.test_id = t.id and x.recorded_at is null group by time_point
  ) r on true
  where t.study_id = p_study and t.required;
$$;

grant execute on function public.stability_missing(uuid) to authenticated;

-- Evaluación contra los criterios del producto (D-13); devuelve la lista de incumplimientos.
create or replace function app_private.stability_violations(p_study uuid, p_criteria public.stability_criteria)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out text[] := '{}';
  v_t record;
  v_v0 numeric;
  v_v30 numeric;
  v_mes numeric;
  v_org text;
begin
  for v_t in
    select t.test_type, max(r.ph) - min(r.ph) as dph
    from public.stability_tests t join public.stability_readings r on r.test_id = t.id
    where t.study_id = p_study and t.test_type in ('calentamiento', 'enfriamiento') and r.recorded_at is not null
    group by t.test_type
  loop
    if v_t.dph > p_criteria.ph_max_variation then
      v_out := array_append(v_out, format('pH en %s varió %s (máximo %s)', v_t.test_type, round(v_t.dph, 3), p_criteria.ph_max_variation));
    end if;
  end loop;
  if exists (select 1 from public.stability_tests t join public.stability_readings r on r.test_id = t.id
             where t.study_id = p_study and t.test_type in ('calentamiento', 'enfriamiento') and r.in_range is false) then
    v_out := array_append(v_out, 'hay lecturas de temperatura fuera del rango de la prueba');
  end if;
  select avg(r.value) filter (where r.time_point = '0h'), avg(r.value) filter (where r.time_point = '30d') into v_v0, v_v30
  from public.stability_tests t join public.stability_readings r on r.test_id = t.id
  where t.study_id = p_study and t.test_type = 'viscosidad';
  if v_v0 > 0 and abs(v_v30 - v_v0) / v_v0 * 100 > p_criteria.viscosity_max_variation_pct then
    v_out := array_append(v_out, format('la viscosidad varió %s %% (máximo %s %%)', round(abs(v_v30 - v_v0) / v_v0 * 100, 2), p_criteria.viscosity_max_variation_pct));
  end if;
  if p_criteria.density_max_variation is not null then
    select max(r.value) - min(r.value) into v_v0 from public.stability_tests t join public.stability_readings r on r.test_id = t.id
    where t.study_id = p_study and t.test_type = 'densidad' and t.required;
    if v_v0 > p_criteria.density_max_variation then
      v_out := array_append(v_out, format('la densidad varió %s g/mL (máximo %s)', round(v_v0, 4), p_criteria.density_max_variation));
    end if;
  end if;
  select max((r.analytes #>> '{mesofilos,value}')::numeric) into v_mes
  from public.stability_tests t join public.stability_readings r on r.test_id = t.id
  where t.study_id = p_study and t.test_type = 'microbiologica';
  if (p_criteria.micro_limits ->> 'mesofilos_max') is not null and v_mes > (p_criteria.micro_limits ->> 'mesofilos_max')::numeric then
    v_out := array_append(v_out, format('mesófilos aerobios %s UFC/g (máximo %s)', v_mes, p_criteria.micro_limits ->> 'mesofilos_max'));
  end if;
  for v_org in select jsonb_array_elements_text(coalesce(p_criteria.micro_limits -> 'ausentes', '[]')) loop
    if exists (select 1 from public.stability_tests t join public.stability_readings r on r.test_id = t.id
               where t.study_id = p_study and t.test_type = 'microbiologica'
                 and coalesce(r.analytes ->> v_org, 'ausente') <> 'ausente') then
      v_out := array_append(v_out, format('%s no está ausente', v_org));
    end if;
  end loop;
  if p_criteria.organoleptic_changes_allowed = false and exists (
    select 1 from public.stability_tests t join public.stability_readings r on r.test_id = t.id
    where t.study_id = p_study and (r.organoleptic ->> 'cambio')::boolean) then
    v_out := array_append(v_out, 'hay cambios organolépticos y el criterio no los admite');
  end if;
  if exists (select 1 from public.stability_tests t join public.stability_readings r on r.test_id = t.id
             where t.study_id = p_study and r.within_window is false) then
    v_out := array_append(v_out, format('hay lecturas fuera de la ventana de ±%s h', p_criteria.reading_window_hours));
  end if;
  return v_out;
end;
$$;

revoke execute on function app_private.stability_violations(uuid, public.stability_criteria) from public, anon, authenticated;

-- Cierre firmado: «cumple» exige lecturas completas, criterios definidos y cumplidos; «no_cumple»
-- se admite en cualquier momento con motivo (cierre anticipado). Quien registró lecturas no cierra (SOD).
create or replace function public.close_stability_study(p_study uuid, p_result text, p_reason text, p_conclusions text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_study public.stability_studies;
  v_missing jsonb;
  v_crit public.stability_criteria;
  v_product uuid;
  v_viol text[];
  v_res jsonb;
  v_as text := app_private.first_role(array['cc_jefe', 'idi']);
begin
  if v_as is null then
    raise exception 'FORBIDDEN_ROLE: cierra el estudio Control de calidad o I+D';
  end if;
  if p_result not in ('cumple', 'no_cumple') then
    raise exception 'INVALID_FIELD: el resultado es «cumple» o «no_cumple»';
  end if;
  select * into v_study from public.stability_studies where id = p_study for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el estudio';
  end if;
  if v_study.status <> 'en_curso' then
    raise exception 'INVALID_TRANSITION: el estudio ya está %', v_study.status;
  end if;
  if exists (select 1 from public.stability_tests t join public.stability_readings r on r.test_id = t.id
             where t.study_id = p_study and r.recorded_by = auth.uid()) then
    raise exception 'SOD_VIOLATION: usted registró lecturas de este estudio; el resultado lo firma otra persona';
  end if;

  v_missing := public.stability_missing(p_study);
  if p_result = 'cumple' then
    if jsonb_array_length(v_missing) > 0 then
      raise exception 'STABILITY_INCOMPLETE: faltan % lectura(s) obligatorias (%)',
        (select sum((m ->> 'missing')::int) from jsonb_array_elements(v_missing) m),
        (select string_agg((m ->> 'test') || ' ' || (m ->> 'time_point'), ', ') from jsonb_array_elements(v_missing) m);
    end if;
    select b.product_id into v_product from public.formula_prototypes p join public.briefs b on b.id = p.brief_id
    where p.id = v_study.prototype_id;
    select * into v_crit from public.stability_criteria where product_id = v_product;
    if v_product is null or not found or v_crit.ph_max_variation is null or v_crit.viscosity_max_variation_pct is null
       or v_crit.micro_limits is null or v_crit.organoleptic_changes_allowed is null or v_crit.reading_window_hours is null then
      raise exception 'STABILITY_CRITERIA_MISSING: defina los criterios de cumplimiento del producto (D-13) antes de cerrar como «cumple»';
    end if;
    v_viol := app_private.stability_violations(p_study, v_crit);
    if array_length(v_viol, 1) > 0 then
      raise exception 'STABILITY_OUT_OF_CRITERIA: %', array_to_string(v_viol, '; ');
    end if;
  else
    perform app_private.require_reason(p_reason);
  end if;

  v_res := app_private.sign_simple('stability_studies', p_study, 'aprobo', p_password, p_reason, v_as);
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  update public.stability_studies set
    status = case when p_result = 'no_cumple' and jsonb_array_length(v_missing) > 0 then 'cerrado_anticipado' else 'completo' end,
    result = p_result, early_close_reason = case when p_result = 'no_cumple' then trim(p_reason) end,
    conclusions = nullif(trim(p_conclusions), ''), closed_by = auth.uid(), closed_at = now(), locked_at = now()
  where id = p_study;
  update public.formula_prototypes
  set status = case when p_result = 'cumple' then 'seleccionado' else 'reformular' end,
      status_reason = case when p_result = 'no_cumple' then trim(p_reason) end
  where id = v_study.prototype_id;
  return v_res || jsonb_build_object('result', p_result);
end;
$$;

-- Criterios de cumplimiento por producto (D-13): los define Control de calidad o I+D, con motivo.
create or replace function public.set_stability_criteria(p_product uuid, p_values jsonb, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_any_role(array['cc_jefe', 'idi', 'aq_dir']) then
    raise exception 'FORBIDDEN_ROLE: los criterios de estabilidad los define Control de calidad, I+D o Aseguramiento de la calidad';
  end if;
  perform app_private.require_reason(p_reason);
  if not exists (select 1 from public.products where id = p_product) then
    raise exception 'RECORD_NOT_FOUND: no existe el producto';
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  insert into public.stability_criteria (product_id) values (p_product) on conflict (product_id) do nothing;
  update public.stability_criteria set
    ph_max_variation = (p_values ->> 'ph_max_variation')::numeric,
    viscosity_max_variation_pct = (p_values ->> 'viscosity_max_variation_pct')::numeric,
    density_max_variation = (p_values ->> 'density_max_variation')::numeric,
    micro_limits = p_values -> 'micro_limits',
    organoleptic_changes_allowed = (p_values ->> 'organoleptic_changes_allowed')::boolean,
    reading_window_hours = (p_values ->> 'reading_window_hours')::numeric,
    notes = nullif(trim(p_values ->> 'notes'), '')
  where product_id = p_product;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Aprobación del prototipo como fórmula (AC-13)
-- ---------------------------------------------------------------------------
create or replace function app_private.require_conforming_study(p_prototype uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.stability_studies;
begin
  select * into v_s from public.stability_studies where prototype_id = p_prototype order by created_at desc limit 1;
  if not found then
    raise exception 'STABILITY_MISSING: el prototipo no tiene estudio de estabilidad preliminar';
  end if;
  if v_s.status <> 'completo' or v_s.result is distinct from 'cumple' then
    raise exception 'STABILITY_INCOMPLETE: falta un estudio de estabilidad completo y conforme (el último está %, %)',
      v_s.status, coalesce(v_s.result, 'sin resultado');
  end if;
end;
$$;

revoke execute on function app_private.require_conforming_study(uuid) from public, anon, authenticated;

create or replace function public.approve_prototype(p_prototype uuid, p_as_client boolean, p_client_reference text,
  p_reason text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v public.formula_prototypes;
  v_brief public.briefs;
  v_as text;
  v_auth jsonb;
  v_required text[];
  v_done text[];
begin
  select * into v from public.formula_prototypes where id = p_prototype for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el prototipo';
  end if;
  select * into v_brief from public.briefs where id = v.brief_id;
  v_required := case when v_brief.project_type = 'maquila_tercero' then array['gerencia', 'dt', 'cliente'] else array['gerencia', 'dt'] end;
  if coalesce(p_as_client, false) then
    if not 'cliente' = any(v_required) then
      raise exception 'INVALID_TRANSITION: la aprobación del cliente solo aplica a briefs de maquila a tercero';
    end if;
    if not public.has_role('dt') then
      raise exception 'FORBIDDEN_ROLE: la aceptación del cliente la registra Dirección técnica';
    end if;
    if coalesce(length(trim(p_client_reference)), 0) = 0 then
      raise exception 'INVALID_FIELD: indique la referencia de la aceptación del cliente';
    end if;
    v_as := 'cliente';
  else
    select r into v_as from unnest(array['gerencia', 'dt']) r
    where public.has_role(r) and not exists (select 1 from public.prototype_approvals a where a.prototype_id = p_prototype and a.approver_role = r)
    limit 1;
    if v_as is null then
      raise exception 'FORBIDDEN_ROLE: aprueban la fórmula Gerencia y Dirección técnica (falta quien no haya firmado)';
    end if;
  end if;
  if v.status <> 'seleccionado' then
    perform app_private.require_min_prototypes(v.brief_id);
    perform app_private.require_conforming_study(p_prototype);
    raise exception 'INVALID_TRANSITION: el prototipo % está %; se aprueba uno seleccionado', v.code, v.status;
  end if;
  perform app_private.require_min_prototypes(v.brief_id);
  perform app_private.require_conforming_study(p_prototype);
  if v.created_by = v_uid then
    raise exception 'SOD_VIOLATION: SOD-3: quien elaboró el prototipo no lo aprueba';
  end if;
  if exists (select 1 from public.prototype_approvals where prototype_id = p_prototype and approver = v_uid) and not coalesce(p_as_client, false) then
    raise exception 'SOD_VIOLATION: usted ya aprobó este prototipo; la otra aprobación la da otra persona';
  end if;
  if exists (select 1 from public.prototype_approvals where prototype_id = p_prototype and approver_role = v_as) then
    raise exception 'INVALID_TRANSITION: la aprobación de % ya está registrada', v_as;
  end if;

  v_auth := app_private.verify_reauth(v_uid, p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  perform set_config('app.audit_reason', coalesce(trim(p_reason), ''), true);
  insert into public.prototype_approvals (prototype_id, approver_role, approver, approver_name, client_reference, reason, reauth_method)
  values (p_prototype, v_as, v_uid, (select full_name from public.profiles where id = v_uid), nullif(trim(p_client_reference), ''),
          nullif(trim(p_reason), ''), v_auth ->> 'method');
  select array_agg(approver_role) into v_done from public.prototype_approvals where prototype_id = p_prototype;
  if v_required <@ v_done then
    update public.formula_prototypes set status = 'aprobado', approved_at = now() where id = p_prototype;
  end if;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('ok', true, 'approved_as', v_as,
    'status', (select status from public.formula_prototypes where id = p_prototype), 'required', to_jsonb(v_required));
end;
$$;

revoke execute on function public.save_brief(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.submit_brief(uuid, text) from public, anon;
revoke execute on function public.decide_brief(uuid, text, text, text) from public, anon;
revoke execute on function public.save_prototype(uuid, uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.create_prototype_improvement(uuid, text) from public, anon;
revoke execute on function public.discard_prototype(uuid, text) from public, anon;
revoke execute on function public.start_stability_study(uuid, boolean) from public, anon;
revoke execute on function public.record_stability_reading(uuid, text, int, jsonb) from public, anon;
revoke execute on function public.close_stability_study(uuid, text, text, text, text) from public, anon;
revoke execute on function public.set_stability_criteria(uuid, jsonb, text) from public, anon;
revoke execute on function public.approve_prototype(uuid, boolean, text, text, text) from public, anon;
grant execute on function public.save_brief(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.submit_brief(uuid, text) to authenticated;
grant execute on function public.decide_brief(uuid, text, text, text) to authenticated;
grant execute on function public.save_prototype(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.create_prototype_improvement(uuid, text) to authenticated;
grant execute on function public.discard_prototype(uuid, text) to authenticated;
grant execute on function public.start_stability_study(uuid, boolean) to authenticated;
grant execute on function public.record_stability_reading(uuid, text, int, jsonb) to authenticated;
grant execute on function public.close_stability_study(uuid, text, text, text, text) to authenticated;
grant execute on function public.set_stability_criteria(uuid, jsonb, text) to authenticated;
grant execute on function public.approve_prototype(uuid, boolean, text, text, text) to authenticated;
