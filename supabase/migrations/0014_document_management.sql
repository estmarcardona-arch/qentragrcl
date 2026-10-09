-- 0014_document_management.sql · Etapa E3 (PRD F2B: gestión documental y plantillas)
-- Tablas del sistema de gestión documental (PRD 2.5, 6.3): tipos y niveles, rutas de aprobación,
-- documentos controlados y versiones, solicitudes, estandarización, distribución y control de copias,
-- control de cambios, anulaciones, capacitación, plantillas de proceso y listado maestro (v_master_list).
-- Las transiciones viven en las RPC de 0015. Todas las tablas: RLS, bitácora, sin borrado.

-- ---------------------------------------------------------------------------
-- 0. Firma de versiones: columnas de ciclo de vida
-- ---------------------------------------------------------------------------
-- Una versión aprobada queda bloqueada (SOD-10) y su huella se firma. La publicación y la
-- obsolescencia solo fijan fechas de ciclo de vida (emisión, revisión, vigencia, obsolescencia);
-- esas columnas se excluyen de la huella y pueden cambiar en un registro bloqueado cuando una RPC
-- lo autoriza (app.signing_record), igual que «status».
alter table public.signable_tables add column lifecycle_columns text[] not null default '{}';
comment on column public.signable_tables.lifecycle_columns is
  'Columnas de ciclo de vida: fuera de la huella firmada y modificables por RPC tras el bloqueo (p. ej. fecha de emisión).';

create or replace function app_private.signable_row(p_table text, p_row jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select p_row - coalesce((select st.lifecycle_columns from public.signable_tables st where st.table_name = p_table), '{}');
$$;

revoke execute on function app_private.signable_row(text, jsonb) from public, anon, authenticated;

create or replace function public.enforce_record_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_volatile text[] := array['status', 'locked_at', 'updated_at', 'updated_by']
    || coalesce((select st.lifecycle_columns from public.signable_tables st where st.table_name = tg_table_name), '{}');
begin
  if (v_old ->> 'locked_at') is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE'
     and current_setting('app.signing_record', true) = tg_table_name || ':' || (v_old ->> 'id')
     and (to_jsonb(new) - v_volatile) = (v_old - v_volatile) then
    return new;
  end if;

  raise exception 'RECORD_LOCKED: el registro % de % está firmado y bloqueado', v_old ->> 'id', tg_table_name
    using errcode = 'P0001';
end;
$$;

create or replace function public.verify_signature_integrity(p_signature_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sig public.signatures;
  v_row jsonb;
begin
  select * into v_sig from public.signatures where id = p_signature_id;
  if not found then
    raise exception 'RECORD_NOT_FOUND: firma % no existe', p_signature_id;
  end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', v_sig.record_table)
    into v_row using v_sig.record_id;
  return v_row is not null
     and public.record_hash(app_private.signable_row(v_sig.record_table, v_row)) = v_sig.record_hash;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Configuración y numeración
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, description) values
  ('training_enforcement', '"bloquear"',
   'Capacitación antes de ejecutar pasos regidos por un documento (D-19): «bloquear» (TRAINING_REQUIRED) o «avisar». Supuesto por defecto: bloquear.'),
  ('training_pass_score', '80', 'Puntaje mínimo del cuestionario de capacitación, en % (PRD 2.5.7).'),
  ('document_due_soon_days', '30', 'Días antes de la fecha de revisión en que un documento pasa a «Por vencer».'),
  ('overdue_review_blocks_orders', 'false',
   'Un formato con revisión vencida bloquea la creación de órdenes (D-26). Supuesto por defecto: solo alerta.'),
  ('style_forbidden_terms', '["suficientemente", "generalmente", "adecuadamente", "apropiadamente", "etc."]',
   'Términos subjetivos o imprecisos que marca el revisor de redacción (PRD 2.5.3).');

insert into public.numbering_sequences (key, format, description) values
  ('document_request', 'SD-{YYYY}-{NNNN}', 'Solicitudes documentales (creación, modificación, anulación). Formato del Prompt 0B (D-11).'),
  ('document_change_request', 'SC-{YYYY}-{NNNN}', 'Solicitudes de cambio documental (RF-100).'),
  ('document_annulment', 'AN-{YYYY}-{NNNN}', 'Anulaciones de documentos (RF-99).'),
  ('training_certificate', 'CT-{YYYY}-{NNNN}', 'Constancias de capacitación (RF-97).'),
  ('external_document', 'EXT-{NNN}', 'Documentos externos (normas, contratos, resoluciones). Formato provisional (D-15).');

-- ---------------------------------------------------------------------------
-- 2. Rutas de aprobación (PRD 2.5.4) y tipos de documento (2.5.1, 2.5.8)
-- ---------------------------------------------------------------------------
create table public.approval_routes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z_]{3,30}$'),
  name text not null,
  description text not null default '',
  allow_reviewer_as_approver boolean not null default true,
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

select app_private.register_catalog('public.approval_routes');

create table public.approval_route_steps (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.approval_routes (id),
  step text not null check (step in ('revision', 'aprobacion')),
  roles text[] not null default '{}',
  includes_author_head boolean not null default false,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (route_id, step)
);

comment on column public.approval_route_steps.includes_author_head is
  'La revisión también la puede firmar el jefe inmediato del autor (jefe de su área).';

select app_private.register_catalog('public.approval_route_steps');

insert into public.approval_routes (code, name, description) values
  ('tecnica', 'Documento técnico', 'Revisa el jefe inmediato del autor o Aseguramiento de la calidad; aprueba Dirección técnica.'),
  ('administrativa', 'Documento administrativo', 'Revisa el jefe inmediato del autor o Aseguramiento de la calidad; aprueba Gerencia o Dirección técnica (D-24).');
insert into public.approval_route_steps (route_id, step, roles, includes_author_head)
select r.id, s.step, s.roles, s.head
from public.approval_routes r
join (values
  ('tecnica', 'revision', array['aq_dir'], true),
  ('tecnica', 'aprobacion', array['dt'], false),
  ('administrativa', 'revision', array['aq_dir'], true),
  ('administrativa', 'aprobacion', array['gerencia', 'dt'], false)
) as s(route, step, roles, head) on s.route = r.code;

create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  type_code text not null unique check (type_code ~ '^[A-Z]{2}$'),
  name text not null,
  level int not null check (level between 1 and 5),
  is_subdocument boolean not null default false,
  requires_scope boolean not null default true,
  validity_rule text not null default 'periodo' check (validity_rule in ('periodo', 'registro_sanitario', 'validacion_tecnica')),
  review_period_months int check (review_period_months is null or review_period_months between 1 and 120),
  stamp_required boolean not null default true,
  default_route_id uuid references public.approval_routes (id),
  requires_training boolean not null default true,
  requires_assessment boolean not null default true,
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.document_types is
  'Tipos de documento (PRD 2.5.1) con nivel, regla de vigencia (2.5.8), sello de copia controlada (D-22) y capacitación (D-19).';

select app_private.register_catalog('public.document_types');

-- Supuestos por defecto (marcados en el reporte de E3): los formatos no llevan sello (D-22);
-- formatos e instructivos no llevan alcance (2.5.3); las especificaciones se revisan cada 12 meses.
insert into public.document_types
  (type_code, name, level, is_subdocument, requires_scope, validity_rule, review_period_months, stamp_required,
   default_route_id, requires_training, requires_assessment)
select v.code, v.name, v.level, v.sub, v.scope, v.rule, v.months, v.stamp,
       (select id from public.approval_routes where code = 'tecnica'), v.training, v.assessment
from (values
  ('MN', 'Manual', 2, false, true, 'periodo', 36, true, true, true),
  ('PL', 'Plan', 3, false, true, 'periodo', 36, true, true, true),
  ('PR', 'Procedimiento', 3, false, true, 'periodo', 36, true, true, true),
  ('PO', 'Política', 2, false, true, 'periodo', 36, true, true, true),
  ('PG', 'Programa', 3, false, true, 'periodo', 36, true, true, true),
  ('PC', 'Protocolo', 4, false, true, 'periodo', 36, true, true, true),
  ('IN', 'Instructivo', 4, true, false, 'periodo', 36, true, true, true),
  ('EP', 'Especificación', 4, false, true, 'periodo', 12, true, true, true),
  ('FT', 'Ficha técnica', 4, false, true, 'registro_sanitario', null, true, true, false),
  ('FR', 'Formato', 5, true, false, 'periodo', 36, false, true, true),
  ('RG', 'Registro', 5, true, false, 'periodo', 36, false, false, false),
  ('CE', 'Certificado', 5, true, false, 'periodo', 36, false, false, false)
) as v(code, name, level, sub, scope, rule, months, stamp, training, assessment);

-- ---------------------------------------------------------------------------
-- 3. Documentos controlados y versiones
-- ---------------------------------------------------------------------------
create table public.controlled_documents (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^([A-Z]{2,3}-[A-Z]{2}-[0-9]{3}(-[A-Z]{2}-[0-9]{2})?|EXT-[0-9]{3})$'),
  origin text not null default 'interno' check (origin in ('interno', 'externo')),
  title text not null check (length(trim(title)) > 0),
  type_id uuid references public.document_types (id),
  process_id uuid references public.organizational_areas (id),
  parent_document_id uuid references public.controlled_documents (id),
  parent_code text,
  sub_type text check (sub_type is null or sub_type ~ '^[A-Z]{2}$'),
  sub_number int check (sub_number is null or sub_number between 1 and 99),
  status text not null default 'en_elaboracion' check (status in ('en_elaboracion', 'vigente', 'obsoleto', 'anulado')),
  current_version_id uuid,
  next_review_date date,
  regulatory_expiry_date date,
  validity_rule text check (validity_rule in ('periodo', 'registro_sanitario', 'validacion_tecnica')),
  route_id uuid references public.approval_routes (id),
  default_distribution uuid[] not null default '{}',
  external_issuer text,
  external_version text,
  external_pending_confirmation boolean not null default false,
  annulled_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (origin = 'externo' or (type_id is not null and process_id is not null)),
  check (origin = 'interno' or external_issuer is not null)
);

comment on table public.controlled_documents is
  'Documentos controlados (PRD 6.3). El código lo asigna solo aq_doc (RF-93). parent_code = código del procedimiento '
  'del que cuelga un subdocumento (puede no estar registrado aún en la plataforma).';
comment on column public.controlled_documents.validity_rule is
  'Regla de vigencia propia del documento (p. ej. instructivo de manufactura = registro sanitario); nula = la del tipo.';
comment on column public.controlled_documents.regulatory_expiry_date is
  'Vencimiento del registro o notificación sanitaria (o de la validación de la técnica) que fija la revisión (2.5.8, AC-34).';

alter table public.controlled_documents enable row level security;
select app_private.register_table('public.controlled_documents', p_no_delete => true);

create table public.document_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('creacion', 'modificacion', 'anulacion')),
  requested_by uuid not null references public.profiles (id),
  document_id uuid references public.controlled_documents (id),
  process_id uuid references public.organizational_areas (id),
  type_id uuid references public.document_types (id),
  parent_document_id uuid references public.controlled_documents (id),
  proposed_title text,
  reason text not null check (length(trim(reason)) > 0),
  requested_distribution uuid[] not null default '{}',
  status text not null default 'abierta' check (status in ('abierta', 'en_curso', 'cerrada', 'rechazada')),
  template_delivered_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (kind = 'creacion' or document_id is not null)
);

alter table public.document_requests enable row level security;
select app_private.register_table('public.document_requests', p_no_delete => true);

create table public.document_change_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  document_id uuid not null references public.controlled_documents (id),
  origin text not null check (origin in ('desviacion', 'capa', 'auditoria', 'mejora', 'regulatorio', 'renovacion_registro')),
  origin_ref text,
  reason text not null check (length(trim(reason)) > 0),
  impact text not null default '',
  technical_change boolean not null default false,
  status text not null default 'abierta' check (status in ('abierta', 'en_elaboracion', 'cerrada')),
  parent_review text check (parent_review in ('pendiente', 'sin_cambio', 'nueva_version')),
  parent_review_by uuid references public.profiles (id),
  parent_review_at timestamptz,
  parent_review_note text,
  requested_by uuid not null references public.profiles (id),
  closed_with_version_id uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on column public.document_change_requests.parent_review is
  'Un cambio técnico en un formato exige revisar su procedimiento padre (PARENT_DOCUMENT_REVIEW_REQUIRED, RF-100).';

alter table public.document_change_requests enable row level security;
select app_private.register_table('public.document_change_requests', p_no_delete => true);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.controlled_documents (id),
  request_id uuid references public.document_requests (id),
  change_request_id uuid references public.document_change_requests (id),
  version_no int not null check (version_no between 1 and 99),
  status text not null default 'solicitado' check (status in (
    'solicitado', 'preliminar', 'en_estandarizacion', 'codificado', 'en_revision', 'en_aprobacion', 'vigente', 'obsoleto')),
  author_id uuid not null references public.profiles (id),
  content jsonb not null default '{}',
  change_description text not null default '',
  technical_change boolean not null default false,
  file_path text,
  content_hash text,
  supersedes_id uuid references public.document_versions (id),
  style_check_result jsonb,
  issue_date date,
  review_due_date date,
  effective_at timestamptz,
  obsoleted_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (document_id is not null or status in ('solicitado', 'preliminar', 'en_estandarizacion'))
);

create unique index document_versions_number on public.document_versions (document_id, version_no)
  where document_id is not null;
-- Una sola versión en curso por documento.
create unique index document_versions_one_open on public.document_versions (document_id)
  where document_id is not null and status not in ('vigente', 'obsoleto');

comment on table public.document_versions is
  'Versiones (PRD 6.3, máquina de estados 9). Firmas en signatures: actualizo/reviso/aprobo. Aprobada = bloqueada (SOD-10).';

alter table public.controlled_documents
  add constraint controlled_documents_current_version_fk foreign key (current_version_id) references public.document_versions (id);
alter table public.document_change_requests
  add constraint document_change_requests_closed_version_fk foreign key (closed_with_version_id) references public.document_versions (id);

alter table public.document_versions enable row level security;
select app_private.register_table('public.document_versions', p_signable => true, p_no_delete => true);

insert into public.signable_tables (table_name, label, kind, is_document, author_column, group_column, lifecycle_columns)
values ('document_versions', 'Versión de documento controlado', 'documento', true, 'author_id', 'document_id',
        array['issue_date', 'review_due_date', 'effective_at', 'obsoleted_at']);

create table public.standardization_checks (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.document_versions (id),
  checklist jsonb not null,
  observations jsonb not null default '[]',
  result text not null check (result in ('cumple', 'no_cumple')),
  checked_by uuid not null references public.profiles (id),
  -- clock_timestamp: ordena varias verificaciones dentro de una misma transacción.
  checked_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.standardization_checks enable row level security;
select app_private.register_table('public.standardization_checks', p_append_only => true);

create table public.document_distribution (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.document_versions (id),
  area_id uuid references public.organizational_areas (id),
  recipient text,
  copy_type text not null default 'controlada' check (copy_type in ('controlada', 'no_controlada')),
  delivered_at timestamptz not null default now(),
  delivered_by uuid not null references public.profiles (id),
  recalled_at timestamptz,
  recalled_by uuid references public.profiles (id),
  recall_note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (area_id is not null or recipient is not null)
);

comment on table public.document_distribution is
  'Control de documentos (PRD 2.5.7): cada copia entregada y su recolección cuando queda obsoleta o se anula.';

alter table public.document_distribution enable row level security;
select app_private.register_table('public.document_distribution', p_no_delete => true);

create table public.document_annulments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  document_id uuid not null references public.controlled_documents (id),
  request_id uuid references public.document_requests (id),
  requested_by uuid not null references public.profiles (id),
  reason text not null check (length(trim(reason)) > 0),
  status text not null default 'solicitada' check (status in ('solicitada', 'aprobada', 'rechazada', 'cerrada')),
  decision text check (decision in ('aprobada', 'rechazada')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_reason text,
  recall_status text not null default 'no_aplica' check (recall_status in ('no_aplica', 'pendiente', 'completa')),
  closed_at timestamptz,
  closed_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.document_annulments enable row level security;
select app_private.register_table('public.document_annulments', p_no_delete => true);

create unique index document_annulments_one_open on public.document_annulments (document_id)
  where status in ('solicitada', 'aprobada');

-- ---------------------------------------------------------------------------
-- 4. Divulgación y capacitación (PRD 2.5.7, RF-97)
-- ---------------------------------------------------------------------------
create table public.document_trainings (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.document_versions (id),
  trainer_id uuid not null references public.profiles (id),
  method text not null default 'plataforma' check (method in ('presencial', 'plataforma')),
  pass_score numeric(5, 2) not null default 80 check (pass_score between 1 and 100),
  due_date date,
  requires_assessment boolean not null default true,
  questions jsonb not null default '[]',
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on column public.document_trainings.questions is
  'Preguntas de opción múltiple [{"q": "…", "options": ["…"]}] SIN la respuesta correcta (está en app_private.training_answer_keys).';

alter table public.document_trainings enable row level security;
select app_private.register_table('public.document_trainings', p_no_delete => true);

create table app_private.training_answer_keys (
  training_id uuid primary key references public.document_trainings (id),
  answers int[] not null
);
alter table app_private.training_answer_keys enable row level security;
revoke all on table app_private.training_answer_keys from public, anon, authenticated;

create table public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.document_trainings (id),
  user_id uuid not null references public.profiles (id),
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (training_id, user_id)
);

alter table public.training_assignments enable row level security;
select app_private.register_table('public.training_assignments', p_no_delete => true);

create table public.training_attempts (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.document_trainings (id),
  user_id uuid not null references public.profiles (id),
  attempt_no int not null check (attempt_no > 0),
  kind text not null default 'cuestionario' check (kind in ('cuestionario', 'lectura')),
  answers jsonb,
  score numeric(5, 2) check (score is null or score between 0 and 100),
  passed boolean not null,
  certificate_code text unique,
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (training_id, user_id, attempt_no),
  check (not passed or certificate_code is not null)
);

comment on table public.training_attempts is
  'Intentos del cuestionario o confirmación de lectura. Con el puntaje mínimo se emite la constancia (certificate_code).';

alter table public.training_attempts enable row level security;
select app_private.register_table('public.training_attempts', p_append_only => true);

-- Descargas del PDF con su marca (RF-103: usuario y fecha de descarga).
create table public.document_downloads (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.document_versions (id),
  user_id uuid not null references public.profiles (id),
  copy_type text not null check (copy_type in ('controlada', 'no_controlada', 'obsoleto')),
  downloaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.document_downloads enable row level security;
select app_private.register_table('public.document_downloads', p_append_only => true);

-- ---------------------------------------------------------------------------
-- 5. Etapas y plantillas de proceso (PRD 2.4, RF-05)
-- ---------------------------------------------------------------------------
create table public.stage_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z_]{3,40}$'),
  name text not null,
  order_no int not null,
  requires_clearance boolean not null default false,
  requires_cleaning_record boolean not null default false,
  governing_document_id uuid references public.controlled_documents (id),
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

select app_private.register_catalog('public.stage_definitions');

insert into public.stage_definitions (code, name, order_no, requires_clearance, requires_cleaning_record) values
  ('despeje', 'Despeje de línea', 10, false, false),
  ('dispensacion', 'Dispensación', 20, true, true),
  ('fabricacion', 'Fabricación', 30, true, true),
  ('envase', 'Envase', 40, true, true),
  ('acondicionamiento', 'Acondicionamiento', 50, true, true);

create table public.process_templates (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stage_definitions (id),
  document_version_id uuid not null unique references public.document_versions (id),
  status text not null default 'borrador' check (status in ('borrador', 'aprobada')),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.process_templates is
  'Plantilla de una etapa ligada a una versión de su documento controlado. Bloqueada al aprobarse la versión (AC-20).';

alter table public.process_templates enable row level security;
select app_private.register_table('public.process_templates', p_signable => true, p_no_delete => true);

create table public.process_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.process_templates (id),
  order_no int not null,
  label text not null,
  text text not null check (length(trim(text)) > 0),
  params jsonb not null default '[]',
  requires_equipment text,
  requires_verification boolean not null default false,
  checklist_item boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (template_id, order_no)
);

alter table public.process_template_steps enable row level security;
select app_private.register_table('public.process_template_steps');

-- Los pasos de una plantilla bloqueada no se tocan (SOD-10).
create or replace function app_private.protect_template_steps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.process_templates t
             where t.id = coalesce(new.template_id, old.template_id) and t.locked_at is not null)
     or (tg_op = 'UPDATE' and exists (select 1 from public.process_templates t
             where t.id = old.template_id and t.locked_at is not null)) then
    raise exception 'RECORD_LOCKED: la plantilla está aprobada; cree una versión nueva en borrador';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger process_template_steps_protect
  before insert or update or delete on public.process_template_steps
  for each row execute function app_private.protect_template_steps();

-- ---------------------------------------------------------------------------
-- 6. Lectura (RLS): todo usuario con acceso al SGD lee; escritura solo por RPC
-- ---------------------------------------------------------------------------
create or replace function public.can_read_documents()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_permission('sistema_de_gestion_documental', 'read')
      or public.has_module_permission('lectura_y_capacitacion', 'read');
$$;

create or replace function public.can_follow_trainings()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['aq_doc', 'aq_dir', 'auditor']);
$$;

revoke execute on function public.can_read_documents() from public, anon;
revoke execute on function public.can_follow_trainings() from public, anon;
grant execute on function public.can_read_documents() to authenticated;
grant execute on function public.can_follow_trainings() to authenticated;

create policy "document readers" on public.controlled_documents for select to authenticated using (public.can_read_documents());
create policy "document readers" on public.document_versions for select to authenticated using (public.can_read_documents());
create policy "document readers" on public.document_requests for select to authenticated using (public.can_read_documents());
create policy "document readers" on public.document_change_requests for select to authenticated using (public.can_read_documents());
create policy "document readers" on public.standardization_checks for select to authenticated using (public.can_read_documents());
create policy "document readers" on public.document_distribution for select to authenticated using (public.can_read_documents());
create policy "document readers" on public.document_annulments for select to authenticated using (public.can_read_documents());
create policy "document readers" on public.document_trainings for select to authenticated using (public.can_read_documents());
create policy "document readers" on public.process_templates for select to authenticated using (public.can_read_documents()
  or public.has_module_permission('plantillas_de_proceso', 'read'));
create policy "document readers" on public.process_template_steps for select to authenticated using (public.can_read_documents()
  or public.has_module_permission('plantillas_de_proceso', 'read'));
create policy "own or followers" on public.training_assignments for select to authenticated
  using (user_id = auth.uid() or public.can_follow_trainings());
create policy "own or followers" on public.training_attempts for select to authenticated
  using (user_id = auth.uid() or public.can_follow_trainings());
create policy "own or followers" on public.document_downloads for select to authenticated
  using (user_id = auth.uid() or public.can_follow_trainings());

revoke all on table public.controlled_documents, public.document_versions, public.document_requests,
  public.document_change_requests, public.standardization_checks, public.document_distribution,
  public.document_annulments, public.document_trainings, public.training_assignments, public.training_attempts,
  public.document_downloads, public.process_templates, public.process_template_steps from anon;
revoke insert, update, delete, truncate on table public.controlled_documents, public.document_versions,
  public.document_requests, public.document_change_requests, public.standardization_checks,
  public.document_distribution, public.document_annulments, public.document_trainings,
  public.training_assignments, public.training_attempts, public.document_downloads, public.process_templates,
  public.process_template_steps from authenticated;

-- ---------------------------------------------------------------------------
-- 7. Vigencia y listado maestro (PRD 2.5.8, 2.5.9, RF-92, RF-98)
-- ---------------------------------------------------------------------------
create or replace function public.bogota_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (public.reference_now() at time zone 'America/Bogota')::date;
$$;

grant execute on function public.bogota_today() to authenticated;

-- Fecha de revisión por la regla del tipo (AC-34): periodo → emisión + meses; registro sanitario o
-- validación → vencimiento del registro; un periodo con registro (p. ej. especificación de producto)
-- toma la fecha más cercana.
create or replace function public.compute_review_due_date(
  p_type_id uuid, p_issue_date date, p_regulatory_expiry date, p_rule text default null)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  v_type public.document_types;
  v_rule text;
  v_period date;
begin
  select * into v_type from public.document_types where id = p_type_id;
  if not found or p_issue_date is null then
    return null;
  end if;
  v_rule := coalesce(p_rule, v_type.validity_rule);
  if v_rule in ('registro_sanitario', 'validacion_tecnica') then
    return coalesce(p_regulatory_expiry, (p_issue_date + make_interval(months => coalesce(v_type.review_period_months, 36)))::date);
  end if;
  v_period := (p_issue_date + make_interval(months => coalesce(v_type.review_period_months, 36)))::date;
  return case when p_regulatory_expiry is not null and p_regulatory_expiry < v_period then p_regulatory_expiry else v_period end;
end;
$$;

grant execute on function public.compute_review_due_date(uuid, date, date, text) to authenticated;

create or replace function public.document_validity(p_review_date date, p_status text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_status in ('obsoleto', 'anulado') then 'obsoleto'
    when p_review_date is null then 'sin_dato'
    when p_review_date < public.bogota_today() then 'vencido'
    when p_review_date <= public.bogota_today() + coalesce((public.get_setting('document_due_soon_days') #>> '{}')::int, 30) then 'por_vencer'
    else 'vigente'
  end;
$$;

grant execute on function public.document_validity(date, text) to authenticated;

create or replace view public.v_master_list
with (security_invoker = true)
as
select
  d.id,
  d.code,
  d.title,
  d.origin,
  t.type_code,
  t.name as type_name,
  coalesce(t.level, 1) as level,
  a.process_code,
  a.name as process_name,
  d.parent_document_id,
  coalesce(d.parent_code, p.code) as parent_code,
  d.status as document_status,
  v.id as version_id,
  v.version_no,
  coalesce(d.external_version, lpad(v.version_no::text, 2, '0')) as version_label,
  v.status as version_status,
  v.issue_date,
  coalesce(v.effective_at, v.updated_at) as last_update,
  coalesce(d.next_review_date, v.review_due_date) as review_date,
  public.document_validity(coalesce(d.next_review_date, v.review_due_date), d.status) as validity,
  d.external_issuer,
  d.external_pending_confirmation,
  (select count(*) from public.controlled_documents c where c.parent_document_id = d.id
     or (c.parent_code = d.code)) as children_count,
  (select v2.version_no from public.document_versions v2 where v2.document_id = d.id
     and v2.status not in ('vigente', 'obsoleto') limit 1) as open_version_no,
  (select v2.status from public.document_versions v2 where v2.document_id = d.id
     and v2.status not in ('vigente', 'obsoleto') limit 1) as open_version_status
from public.controlled_documents d
left join public.document_types t on t.id = d.type_id
left join public.organizational_areas a on a.id = d.process_id
left join public.controlled_documents p on p.id = d.parent_document_id
left join lateral (
  select * from public.document_versions x
  where x.document_id = d.id
  order by (x.id = d.current_version_id) desc, x.version_no desc
  limit 1
) v on true;

comment on view public.v_master_list is
  'Listado maestro de documentos (RF-92): un documento una vez, con su versión vigente o, si no tiene, la última.';

grant select on public.v_master_list to authenticated;

-- Indicador anual: % de documentos vencidos por proceso (PRD 2.5.8).
create or replace view public.v_documents_overdue_by_process
with (security_invoker = true)
as
select
  m.process_code,
  m.process_name,
  count(*) as total,
  count(*) filter (where m.validity = 'vencido') as overdue,
  round(100.0 * count(*) filter (where m.validity = 'vencido') / nullif(count(*), 0), 1) as overdue_pct
from public.v_master_list m
where m.origin = 'interno' and m.document_status not in ('obsoleto', 'anulado')
group by m.process_code, m.process_name;

grant select on public.v_documents_overdue_by_process to authenticated;
