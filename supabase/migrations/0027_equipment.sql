-- 0027_equipment.sql · Etapa E6 (PRD 1.10, fase F5: equipos y hoja de vida)
-- RF-50: inventario de equipos con el documento que los rige, hoja de vida con eventos firmados (instalación,
-- calibración, verificación, mantenimiento, calificación, limpieza y uso), estados operativos y «calibración vencida»
-- derivada, certificados en Storage con huella SHA-256 y la validez que usará Producción (is_equipment_valid,
-- assert_equipment_valid: EQUIPMENT_NOT_VALID, AC-05 en F6). RF-51: notificaciones en la campana, cola de correos y
-- recordatorios diarios a 30/15/7 días (configurables) con pg_cron (D-59, D-60, D-61).

-- ---------------------------------------------------------------------------
-- 1. Permisos: fila «Equipos y hoja de vida» de la matriz 2.2 (PRD 1.10)
-- ---------------------------------------------------------------------------
insert into public.permission_modules (code, name, order_no) values
  ('equipos_y_hoja_de_vida', 'Equipos y hoja de vida (ficha, eventos, estados, certificados)', 22);

insert into public.module_permissions (module_code, role, cell_text, can_read, can_create, can_sign, can_approve, prd_cell_text)
select 'equipos_y_hoja_de_vida', v.role, v.cell, v.cell = 'L', v.cell like '%C%', v.cell like '%F%', v.cell like '%A%', v.cell
from (values
  ('comercial', '—'), ('idi', 'L'), ('bodega_aux', 'L'), ('bodega_jefe', 'C F'), ('prod_aux', 'C F'), ('prod_coord', 'C F'),
  ('lab_aux', 'C F'), ('cc_jefe', 'C F'), ('aq_dir', 'C F A'), ('dt', 'L'), ('admin', '—'), ('master', 'L'), ('aq_doc', 'L'),
  ('gerencia', 'L'), ('auditor', 'L')
) as v(role, cell);

insert into public.module_permissions (module_code, role, cell_text, can_read, can_create, can_sign, can_approve)
select 'equipos_y_hoja_de_vida', r.code, '—', false, false, false, false from public.roles r where not r.is_system;

insert into public.app_settings (key, value, description) values
  ('equipment_alert_days', '[30, 15, 7]', 'Días antes del vencimiento de calibración, mantenimiento o calificación en que se avisa (RF-51).'),
  ('cleaning_due_soon_hours', '48', 'Horas antes del vencimiento de la limpieza en que el equipo pasa a «Apto con alerta».');

-- ---------------------------------------------------------------------------
-- 2. Equipos, eventos y certificados
-- ---------------------------------------------------------------------------
create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2,4}-[0-9]{2,4}[A-Z]?$'),
  name text not null check (length(trim(name)) > 0),
  equipment_type text not null,
  plant_area text not null check (plant_area in
    ('bodega', 'dispensacion', 'fabricacion', 'envase', 'acondicionamiento', 'laboratorio', 'otra')),
  critical boolean not null default false,
  governing_document_id uuid references public.controlled_documents (id),
  manufacturer text,
  model text,
  serial_number text,
  capacity text,
  installed_on date,
  requires_calibration boolean not null default true,
  requires_qualification boolean not null default false,
  requires_cleaning boolean not null default true,
  status text not null default 'disponible' check (status in
    ('disponible', 'en_uso', 'en_limpieza', 'en_mantenimiento', 'fuera_de_servicio')),
  status_reason text,
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.equipment is
  'Equipos (RF-50): ficha, documento que los rige y estado operativo. «Calibración vencida» se deriva de los eventos (equipment_validity).';
select app_private.register_table('public.equipment', p_no_delete => true);
create trigger equipment_version before update on public.equipment for each row execute function public.bump_version();

create table public.equipment_events (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment (id),
  type text not null check (type in
    ('instalacion', 'calibracion', 'verificacion', 'mantenimiento', 'calificacion', 'limpieza', 'uso', 'cambio_estado')),
  performed_on date not null,
  result text check (result in ('conforme', 'no_conforme')),
  due_on date,
  valid_until timestamptz,
  provider text,
  reference text,
  notes text,
  batch_ref text,
  status_from text,
  status_to text,
  status text not null default 'registrado' check (status in ('registrado', 'verificado')),
  recorded_by uuid references public.profiles (id),
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (due_on is null or due_on >= performed_on)
);

comment on table public.equipment_events is 'Hoja de vida del equipo (RF-50): eventos firmados e inmutables con su próximo vencimiento.';
select app_private.register_table('public.equipment_events', p_no_delete => true);
create index equipment_events_equipment_idx on public.equipment_events (equipment_id, type, performed_on desc);
insert into public.signable_tables (table_name, label, kind, is_quality, author_column)
values ('equipment_events', 'Evento de la hoja de vida de un equipo', 'equipo', true, 'recorded_by');

-- Un evento firmado no cambia; la limpieza solo admite su verificación (verified_by, verified_at, status).
create or replace function public.protect_equipment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.type = 'limpieza' and old.verified_at is null and new.verified_at is not null
     and (to_jsonb(new) - array['verified_by', 'verified_at', 'status', 'locked_at', 'updated_at', 'updated_by'])
       = (to_jsonb(old) - array['verified_by', 'verified_at', 'status', 'locked_at', 'updated_at', 'updated_by']) then
    return new;
  end if;
  -- Bloqueo inicial al firmar: solo se fija locked_at.
  if old.locked_at is null and new.locked_at is not null
     and (to_jsonb(new) - array['locked_at', 'updated_at', 'updated_by'])
       = (to_jsonb(old) - array['locked_at', 'updated_at', 'updated_by']) then
    return new;
  end if;
  raise exception 'RECORD_LOCKED: un evento de la hoja de vida no se modifica; registre uno nuevo';
end;
$$;
create trigger equipment_events_protect before update on public.equipment_events
  for each row execute function public.protect_equipment_event();
revoke execute on function public.protect_equipment_event() from public, anon, authenticated;

create table public.equipment_attachments (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment (id),
  event_id uuid references public.equipment_events (id),
  bucket text not null default 'evidencias',
  path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.equipment_attachments is 'Certificados y evidencias de la hoja de vida en Storage, con huella SHA-256 (RF-50). Inmutables.';
select app_private.register_table('public.equipment_attachments', p_append_only => true);

-- ---------------------------------------------------------------------------
-- 3. Notificaciones y cola de correos (RF-51)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  kind text not null,
  title text not null,
  body text,
  link text,
  entity_table text,
  entity_id uuid,
  due_on date,
  threshold_days int,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.notifications is 'Avisos de la campana (RF-51). Cada persona ve solo los suyos.';
create unique index notifications_once_idx on public.notifications (user_id, kind, entity_id, due_on, threshold_days);
create index notifications_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
select app_private.register_table('public.notifications');

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications (id),
  user_id uuid references public.profiles (id),
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'enviado', 'error')),
  attempts int not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.email_outbox is
  'Cola de correos de recordatorio (RF-51). El envío lo hace el proveedor de correo cuando se configure (D-37, D-60).';
select app_private.register_table('public.email_outbox');

-- ---------------------------------------------------------------------------
-- 4. Lectura (RLS) y escritura solo por RPC
-- ---------------------------------------------------------------------------
alter table public.equipment enable row level security;
alter table public.equipment_events enable row level security;
alter table public.equipment_attachments enable row level security;
alter table public.notifications enable row level security;
alter table public.email_outbox enable row level security;
create policy "equipment readers" on public.equipment for select to authenticated
  using (public.has_module_permission('equipos_y_hoja_de_vida', 'read'));
create policy "equipment readers" on public.equipment_events for select to authenticated
  using (public.has_module_permission('equipos_y_hoja_de_vida', 'read'));
create policy "equipment readers" on public.equipment_attachments for select to authenticated
  using (public.has_module_permission('equipos_y_hoja_de_vida', 'read'));
create policy "equipment readers read event signatures" on public.signatures for select to authenticated
  using (record_table = 'equipment_events' and public.has_module_permission('equipos_y_hoja_de_vida', 'read'));
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
-- La cola de correos no la lee el navegador: la procesa el servicio de envío.
revoke all on table public.equipment, public.equipment_events, public.equipment_attachments, public.notifications,
  public.email_outbox from anon;
revoke insert, update, delete, truncate on table public.equipment, public.equipment_events, public.equipment_attachments,
  public.notifications, public.email_outbox from authenticated;
revoke select on table public.email_outbox from authenticated;

-- ---------------------------------------------------------------------------
-- 5. Storage: bucket privado «evidencias» (D-61). Se sube a equipos/<código>/…; nada se reemplaza ni se borra.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Storage no está disponible: el bucket «evidencias» se crea cuando lo esté';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('evidencias', 'evidencias', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
  on conflict (id) do nothing;
  execute $p$create policy "evidencias: subir certificados de equipos" on storage.objects for insert to authenticated
    with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = 'equipos'
                and public.has_module_permission('equipos_y_hoja_de_vida', 'create'))$p$;
  execute $p$create policy "evidencias: leer certificados de equipos" on storage.objects for select to authenticated
    using (bucket_id = 'evidencias' and (storage.foldername(name))[1] = 'equipos'
           and public.has_module_permission('equipos_y_hoja_de_vida', 'read'))$p$;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Validez del equipo en un momento (RF-50; la usa Producción: RF-34, RF-39, AC-05)
-- ---------------------------------------------------------------------------
create or replace function public.equipment_validity(p_equipment uuid, p_at timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_at timestamptz := coalesce(p_at, public.reference_now());
  v_day date := (coalesce(p_at, public.reference_now()) at time zone 'America/Bogota')::date;
  e public.equipment;
  v_cal public.equipment_events;
  v_mnt public.equipment_events;
  v_qual public.equipment_events;
  v_cln public.equipment_events;
  v_reasons text[] := '{}';
begin
  select * into e from public.equipment where id = p_equipment;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el equipo';
  end if;
  -- El último evento de cada tipo hasta ese momento (por fecha de ejecución y de registro).
  select * into v_cal from public.equipment_events where equipment_id = e.id and type = 'calibracion' and performed_on <= v_day
    order by performed_on desc, created_at desc limit 1;
  select * into v_mnt from public.equipment_events where equipment_id = e.id and type = 'mantenimiento' and performed_on <= v_day
    order by performed_on desc, created_at desc limit 1;
  select * into v_qual from public.equipment_events where equipment_id = e.id and type = 'calificacion' and performed_on <= v_day
    order by performed_on desc, created_at desc limit 1;
  select * into v_cln from public.equipment_events where equipment_id = e.id and type = 'limpieza' and verified_at is not null
    and performed_on <= v_day order by valid_until desc limit 1;

  if not e.active then v_reasons := v_reasons || 'el equipo está inactivo'::text; end if;
  if e.status = 'fuera_de_servicio' then v_reasons := v_reasons || 'el equipo está fuera de servicio'::text; end if;
  if e.status = 'en_mantenimiento' then v_reasons := v_reasons || 'el equipo está en mantenimiento'::text; end if;
  if e.status = 'en_limpieza' then v_reasons := v_reasons || 'el equipo está en limpieza'::text; end if;
  if e.requires_calibration then
    if v_cal.id is null then
      v_reasons := v_reasons || 'no tiene calibración registrada'::text;
    elsif v_cal.result = 'no_conforme' then
      v_reasons := v_reasons || ('la última calibración (' || to_char(v_cal.performed_on, 'DD/MM/YYYY') || ') no fue conforme');
    elsif v_cal.due_on < v_day then
      v_reasons := v_reasons || ('calibración vencida el ' || to_char(v_cal.due_on, 'DD/MM/YYYY'));
    end if;
  end if;
  if v_mnt.id is not null and (v_mnt.result = 'no_conforme' or v_mnt.due_on < v_day) then
    v_reasons := v_reasons || ('mantenimiento ' || case when v_mnt.result = 'no_conforme' then 'no conforme'
      else 'vencido el ' || to_char(v_mnt.due_on, 'DD/MM/YYYY') end);
  end if;
  if e.requires_qualification then
    if v_qual.id is null then
      v_reasons := v_reasons || 'no tiene calificación registrada'::text;
    elsif v_qual.result = 'no_conforme' or v_qual.due_on < v_day then
      v_reasons := v_reasons || ('calificación ' || case when v_qual.result = 'no_conforme' then 'no conforme'
        else 'vencida el ' || to_char(v_qual.due_on, 'DD/MM/YYYY') end);
    end if;
  end if;
  if e.requires_cleaning then
    if v_cln.id is null then
      v_reasons := v_reasons || 'no tiene limpieza verificada'::text;
    elsif v_cln.valid_until < v_at then
      v_reasons := v_reasons || ('limpieza vencida el ' || to_char(v_cln.valid_until at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI'));
    end if;
  end if;

  return jsonb_build_object(
    'valid', cardinality(v_reasons) = 0,
    'reasons', to_jsonb(v_reasons),
    'calibration_due', case when v_cal.result = 'conforme' then v_cal.due_on end,
    'calibration_result', v_cal.result,
    'maintenance_due', v_mnt.due_on,
    'qualification_due', case when v_qual.result = 'conforme' then v_qual.due_on end,
    'cleaning_until', v_cln.valid_until,
    'calibration_expired', e.requires_calibration and (v_cal.id is null or v_cal.result = 'no_conforme' or v_cal.due_on < v_day));
end;
$$;

create or replace function public.is_equipment_valid(p_equipment uuid, p_at timestamptz default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (public.equipment_validity(p_equipment, p_at) ->> 'valid')::boolean;
$$;

-- AC-05 (en F6): la regla y qué hacer, p. ej. «BAL-014: calibración vencida el 02/10/2026».
create or replace function public.assert_equipment_valid(p_equipment uuid, p_at timestamptz default null)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb := public.equipment_validity(p_equipment, p_at);
begin
  if not (v ->> 'valid')::boolean then
    raise exception 'EQUIPMENT_NOT_VALID: %: %', (select code from public.equipment where id = p_equipment),
      (select string_agg(r, '; ') from jsonb_array_elements_text(v -> 'reasons') r);
  end if;
end;
$$;

revoke execute on function public.equipment_validity(uuid, timestamptz) from public, anon;
revoke execute on function public.is_equipment_valid(uuid, timestamptz) from public, anon;
revoke execute on function public.assert_equipment_valid(uuid, timestamptz) from public, anon;
grant execute on function public.equipment_validity(uuid, timestamptz) to authenticated;
grant execute on function public.is_equipment_valid(uuid, timestamptz) to authenticated;
grant execute on function public.assert_equipment_valid(uuid, timestamptz) to authenticated;

-- Estado de cada equipo hoy: vencimientos, estado efectivo (calibración vencida derivada) y estado general.
create or replace view public.v_equipment_status
with (security_invoker = true)
as
with v as (
  select e.*, public.equipment_validity(e.id) as val,
    (public.reference_now() at time zone 'America/Bogota')::date as today,
    coalesce((select max((t #>> '{}')::int) from public.app_settings s, jsonb_array_elements(s.value) t
              where s.key = 'equipment_alert_days'), 30) as alert_days,
    coalesce((select (value #>> '{}')::int from public.app_settings where key = 'cleaning_due_soon_hours'), 48) as cleaning_hours
  from public.equipment e
)
select v.id, v.code, v.name, v.equipment_type, v.plant_area, v.critical, v.governing_document_id, v.status, v.status_reason,
  v.active, v.requires_calibration, v.requires_qualification, v.requires_cleaning,
  (v.val ->> 'calibration_due')::date as calibration_due,
  v.val ->> 'calibration_result' as calibration_result,
  (v.val ->> 'maintenance_due')::date as maintenance_due,
  (v.val ->> 'qualification_due')::date as qualification_due,
  (v.val ->> 'cleaning_until')::timestamptz as cleaning_until,
  (v.val ->> 'valid')::boolean as valid,
  v.val -> 'reasons' as reasons,
  case when v.status = 'disponible' and (v.val ->> 'calibration_expired')::boolean then 'calibracion_vencida' else v.status end
    as effective_status,
  case
    when not (v.val ->> 'valid')::boolean then 'no_apto'
    when ((v.val ->> 'calibration_due')::date - v.today) <= v.alert_days
      or ((v.val ->> 'maintenance_due')::date - v.today) <= v.alert_days
      or ((v.val ->> 'qualification_due')::date - v.today) <= v.alert_days
      or (v.val ->> 'cleaning_until')::timestamptz <= public.reference_now() + make_interval(hours => v.cleaning_hours)
      then 'apto_con_alerta'
    else 'apto'
  end as fitness
from v;

comment on view public.v_equipment_status is 'Estado de cada equipo (RF-50): vencimientos, validez, estado efectivo y estado general.';
revoke all on table public.v_equipment_status from anon;

-- ---------------------------------------------------------------------------
-- 7. RPC de la hoja de vida
-- ---------------------------------------------------------------------------
create or replace function app_private.require_equipment(p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_module_permission('equipos_y_hoja_de_vida', p_permission) then
    raise exception 'FORBIDDEN_ROLE: %', case p_permission
      when 'approve' then 'esta acción la aprueba Aseguramiento de la calidad'
      else 'los equipos los registran bodega, producción, laboratorio y Control de calidad' end;
  end if;
end;
$$;
revoke execute on function app_private.require_equipment(text) from public, anon, authenticated;

create or replace function public.save_equipment(p_id uuid, p_data jsonb, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(p_data ->> 'code'));
  v_type text := nullif(trim(p_data ->> 'equipment_type'), '');
  v_doc uuid := nullif(p_data ->> 'governing_document_id', '')::uuid;
  v_id uuid;
begin
  perform app_private.require_equipment('create');
  if coalesce(length(trim(p_data ->> 'name')), 0) = 0 then
    raise exception 'INVALID_FIELD: escriba el nombre del equipo';
  end if;
  if not exists (select 1 from public.catalog_items where catalog = 'tipos_equipo' and code = v_type and active) then
    raise exception 'INVALID_FIELD: el tipo de equipo «%» no está en el catálogo de tipos de equipo', coalesce(v_type, '');
  end if;
  if v_doc is not null and not exists (select 1 from public.controlled_documents where id = v_doc) then
    raise exception 'INVALID_FIELD: el documento que rige el equipo no existe en el listado maestro';
  end if;
  if p_id is null then
    if v_code is null or v_code !~ '^[A-Z]{2,4}-[0-9]{2,4}[A-Z]?$' then
      raise exception 'INVALID_FIELD: el código del equipo sigue el formato AAA-999 (p. ej. BAL-014, TQ-101)';
    end if;
    if exists (select 1 from public.equipment where code = v_code) then
      raise exception 'INVALID_FIELD: ya existe un equipo con el código %', v_code;
    end if;
    perform set_config('app.audit_reason', coalesce(nullif(trim(p_reason), ''), 'Alta del equipo ' || v_code), true);
    insert into public.equipment (code, name, equipment_type, plant_area, critical, governing_document_id, manufacturer, model,
      serial_number, capacity, installed_on, requires_calibration, requires_qualification, requires_cleaning)
    values (v_code, trim(p_data ->> 'name'), v_type, coalesce(nullif(p_data ->> 'plant_area', ''), 'otra'),
      coalesce((p_data ->> 'critical')::boolean, false), v_doc, nullif(trim(p_data ->> 'manufacturer'), ''),
      nullif(trim(p_data ->> 'model'), ''), nullif(trim(p_data ->> 'serial_number'), ''), nullif(trim(p_data ->> 'capacity'), ''),
      nullif(p_data ->> 'installed_on', '')::date, coalesce((p_data ->> 'requires_calibration')::boolean, true),
      coalesce((p_data ->> 'requires_qualification')::boolean, coalesce((p_data ->> 'critical')::boolean, false)),
      coalesce((p_data ->> 'requires_cleaning')::boolean, true))
    returning id into v_id;
  else
    perform app_private.require_reason(p_reason);
    perform set_config('app.audit_reason', trim(p_reason), true);
    update public.equipment set
      name = trim(p_data ->> 'name'), equipment_type = v_type,
      plant_area = coalesce(nullif(p_data ->> 'plant_area', ''), plant_area),
      critical = coalesce((p_data ->> 'critical')::boolean, critical), governing_document_id = v_doc,
      manufacturer = nullif(trim(p_data ->> 'manufacturer'), ''), model = nullif(trim(p_data ->> 'model'), ''),
      serial_number = nullif(trim(p_data ->> 'serial_number'), ''), capacity = nullif(trim(p_data ->> 'capacity'), ''),
      installed_on = nullif(p_data ->> 'installed_on', '')::date,
      requires_calibration = coalesce((p_data ->> 'requires_calibration')::boolean, requires_calibration),
      requires_qualification = coalesce((p_data ->> 'requires_qualification')::boolean, requires_qualification),
      requires_cleaning = coalesce((p_data ->> 'requires_cleaning')::boolean, requires_cleaning),
      active = coalesce((p_data ->> 'active')::boolean, active)
    where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'RECORD_NOT_FOUND: no existe el equipo';
    end if;
  end if;
  perform set_config('app.audit_reason', '', true);
  return v_id;
end;
$$;

-- Registra un evento con firma («Ejecuté»; la calificación, «Aprobé» de Aseguramiento de la calidad). La calibración
-- exige el certificado adjunto (AC-44), ya subido al bucket «evidencias» con su huella.
create or replace function public.record_equipment_event(p_equipment uuid, p_type text, p_data jsonb, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e public.equipment;
  v_on date := nullif(p_data ->> 'performed_on', '')::date;
  v_result text := nullif(p_data ->> 'result', '');
  v_due date := nullif(p_data ->> 'due_on', '')::date;
  v_until timestamptz := nullif(p_data ->> 'valid_until', '')::timestamptz;
  v_today date := (public.reference_now() at time zone 'America/Bogota')::date;
  v_att jsonb := coalesce(p_data -> 'attachments', '[]');
  v_a jsonb;
  v_auth jsonb;
  v_ev public.equipment_events;
  v_res jsonb;
begin
  if p_type not in ('instalacion', 'calibracion', 'verificacion', 'mantenimiento', 'calificacion', 'limpieza', 'uso') then
    raise exception 'INVALID_FIELD: tipo de evento no válido';
  end if;
  perform app_private.require_equipment(case when p_type = 'calificacion' then 'approve' else 'sign' end);
  select * into e from public.equipment where id = p_equipment for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el equipo';
  end if;
  if v_on is null then
    raise exception 'INVALID_FIELD: indique la fecha en que se realizó';
  end if;
  if v_on > v_today then
    raise exception 'INVALID_FIELD: la fecha de realización no puede ser futura';
  end if;
  if p_type in ('calibracion', 'verificacion', 'mantenimiento', 'calificacion') and v_result is null then
    raise exception 'INVALID_FIELD: indique si el resultado fue conforme';
  end if;
  if p_type in ('calibracion', 'mantenimiento', 'calificacion') and v_result = 'conforme' and (v_due is null or v_due <= v_on) then
    raise exception 'INVALID_FIELD: indique el próximo vencimiento, posterior a la fecha de realización';
  end if;
  if p_type = 'calibracion' and jsonb_array_length(v_att) = 0 then
    raise exception 'INVALID_FIELD: adjunte el certificado de calibración (AC-44)';
  end if;
  if p_type = 'limpieza' and (v_until is null or v_until <= public.reference_now()) then
    raise exception 'INVALID_FIELD: indique hasta cuándo es vigente la limpieza (posterior a ahora)';
  end if;
  if p_type = 'uso' and coalesce(length(trim(p_data ->> 'batch_ref')), 0) = 0 then
    raise exception 'INVALID_FIELD: indique el lote o la orden en que se usó';
  end if;
  for v_a in select * from jsonb_array_elements(v_att) loop
    if to_regclass('storage.objects') is not null and not exists (
      select 1 from storage.objects o where o.bucket_id = 'evidencias' and o.name = v_a ->> 'path') then
      raise exception 'INVALID_FIELD: el archivo % no está en el almacenamiento de evidencias', v_a ->> 'file_name';
    end if;
    if coalesce(v_a ->> 'sha256', '') !~ '^[0-9a-f]{64}$' then
      raise exception 'INVALID_FIELD: falta la huella SHA-256 del archivo %', v_a ->> 'file_name';
    end if;
  end loop;

  -- La contraseña se verifica antes de escribir: un intento fallido queda contado y no deja el evento a medias.
  v_auth := app_private.verify_reauth(v_uid, p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  perform set_config('app.audit_reason', 'Hoja de vida de ' || e.code || ': ' || p_type, true);
  insert into public.equipment_events (equipment_id, type, performed_on, result, due_on, valid_until, provider, reference, notes,
    batch_ref, recorded_by)
  values (e.id, p_type, v_on, coalesce(v_result, case when p_type in ('limpieza', 'instalacion') then 'conforme' end),
    case when p_type in ('calibracion', 'mantenimiento', 'calificacion') then v_due end,
    case when p_type = 'limpieza' then v_until end, nullif(trim(p_data ->> 'provider'), ''),
    nullif(trim(p_data ->> 'reference'), ''), nullif(trim(p_data ->> 'notes'), ''), nullif(trim(p_data ->> 'batch_ref'), ''), v_uid)
  returning * into v_ev;
  insert into public.equipment_attachments (equipment_id, event_id, path, file_name, mime_type, size_bytes, sha256, uploaded_by)
  select e.id, v_ev.id, a ->> 'path', a ->> 'file_name', a ->> 'mime_type', (a ->> 'size_bytes')::bigint, a ->> 'sha256', v_uid
  from jsonb_array_elements(v_att) a;
  if p_type = 'instalacion' and e.installed_on is null then
    update public.equipment set installed_on = v_on where id = e.id;
  end if;
  v_res := app_private.sign_simple('equipment_events', v_ev.id,
    case when p_type = 'calificacion' then 'aprobo' else 'ejecuto' end::public.signature_meaning, p_password, null,
    (select r from unnest(public.current_user_roles()) r
     join public.module_permissions mp on mp.role = r and mp.module_code = 'equipos_y_hoja_de_vida'
     where mp.can_sign or mp.can_approve limit 1));
  update public.equipment_events set locked_at = now() where id = v_ev.id and type <> 'limpieza';
  perform set_config('app.audit_reason', '', true);
  return v_res || jsonb_build_object('event_id', v_ev.id, 'valid', public.is_equipment_valid(e.id));
end;
$$;

-- La limpieza vale solo verificada por otra persona («Verifiqué»; AC-47).
create or replace function public.verify_cleaning(p_event uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ev public.equipment_events;
  v_res jsonb;
begin
  perform app_private.require_equipment('sign');
  select * into v_ev from public.equipment_events where id = p_event for update;
  if not found or v_ev.type <> 'limpieza' then
    raise exception 'RECORD_NOT_FOUND: no existe la limpieza';
  end if;
  if v_ev.verified_at is not null then
    raise exception 'INVALID_TRANSITION: la limpieza ya está verificada';
  end if;
  if v_ev.recorded_by = auth.uid() then
    raise exception 'SOD_VIOLATION: quien registró la limpieza no la verifica';
  end if;
  v_res := app_private.sign_simple('equipment_events', p_event, 'verifico', p_password, null,
    (select r from unnest(public.current_user_roles()) r
     join public.module_permissions mp on mp.role = r and mp.module_code = 'equipos_y_hoja_de_vida'
     where mp.can_sign limit 1));
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  perform set_config('app.audit_reason', 'Verificación de limpieza', true);
  update public.equipment_events set verified_by = auth.uid(), verified_at = now(), status = 'verificado', locked_at = now()
  where id = p_event;
  perform set_config('app.audit_reason', '', true);
  return v_res;
end;
$$;

-- Estado operativo con motivo; sacar o devolver un equipo de «fuera de servicio» lo aprueba Aseguramiento de la calidad.
create or replace function public.set_equipment_status(p_equipment uuid, p_status text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.equipment;
begin
  perform app_private.require_reason(p_reason);
  if p_status not in ('disponible', 'en_uso', 'en_limpieza', 'en_mantenimiento', 'fuera_de_servicio') then
    raise exception 'INVALID_FIELD: estado no válido';
  end if;
  select * into e from public.equipment where id = p_equipment for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el equipo';
  end if;
  perform app_private.require_equipment(case when 'fuera_de_servicio' in (p_status, e.status) then 'approve' else 'sign' end);
  if e.status = p_status then
    raise exception 'NO_CHANGE: el equipo ya está %', replace(p_status, '_', ' ');
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.equipment set status = p_status, status_reason = trim(p_reason) where id = e.id;
  insert into public.equipment_events (equipment_id, type, performed_on, status_from, status_to, notes, recorded_by, locked_at)
  values (e.id, 'cambio_estado', (public.reference_now() at time zone 'America/Bogota')::date, e.status, p_status, trim(p_reason),
    auth.uid(), now());
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Notificaciones y recordatorios (RF-51)
-- ---------------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Genera, una sola vez por umbral, los avisos de vencimiento de calibración, mantenimiento y calificación para quienes
-- registran equipos («C» en la matriz) y deja el correo en cola. La ejecuta pg_cron cada día (D-59).
create or replace function public.generate_equipment_reminders(p_at timestamptz default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (coalesce(p_at, public.reference_now()) at time zone 'America/Bogota')::date;
  v_thresholds int[];
  v_row record;
  v_t int;
  v_n int := 0;
  v_title text;
  v_notif uuid;
  v_user record;
begin
  -- Desde la interfaz solo la lanza Aseguramiento de la calidad; pg_cron la ejecuta sin sesión.
  if auth.uid() is not null then
    perform app_private.require_equipment('approve');
  end if;
  select array_agg((t #>> '{}')::int order by (t #>> '{}')::int) into v_thresholds
  from public.app_settings s, jsonb_array_elements(s.value) t where s.key = 'equipment_alert_days';
  v_thresholds := array_prepend(0, coalesce(v_thresholds, array[30, 15, 7]));

  for v_row in
    select e.id, e.code, e.name, k.kind, k.label, k.due
    from public.equipment e
    cross join lateral (
      select 'calibracion' as kind, 'Calibración' as label, (public.equipment_validity(e.id, p_at) ->> 'calibration_due')::date as due
      where e.requires_calibration
      union all
      select 'mantenimiento', 'Mantenimiento', (public.equipment_validity(e.id, p_at) ->> 'maintenance_due')::date
      union all
      select 'calificacion', 'Calificación', (public.equipment_validity(e.id, p_at) ->> 'qualification_due')::date
      where e.requires_qualification
    ) k
    where e.active and e.status <> 'fuera_de_servicio' and k.due is not null
  loop
    -- El umbral más urgente que ya se cruzó (0 = vencido).
    select min(t) into v_t from unnest(v_thresholds) t where (v_row.due - v_today) <= t;
    continue when v_t is null;
    v_title := case when v_row.due < v_today then v_row.label || ' de ' || v_row.code || ' vencida el ' || to_char(v_row.due, 'DD/MM/YYYY')
                    when v_row.due = v_today then v_row.label || ' de ' || v_row.code || ' vence hoy'
                    else v_row.label || ' de ' || v_row.code || ' vence en ' || (v_row.due - v_today) || ' días (' || to_char(v_row.due, 'DD/MM/YYYY') || ')' end;
    for v_user in
      select distinct p.id, p.email from public.profiles p
      join public.user_roles ur on ur.user_id = p.id and ur.revoked_at is null and (ur.expires_at is null or ur.expires_at > now())
      join public.module_permissions mp on mp.role = ur.role and mp.module_code = 'equipos_y_hoja_de_vida' and (mp.can_create or mp.can_approve)
      where p.active
    loop
      insert into public.notifications (user_id, kind, title, body, link, entity_table, entity_id, due_on, threshold_days)
      values (v_user.id, 'equipo_' || v_row.kind, v_title, v_row.name, '/equipos/' || v_row.code, 'equipment', v_row.id, v_row.due, v_t)
      on conflict (user_id, kind, entity_id, due_on, threshold_days) do nothing
      returning id into v_notif;
      if v_notif is not null then
        insert into public.email_outbox (notification_id, user_id, to_email, subject, body)
        values (v_notif, v_user.id, v_user.email, 'GRUFARCOL eBR · ' || v_title,
          v_title || '. Equipo ' || v_row.code || ' · ' || v_row.name || '. Revise su hoja de vida en la plataforma.');
        v_n := v_n + 1;
      end if;
      v_notif := null;
    end loop;
  end loop;
  return v_n;
end;
$$;

revoke execute on function public.save_equipment(uuid, jsonb, text) from public, anon;
revoke execute on function public.record_equipment_event(uuid, text, jsonb, text) from public, anon;
revoke execute on function public.verify_cleaning(uuid, text) from public, anon;
revoke execute on function public.set_equipment_status(uuid, text, text) from public, anon;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
revoke execute on function public.generate_equipment_reminders(timestamptz) from public, anon;
grant execute on function public.save_equipment(uuid, jsonb, text) to authenticated;
grant execute on function public.record_equipment_event(uuid, text, jsonb, text) to authenticated;
grant execute on function public.verify_cleaning(uuid, text) to authenticated;
grant execute on function public.set_equipment_status(uuid, text, text) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.generate_equipment_reminders(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Tarea programada diaria (D-59): 06:00 de Bogotá = 11:00 UTC. Si pg_cron no está disponible, se registra un aviso.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron no está disponible: los recordatorios de equipos no quedan programados (D-59)';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.schedule('grufarcol-equipment-reminders', '0 11 * * *', 'select public.generate_equipment_reminders()');
exception when others then
  raise notice 'No se pudo programar la tarea de recordatorios: % (D-59)', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Configuración: valida los días de alerta y las horas de limpieza por vencer
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_setting(p_key text, p_value jsonb, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_num numeric;
begin
  perform app_private.require_admin();
  perform app_private.require_reason(p_reason);
  if not exists (select 1 from public.app_settings where key = p_key) then
    raise exception 'RECORD_NOT_FOUND: no existe la configuración %', p_key;
  end if;

  if p_key in ('session_idle_minutes', 'login_max_failed_attempts', 'login_lockout_minutes',
               'sign_max_failed_attempts', 'sign_lockout_minutes', 'corrections_warning_threshold',
               'password_min_length', 'password_history_count', 'password_max_age_days') then
    if jsonb_typeof(p_value) <> 'number' then
      raise exception 'INVALID_FIELD: % debe ser un número', p_key;
    end if;
    v_num := (p_value #>> '{}')::numeric;
    if v_num <> trunc(v_num)
       or (p_key = 'session_idle_minutes' and v_num not between 1 and 480)
       or (p_key in ('login_max_failed_attempts', 'sign_max_failed_attempts') and v_num not between 1 and 20)
       or (p_key in ('login_lockout_minutes', 'sign_lockout_minutes') and v_num not between 1 and 1440)
       or (p_key = 'corrections_warning_threshold' and v_num not between 1 and 100)
       or (p_key = 'password_min_length' and v_num not between 12 and 128)
       or (p_key = 'password_history_count' and v_num not between 0 and 24)
       or (p_key = 'password_max_age_days' and v_num not between 0 and 3650) then
      raise exception 'INVALID_FIELD: valor fuera de rango para %', p_key;
    end if;
  elsif p_key = 'reauth_method' then
    if p_value #>> '{}' not in ('password', 'password_mfa') then
      raise exception 'INVALID_FIELD: método de reautenticación no válido';
    end if;
  elsif p_key in ('maquila_enabled', 'overdue_review_blocks_orders') then
    if jsonb_typeof(p_value) <> 'boolean' then
      raise exception 'INVALID_FIELD: % debe ser verdadero o falso', p_key;
    end if;
  elsif p_key = 'training_enforcement' then
    if p_value #>> '{}' not in ('avisar', 'bloquear') then
      raise exception 'INVALID_FIELD: la regla de capacitación es «avisar» o «bloquear» (D-19)';
    end if;
  elsif p_key in ('training_pass_score', 'document_due_soon_days') then
    if jsonb_typeof(p_value) <> 'number'
       or (p_key = 'training_pass_score' and (p_value #>> '{}')::numeric not between 1 and 100)
       or (p_key = 'document_due_soon_days' and (p_value #>> '{}')::numeric not between 1 and 365) then
      raise exception 'INVALID_FIELD: valor fuera de rango para %', p_key;
    end if;
  elsif p_key = 'style_forbidden_terms' then
    if jsonb_typeof(p_value) <> 'array' or exists (
      select 1 from jsonb_array_elements(p_value) t where jsonb_typeof(t) <> 'string' or length(trim(t #>> '{}')) = 0) then
      raise exception 'INVALID_FIELD: los términos del revisor de redacción son una lista de textos';
    end if;
  elsif p_key = 'equipment_alert_days' then
    -- RF-51: umbrales de recordatorio de vencimientos de equipos (días antes), p. ej. [30, 15, 7].
    if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) = 0 or exists (
      select 1 from jsonb_array_elements(p_value) t
      where jsonb_typeof(t) <> 'number' or (t #>> '{}')::numeric <> trunc((t #>> '{}')::numeric)
         or (t #>> '{}')::numeric not between 1 and 365) then
      raise exception 'INVALID_FIELD: los días de alerta son una lista de números enteros entre 1 y 365';
    end if;
  elsif p_key = 'cleaning_due_soon_hours' then
    if jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric not between 1 and 720 then
      raise exception 'INVALID_FIELD: valor fuera de rango para %', p_key;
    end if;
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.app_settings set value = p_value where key = p_key;
  perform set_config('app.audit_reason', '', true);
end;
$$;
