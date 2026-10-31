-- 0030_production_execution.sql · Etapa E7 (PRD F6): ejecución del lote.
-- RF-32 despeje (CLEARANCE_MISSING, AC-04), RF-39 limpieza (reutiliza la hoja de vida: equipment_events), RF-33
-- dispensación multi-lote (LOT_NOT_APPROVED AC-03, balanza válida, verificación por otra persona), RF-34 pasos con
-- equipos válidos (EQUIPMENT_NOT_VALID AC-05) y TRAINING_REQUIRED (AC-25), RF-35 control de peso, RF-36 inspección de
-- 9 puntos y devolución, RF-37 granel y rendimiento, borradores por campo y aviso de correcciones (AC-35).

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------
create table public.line_clearances (
  id uuid primary key default gen_random_uuid(),
  stage_order_id uuid not null references public.stage_orders (id),
  governing_version_id uuid references public.document_versions (id),
  checklist jsonb not null,
  status text not null default 'ejecutado' check (status in ('ejecutado', 'verificado')),
  executed_by uuid not null references public.profiles (id),
  executed_at timestamptz not null default now(),
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.cleaning_records (
  id uuid primary key default gen_random_uuid(),
  stage_order_id uuid not null references public.stage_orders (id),
  equipment_id uuid references public.equipment (id),
  equipment_event_id uuid references public.equipment_events (id),
  utensils jsonb not null default '[]',
  label_verified boolean not null check (label_verified),
  valid_until timestamptz not null,
  status text not null default 'ejecutado' check (status in ('ejecutado', 'verificado')),
  cleaned_by uuid not null references public.profiles (id),
  cleaned_at timestamptz not null default now(),
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (equipment_id is not null or jsonb_array_length(utensils) > 0)
);

create table public.dispensing_line_lots (
  id uuid primary key default gen_random_uuid(),
  stage_order_id uuid not null references public.stage_orders (id),
  request_line_id uuid not null references public.material_request_lines (id),
  lot_id uuid not null references public.material_lots (id),
  location_id uuid not null references public.storage_locations (id),
  movement_id uuid references public.inventory_movements (id),
  qty numeric(14, 4) not null check (qty > 0),
  tare numeric(14, 4),
  balance_id uuid not null references public.equipment (id),
  status text not null default 'dispensado' check (status in ('dispensado', 'verificado')),
  executed_by uuid not null references public.profiles (id),
  executed_at timestamptz not null default now(),
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.step_records (
  id uuid primary key default gen_random_uuid(),
  stage_order_id uuid not null references public.stage_orders (id),
  step_key text not null,
  presentation_id uuid references public.product_presentations (id),
  step_no int not null,
  label text not null,
  text text not null,
  values jsonb not null default '[]',
  out_of_range boolean not null default false,
  notes text,
  requires_verification boolean not null default false,
  status text not null default 'ejecutado' check (status in ('ejecutado', 'verificado')),
  executed_by uuid not null references public.profiles (id),
  executed_at timestamptz not null default now(),
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create unique index step_records_once on public.step_records (stage_order_id, step_key, coalesce(presentation_id, '00000000-0000-0000-0000-000000000000'));

create table public.step_equipment (
  id uuid primary key default gen_random_uuid(),
  step_record_id uuid not null references public.step_records (id),
  equipment_id uuid not null references public.equipment (id),
  validity jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Borrador por campo: lo guarda la interfaz en cada cambio (cola local + reintento); la hora la pone el servidor.
create table public.step_drafts (
  id uuid primary key default gen_random_uuid(),
  stage_order_id uuid not null references public.stage_orders (id),
  step_key text not null,
  presentation_id uuid references public.product_presentations (id),
  user_id uuid not null references public.profiles (id),
  values jsonb not null default '{}',
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create unique index step_drafts_once on public.step_drafts (stage_order_id, step_key, coalesce(presentation_id, '00000000-0000-0000-0000-000000000000'), user_id);

create table public.weight_controls (
  id uuid primary key default gen_random_uuid(),
  stage_order_id uuid not null references public.stage_orders (id),
  presentation_id uuid not null references public.product_presentations (id),
  sample_no int not null,
  sampled_at timestamptz not null default now(),
  value numeric(10, 2) not null,
  min_value numeric(10, 2) not null,
  max_value numeric(10, 2) not null,
  unit text not null default 'g',
  in_range boolean not null,
  action text,
  status text not null default 'registrado' check (status in ('registrado')),
  recorded_by uuid not null references public.profiles (id),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (stage_order_id, presentation_id, sample_no),
  check (in_range or length(trim(coalesce(action, ''))) > 0)
);

create table public.stage_outputs (
  id uuid primary key default gen_random_uuid(),
  stage_order_id uuid not null references public.stage_orders (id),
  presentation_id uuid references public.product_presentations (id),
  theoretical numeric(14, 4) not null check (theoretical > 0),
  received numeric(14, 4),
  actual numeric(14, 4) not null check (actual >= 0),
  rejected numeric(14, 4) not null default 0 check (rejected >= 0),
  retained numeric(14, 4) not null default 0 check (retained >= 0),
  remnant numeric(14, 4) not null default 0 check (remnant >= 0),
  unit text not null,
  pct numeric(7, 2) not null,
  limit_min numeric(7, 2),
  limit_max numeric(7, 2),
  within_limits boolean not null,
  status text not null default 'registrado' check (status in ('registrado')),
  recorded_by uuid not null references public.profiles (id),
  recorded_at timestamptz not null default now(),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create unique index stage_outputs_once on public.stage_outputs (stage_order_id, coalesce(presentation_id, '00000000-0000-0000-0000-000000000000'));
comment on table public.stage_outputs is
  'Conciliación de rendimiento por etapa y presentación (RF-37; yield_reconciliations del PRD).';

create table public.bulk_transfers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id),
  from_stage text not null,
  to_stage text not null,
  qty numeric(14, 4) not null check (qty > 0),
  unit text not null,
  label_code text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.pt_inspections (
  id uuid primary key default gen_random_uuid(),
  stage_order_id uuid not null references public.stage_orders (id),
  presentation_id uuid not null references public.product_presentations (id),
  points jsonb not null,
  result text not null check (result in ('conforme', 'no_conforme')),
  status text not null default 'firmada' check (status in ('firmada')),
  inspector_id uuid not null references public.profiles (id),
  inspected_at timestamptz not null default now(),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (stage_order_id, presentation_id)
);

create table public.material_returns (
  id uuid primary key default gen_random_uuid(),
  request_line_id uuid not null unique references public.material_request_lines (id),
  delivered numeric(14, 4) not null,
  used numeric(14, 4) not null check (used >= 0),
  damaged numeric(14, 4) not null check (damaged >= 0),
  returned numeric(14, 4) not null check (returned >= 0),
  balanced boolean not null,
  status text not null default 'registrada' check (status in ('registrada')),
  recorded_by uuid not null references public.profiles (id),
  recorded_at timestamptz not null default now(),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

select app_private.register_table('public.line_clearances', p_signable => true, p_no_delete => true);
select app_private.register_table('public.cleaning_records', p_signable => true, p_no_delete => true);
select app_private.register_table('public.dispensing_line_lots', p_signable => true, p_no_delete => true);
select app_private.register_table('public.step_records', p_signable => true, p_no_delete => true);
select app_private.register_table('public.step_equipment', p_append_only => true);
select app_private.register_table('public.step_drafts');
select app_private.register_table('public.weight_controls', p_signable => true, p_no_delete => true);
select app_private.register_table('public.stage_outputs', p_signable => true, p_no_delete => true);
select app_private.register_table('public.bulk_transfers', p_append_only => true);
select app_private.register_table('public.pt_inspections', p_signable => true, p_no_delete => true);
select app_private.register_table('public.material_returns', p_signable => true, p_no_delete => true);

insert into public.signable_tables (table_name, label, kind, is_execution, author_column, group_column) values
  ('line_clearances', 'Despeje de línea', 'despeje', true, 'executed_by', null),
  ('cleaning_records', 'Limpieza de equipos y utensilios', 'limpieza', true, 'cleaned_by', null),
  ('dispensing_line_lots', 'Dispensación', 'dispensacion', true, 'executed_by', null),
  ('step_records', 'Paso del registro de lote', 'paso', true, 'executed_by', null),
  ('weight_controls', 'Control de peso', 'control_peso', true, 'recorded_by', null),
  ('stage_outputs', 'Rendimiento de etapa', 'rendimiento', true, 'recorded_by', null),
  ('pt_inspections', 'Inspección de producto terminado', 'inspeccion_pt', true, 'inspector_id', null),
  ('material_returns', 'Devolución de material', 'devolucion', true, 'recorded_by', null);

-- Lectura: quien lee producción. Los borradores, solo su autor.
alter table public.line_clearances enable row level security;
alter table public.cleaning_records enable row level security;
alter table public.dispensing_line_lots enable row level security;
alter table public.step_records enable row level security;
alter table public.step_equipment enable row level security;
alter table public.step_drafts enable row level security;
alter table public.weight_controls enable row level security;
alter table public.stage_outputs enable row level security;
alter table public.bulk_transfers enable row level security;
alter table public.pt_inspections enable row level security;
alter table public.material_returns enable row level security;
create policy "production readers" on public.line_clearances for select to authenticated using (public.can_read_production());
create policy "production readers" on public.cleaning_records for select to authenticated using (public.can_read_production());
create policy "production readers" on public.dispensing_line_lots for select to authenticated using (public.can_read_production());
create policy "production readers" on public.step_records for select to authenticated using (public.can_read_production());
create policy "production readers" on public.step_equipment for select to authenticated using (public.can_read_production());
create policy "own drafts" on public.step_drafts for select to authenticated using (user_id = auth.uid());
create policy "production readers" on public.weight_controls for select to authenticated using (public.can_read_production());
create policy "production readers" on public.stage_outputs for select to authenticated using (public.can_read_production());
create policy "production readers" on public.bulk_transfers for select to authenticated using (public.can_read_production());
create policy "production readers" on public.pt_inspections for select to authenticated using (public.can_read_production());
create policy "production readers" on public.material_returns for select to authenticated using (public.can_read_production());
create policy "production readers read execution signatures" on public.signatures for select to authenticated
  using (record_table in ('line_clearances', 'cleaning_records', 'dispensing_line_lots', 'step_records', 'weight_controls',
                          'stage_outputs', 'pt_inspections', 'material_returns') and public.can_read_production());

-- ---------------------------------------------------------------------------
-- 2. Funciones internas
-- ---------------------------------------------------------------------------
-- Ejecutor (C de la matriz) o verificador (F sin C: coordinador o supervisor, D-46).
create or replace function app_private.require_executor()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_module_permission('dispensacion_fabricacion_envase_acond', 'create') then
    raise exception 'FORBIDDEN_ROLE: solo el personal de producción ejecuta los registros del lote (matriz 2.2)';
  end if;
end;
$$;

create or replace function app_private.require_verifier()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_module_permission('dispensacion_fabricacion_envase_acond', 'sign')
     or public.has_module_permission('dispensacion_fabricacion_envase_acond', 'create') then
    raise exception 'FORBIDDEN_ROLE: verifica el coordinador de producción o el supervisor (D-46)';
  end if;
end;
$$;

-- Verificación independiente de dispensación y pasos: cualquier firmante distinto de quien ejecutó (SOD-1, SOD-4).
create or replace function app_private.require_signer()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_module_permission('dispensacion_fabricacion_envase_acond', 'sign') then
    raise exception 'FORBIDDEN_ROLE: su rol no firma registros de producción (matriz 2.2)';
  end if;
end;
$$;
revoke execute on function app_private.require_signer() from public, anon, authenticated;

-- Orden de etapa en curso y lote no bloqueado.
create or replace function app_private.stage_in_progress(p_stage_order uuid)
returns public.stage_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stage_orders;
begin
  select * into s from public.stage_orders where id = p_stage_order for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la orden de etapa';
  end if;
  if s.status <> 'en_curso' then
    raise exception 'INVALID_TRANSITION: la etapa % está %; iníciela con su despeje verificado', s.code, s.status;
  end if;
  return s;
end;
$$;

-- Firma con significado y SOD (SOD-1, SOD-9), y deja el registro bloqueado si p_lock.
create or replace function app_private.sign_execution(p_table text, p_id uuid, p_meaning public.signature_meaning,
  p_password text, p_lock boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_res jsonb;
  v_auth jsonb;
begin
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', p_table) into v_row using p_id;
  perform public.check_sod(auth.uid(), p_table, p_id, p_meaning, v_row);
  v_res := app_private.sign_simple(p_table, p_id, p_meaning, p_password, null,
    coalesce(app_private.first_role(array['prod_aux', 'prod_coord']), (public.current_user_roles())[1]));
  if (v_res ->> 'ok')::boolean and p_lock then
    perform set_config('app.signing_record', p_table || ':' || p_id, true);
    execute format('update public.%I set locked_at = now() where id = $1', p_table) using p_id;
    perform set_config('app.signing_record', '', true);
  end if;
  return v_res;
end;
$$;

-- Pasos del registro de una etapa: instructivo del producto (fabricación) o plantilla congelada.
create or replace function app_private.stage_steps(p_stage_order uuid)
returns table (step_key text, order_no int, label text, text text, params jsonb, requires_equipment text,
               requires_verification boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id::text, s.order_no, s.label, s.text, s.params, s.requires_equipment, s.requires_verification
  from public.stage_orders so join public.instruction_steps s on s.instruction_id = so.instruction_id
  where so.id = p_stage_order
  union all
  select s.id::text, s.order_no, s.label, s.text, s.params, s.requires_equipment, s.requires_verification
  from public.stage_orders so join public.process_template_steps s on s.template_id = so.template_id
  where so.id = p_stage_order and so.instruction_id is null and not s.checklist_item
  order by 2;
$$;

create or replace function app_private.require_training_for(p_stage_order uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v uuid;
begin
  select governing_version_id into v from public.stage_orders where id = p_stage_order;
  if v is not null then
    perform public.assert_training(v, auth.uid());
  end if;
end;
$$;

-- Cambia el estado de un registro bloqueado (orden, etapa) sin tocar más columnas (DI-3).
create or replace function app_private.set_locked_status(p_table text, p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.signing_record', p_table || ':' || p_id, true);
  execute format('update public.%I set status = $2 where id = $1', p_table) using p_id, p_status;
  perform set_config('app.signing_record', '', true);
end;
$$;

revoke execute on function app_private.require_executor() from public, anon, authenticated;
revoke execute on function app_private.require_verifier() from public, anon, authenticated;
revoke execute on function app_private.stage_in_progress(uuid) from public, anon, authenticated;
revoke execute on function app_private.sign_execution(text, uuid, public.signature_meaning, text, boolean) from public, anon, authenticated;
revoke execute on function app_private.stage_steps(uuid) from public, anon, authenticated;
revoke execute on function app_private.require_training_for(uuid) from public, anon, authenticated;
revoke execute on function app_private.set_locked_status(text, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Despeje de línea (RF-32, AC-04)
-- ---------------------------------------------------------------------------
create or replace function public.execute_line_clearance(p_stage_order uuid, p_checklist jsonb, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stage_orders;
  v_tpl uuid;
  v_ver uuid;
  v_item jsonb;
  v_id uuid;
  v_res jsonb;
  v_auth jsonb;
begin
  perform app_private.require_executor();
  select * into s from public.stage_orders where id = p_stage_order;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la orden de etapa';
  end if;
  if s.status <> 'pendiente' then
    raise exception 'INVALID_TRANSITION: la etapa % ya está %', s.code, s.status;
  end if;
  if exists (select 1 from public.line_clearances where stage_order_id = s.id) then
    raise exception 'INVALID_TRANSITION: el despeje de % ya está registrado', s.code;
  end if;
  select (d ->> 'template_id')::uuid, (d ->> 'version_id')::uuid into v_tpl, v_ver
  from public.batches b, jsonb_array_elements(b.frozen_documents) d
  where b.id = s.batch_id and d ->> 'kind' = 'plantilla' and d ->> 'stage' = 'despeje';
  if v_ver is not null then
    perform public.assert_training(v_ver, auth.uid());
  end if;
  if jsonb_typeof(p_checklist) <> 'array' or jsonb_array_length(p_checklist) = 0 then
    raise exception 'INVALID_FIELD: el despeje exige su lista de verificación';
  end if;
  if v_tpl is not null and jsonb_array_length(p_checklist) <>
     (select count(*) from public.process_template_steps where template_id = v_tpl and checklist_item) then
    raise exception 'INVALID_FIELD: responda todos los puntos del despeje';
  end if;
  for v_item in select * from jsonb_array_elements(p_checklist) loop
    if not coalesce((v_item ->> 'ok')::boolean, false) then
      raise exception 'INVALID_FIELD: «%» no está conforme; corríjalo antes de firmar el despeje', v_item ->> 'item';
    end if;
  end loop;
  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  perform set_config('app.audit_reason', 'Despeje de línea ' || s.code, true);
  insert into public.line_clearances (stage_order_id, governing_version_id, checklist, executed_by)
  values (s.id, v_ver, p_checklist, auth.uid()) returning id into v_id;
  v_res := app_private.sign_execution('line_clearances', v_id, 'ejecuto', p_password, false);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  perform set_config('app.audit_reason', '', true);
  return v_res || jsonb_build_object('clearance_id', v_id);
end;
$$;

create or replace function public.verify_line_clearance(p_clearance uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.line_clearances;
  v_res jsonb;
  v_auth jsonb;
begin
  select * into c from public.line_clearances where id = p_clearance for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el despeje';
  end if;
  if c.status = 'verificado' then
    raise exception 'INVALID_TRANSITION: el despeje ya está verificado';
  end if;
  if c.executed_by = auth.uid() then
    raise exception 'SOD_VIOLATION: SOD-1: usted ejecutó el despeje; lo verifica otra persona';
  end if;
  perform app_private.require_verifier();
  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  perform set_config('app.audit_reason', 'Verificación del despeje', true);
  update public.line_clearances set status = 'verificado', verified_by = auth.uid(), verified_at = now() where id = c.id;
  v_res := app_private.sign_execution('line_clearances', c.id, 'verifico', p_password, true);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  perform set_config('app.audit_reason', '', true);
  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Limpieza de equipos y utensilios (RF-39): la del equipo queda en su hoja de vida
-- ---------------------------------------------------------------------------
create or replace function public.record_stage_cleaning(p_stage_order uuid, p_equipment uuid, p_data jsonb, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stage_orders;
  v_until timestamptz := nullif(p_data ->> 'valid_until', '')::timestamptz;
  v_ev jsonb;
  v_id uuid;
  v_res jsonb;
  v_auth jsonb;
begin
  perform app_private.require_executor();
  select * into s from public.stage_orders where id = p_stage_order;
  if not found or s.status = 'completada' then
    raise exception 'INVALID_TRANSITION: la etapa no admite registros de limpieza';
  end if;
  if not coalesce((p_data ->> 'label_verified')::boolean, false) then
    raise exception 'INVALID_FIELD: confirme que el rótulo de limpieza está colocado y verificado';
  end if;
  if v_until is null or v_until <= public.reference_now() then
    raise exception 'INVALID_FIELD: indique hasta cuándo es vigente la limpieza';
  end if;
  if p_equipment is null and jsonb_array_length(coalesce(p_data -> 'utensils', '[]')) = 0 then
    raise exception 'INVALID_FIELD: indique el equipo o los utensilios limpiados';
  end if;
  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  if p_equipment is not null then
    v_ev := public.record_equipment_event(p_equipment, 'limpieza', jsonb_build_object(
      'performed_on', (public.reference_now() at time zone 'America/Bogota')::date, 'valid_until', v_until,
      'notes', 'Limpieza antes de la etapa ' || s.code), p_password);
    if not (v_ev ->> 'ok')::boolean then
      return v_ev;
    end if;
  end if;
  perform set_config('app.audit_reason', 'Limpieza de la etapa ' || s.code, true);
  insert into public.cleaning_records (stage_order_id, equipment_id, equipment_event_id, utensils, label_verified,
    valid_until, cleaned_by)
  values (s.id, p_equipment, nullif(v_ev ->> 'event_id', '')::uuid, coalesce(p_data -> 'utensils', '[]'), true, v_until,
    auth.uid())
  returning id into v_id;
  v_res := app_private.sign_execution('cleaning_records', v_id, 'ejecuto', p_password, false);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  perform set_config('app.audit_reason', '', true);
  return v_res || jsonb_build_object('cleaning_id', v_id);
end;
$$;

create or replace function public.verify_stage_cleaning(p_cleaning uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cleaning_records;
  v_res jsonb;
  v_auth jsonb;
begin
  select * into c from public.cleaning_records where id = p_cleaning for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el registro de limpieza';
  end if;
  if c.status = 'verificado' then
    raise exception 'INVALID_TRANSITION: la limpieza ya está verificada';
  end if;
  if c.cleaned_by = auth.uid() then
    raise exception 'SOD_VIOLATION: SOD-1: usted registró la limpieza; la verifica otra persona';
  end if;
  perform app_private.require_verifier();
  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  if c.equipment_event_id is not null then
    v_res := public.verify_cleaning(c.equipment_event_id, p_password);
    if not (v_res ->> 'ok')::boolean then
      return v_res;
    end if;
  end if;
  update public.cleaning_records set status = 'verificado', verified_by = auth.uid(), verified_at = now() where id = c.id;
  v_res := app_private.sign_execution('cleaning_records', c.id, 'verifico', p_password, true);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Inicio de etapa (AC-04)
-- ---------------------------------------------------------------------------
create or replace function public.start_stage(p_stage_order uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stage_orders;
  b public.batches;
  o public.production_orders;
  v_prev public.stage_orders;
begin
  perform app_private.require_executor();
  select * into s from public.stage_orders where id = p_stage_order for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la orden de etapa';
  end if;
  if s.status <> 'pendiente' then
    raise exception 'INVALID_TRANSITION: la etapa % ya está %', s.code, s.status;
  end if;
  select * into b from public.batches where id = s.batch_id;
  select * into o from public.production_orders where id = b.order_id;
  if o.status not in ('aprobada', 'en_ejecucion') then
    raise exception 'INVALID_TRANSITION: la orden % no está aprobada', o.code;
  end if;
  select * into v_prev from public.stage_orders where batch_id = s.batch_id and order_no = s.order_no - 1;
  if found and v_prev.status <> 'completada' then
    raise exception 'INVALID_TRANSITION: primero se completa la etapa anterior (%)', v_prev.code;
  end if;
  if not exists (select 1 from public.line_clearances where stage_order_id = s.id and status = 'verificado') then
    raise exception 'CLEARANCE_MISSING: la etapa % no inicia sin el despeje de línea verificado por otra persona', s.code;
  end if;
  if not exists (select 1 from public.cleaning_records where stage_order_id = s.id and status = 'verificado') then
    raise exception 'CLEARANCE_MISSING: la etapa % no inicia sin la limpieza de equipos y utensilios verificada', s.code;
  end if;
  perform set_config('app.audit_reason', 'Inicio de la etapa ' || s.code, true);
  update public.stage_orders set status = 'en_curso', started_at = now(), started_by = auth.uid() where id = s.id;
  if b.status = 'creado' then
    update public.batches set status = 'en_proceso', started_at = now() where id = b.id;
  end if;
  if o.status = 'aprobada' then
    perform app_private.set_locked_status('production_orders', o.id, 'en_ejecucion');
  end if;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('ok', true, 'status', 'en_curso');
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Dispensación multi-lote (RF-33, AC-03)
-- ---------------------------------------------------------------------------
create or replace function public.dispense_lot(p_line uuid, p_lot uuid, p_qty numeric, p_balance uuid, p_tare numeric,
  p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.material_request_lines;
  r public.material_requests;
  s public.stage_orders;
  v_lot public.material_lots;
  v_loc uuid;
  v_mov uuid;
  v_id uuid;
  v_done numeric;
  v_tol numeric := coalesce((public.get_setting('dispensing_tolerance_pct') #>> '{}')::numeric, 0);
  v_res jsonb;
  v_auth jsonb;
begin
  perform app_private.require_executor();
  select * into l from public.material_request_lines where id = p_line;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la línea de la solicitud';
  end if;
  select * into r from public.material_requests where id = l.request_id;
  if r.type <> 'dispensacion' then
    raise exception 'INVALID_FIELD: la línea no es de dispensación';
  end if;
  select * into s from public.stage_orders where batch_id = r.batch_id and stage = 'dispensacion';
  s := app_private.stage_in_progress(s.id);
  perform app_private.require_training_for(s.id);
  if p_qty is null or p_qty <= 0 then
    raise exception 'INVALID_FIELD: indique el peso dispensado';
  end if;
  select * into v_lot from public.material_lots where id = p_lot;
  if not found or v_lot.material_id <> l.material_id then
    raise exception 'INVALID_FIELD: el lote no corresponde a la materia prima de la línea';
  end if;
  perform public.assert_lot_available(p_lot, p_qty);
  if not exists (select 1 from public.equipment where id = p_balance and equipment_type = 'balanza') then
    raise exception 'INVALID_FIELD: seleccione una balanza';
  end if;
  perform public.assert_equipment_valid(p_balance);
  select coalesce(sum(qty), 0) into v_done from public.dispensing_line_lots where request_line_id = l.id;
  if v_done + p_qty > l.required_qty * (1 + v_tol / 100) then
    raise exception 'INVALID_FIELD: la suma dispensada (% %) supera lo requerido (% %)', v_done + p_qty, l.unit, l.required_qty, l.unit;
  end if;
  -- Ubicación con saldo suficiente (primero la de menor saldo que alcance).
  select location_id into v_loc from public.stock_by_location where lot_id = p_lot and qty >= p_qty order by qty limit 1;
  if v_loc is null then
    raise exception 'INSUFFICIENT_STOCK: ninguna ubicación del lote % tiene % %', v_lot.internal_code, p_qty, l.unit;
  end if;
  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  perform set_config('app.audit_reason', 'Dispensación ' || r.code, true);
  insert into public.inventory_movements (lot_id, type, qty, from_location_id, ref_table, ref_id, ref_code, reason)
  values (p_lot, 'dispensacion', p_qty, v_loc, 'material_requests', r.id, r.code,
    'Dispensación para el lote ' || (select batch_code from public.batches where id = r.batch_id))
  returning id into v_mov;
  insert into public.dispensing_line_lots (stage_order_id, request_line_id, lot_id, location_id, movement_id, qty, tare,
    balance_id, executed_by)
  values (s.id, l.id, p_lot, v_loc, v_mov, p_qty, p_tare, p_balance, auth.uid()) returning id into v_id;
  v_res := app_private.sign_execution('dispensing_line_lots', v_id, 'ejecuto', p_password, false);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  perform set_config('app.audit_reason', '', true);
  return v_res || jsonb_build_object('dispensing_id', v_id, 'dispensed', v_done + p_qty, 'required', l.required_qty);
end;
$$;

create or replace function public.verify_dispensing(p_dispensing uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.dispensing_line_lots;
  v_res jsonb;
  v_auth jsonb;
begin
  perform app_private.require_signer();
  select * into d from public.dispensing_line_lots where id = p_dispensing for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la dispensación';
  end if;
  if d.status = 'verificado' then
    raise exception 'INVALID_TRANSITION: la dispensación ya está verificada';
  end if;
  if d.executed_by = auth.uid() then
    raise exception 'SOD_VIOLATION: SOD-4: usted dispensó este ítem; la verificación la hace otra persona';
  end if;
  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  update public.dispensing_line_lots set status = 'verificado', verified_by = auth.uid(), verified_at = now() where id = d.id;
  v_res := app_private.sign_execution('dispensing_line_lots', d.id, 'verifico', p_password, true);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Pasos del registro (RF-34, RF-35, AC-05, AC-25) y borradores
-- ---------------------------------------------------------------------------
create or replace function public.save_step_draft(p_stage_order uuid, p_step_key text, p_presentation uuid, p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  perform app_private.require_executor();
  if not exists (select 1 from public.stage_orders where id = p_stage_order and status in ('pendiente', 'en_curso')) then
    raise exception 'INVALID_TRANSITION: la etapa no admite borradores';
  end if;
  insert into public.step_drafts (stage_order_id, step_key, presentation_id, user_id, values)
  values (p_stage_order, p_step_key, p_presentation, auth.uid(), coalesce(p_values, '{}'))
  on conflict (stage_order_id, step_key, coalesce(presentation_id, '00000000-0000-0000-0000-000000000000'), user_id)
  do update set values = public.step_drafts.values || excluded.values, saved_at = now()
  returning saved_at into v_at;
  return jsonb_build_object('ok', true, 'saved_at', v_at);
end;
$$;

-- Límites del peso neto: parámetro «Peso neto» de la plantilla para esa presentación o ± tolerancia (D-66).
create or replace function app_private.fill_limits(p_stage_order uuid, p_presentation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.product_presentations;
  v_param jsonb;
  v_tol numeric := coalesce((public.get_setting('fill_weight_tolerance_pct') #>> '{}')::numeric, 1.5);
begin
  select * into p from public.product_presentations where id = p_presentation;
  select prm into v_param from app_private.stage_steps(p_stage_order) x, jsonb_array_elements(x.params) prm
  where prm ->> 'name' = 'Peso neto' and x.text ilike '%' || p.name || '%' limit 1;
  if v_param is not null then
    return jsonb_build_object('min', (v_param ->> 'min')::numeric, 'max', (v_param ->> 'max')::numeric, 'unit', 'g',
      'source', 'plantilla');
  end if;
  return jsonb_build_object('min', round(p.net_content * (1 - v_tol / 100), 1), 'max', round(p.net_content * (1 + v_tol / 100), 1),
    'unit', 'g', 'source', 'tolerancia');
end;
$$;
revoke execute on function app_private.fill_limits(uuid, uuid) from public, anon, authenticated;

-- p_values: {"<nombre del parámetro>": número}; p_equipment: equipos usados (códigos exigidos por el paso).
create or replace function public.complete_step(p_stage_order uuid, p_step_key text, p_presentation uuid, p_values jsonb,
  p_equipment uuid[], p_notes text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stage_orders;
  st record;
  v_prev record;
  v_param jsonb;
  v_val numeric;
  v_vals jsonb := '[]';
  v_oor boolean := false;
  v_in boolean;
  v_code text;
  v_eq public.equipment;
  v_id uuid;
  v_res jsonb;
  v_batch text;
  v_auth jsonb;
begin
  perform app_private.require_executor();
  s := app_private.stage_in_progress(p_stage_order);
  if s.stage = 'dispensacion' then
    raise exception 'INVALID_FIELD: la dispensación se registra por lotes';
  end if;
  if s.stage in ('envase', 'acondicionamiento') and p_presentation is null then
    raise exception 'INVALID_FIELD: indique la presentación';
  end if;
  perform app_private.require_training_for(s.id);
  select * into st from app_private.stage_steps(s.id) x where x.step_key = p_step_key;
  if not found then
    raise exception 'RECORD_NOT_FOUND: el paso no pertenece a la versión congelada del registro';
  end if;
  if exists (select 1 from public.step_records where stage_order_id = s.id and step_key = p_step_key
             and presentation_id is not distinct from p_presentation) then
    raise exception 'INVALID_TRANSITION: el paso % ya está registrado', st.label;
  end if;
  select * into v_prev from app_private.stage_steps(s.id) x
  where x.order_no < st.order_no and not exists (
    select 1 from public.step_records r where r.stage_order_id = s.id and r.step_key = x.step_key
      and r.presentation_id is not distinct from p_presentation)
  order by x.order_no limit 1;
  if found then
    raise exception 'INVALID_TRANSITION: primero se registra el paso %', v_prev.label;
  end if;

  -- Equipos exigidos por el paso: deben estar en la lista y ser válidos ahora (calibración, limpieza…).
  if st.requires_equipment is not null then
    foreach v_code in array string_to_array(replace(st.requires_equipment, ' ', ''), ',') loop
      if not exists (select 1 from public.equipment e where e.code = v_code and e.id = any(coalesce(p_equipment, '{}'))) then
        raise exception 'INVALID_FIELD: el paso % se ejecuta con %; regístrelo', st.label, v_code;
      end if;
    end loop;
  end if;
  for v_eq in select * from public.equipment where id = any(coalesce(p_equipment, '{}')) loop
    perform public.assert_equipment_valid(v_eq.id);
  end loop;

  for v_param in select * from jsonb_array_elements(st.params) loop
    if s.stage = 'envase' and v_param ->> 'name' = 'Peso neto' then
      v_param := v_param || app_private.fill_limits(s.id, p_presentation);
    end if;
    begin
      v_val := (p_values ->> (v_param ->> 'name'))::numeric;
    exception when others then
      raise exception 'INVALID_FIELD: «%» debe ser un número', v_param ->> 'name';
    end;
    if v_val is null then
      raise exception 'INVALID_FIELD: registre «%»', v_param ->> 'name';
    end if;
    v_in := (v_param ->> 'min' is null or v_val >= (v_param ->> 'min')::numeric)
        and (v_param ->> 'max' is null or v_val <= (v_param ->> 'max')::numeric);
    v_oor := v_oor or not v_in;
    v_vals := v_vals || (v_param || jsonb_build_object('value', v_val, 'in_range', v_in));
  end loop;

  select batch_code into v_batch from public.batches where id = s.batch_id;
  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  perform set_config('app.audit_reason', 'Registro de ' || s.code || ', paso ' || st.label, true);
  insert into public.step_records (stage_order_id, step_key, presentation_id, step_no, label, text, values, out_of_range,
    notes, requires_verification, executed_by)
  values (s.id, p_step_key, p_presentation, st.order_no, st.label, st.text, v_vals, v_oor, nullif(trim(p_notes), ''),
    st.requires_verification, auth.uid())
  returning id into v_id;
  insert into public.step_equipment (step_record_id, equipment_id, validity)
  select v_id, e.id, public.equipment_validity(e.id) from public.equipment e where e.id = any(coalesce(p_equipment, '{}'));
  -- Uso del equipo en su hoja de vida (lotes en que se usó).
  insert into public.equipment_events (equipment_id, type, performed_on, batch_ref, notes, recorded_by, locked_at)
  select e.id, 'uso', (public.reference_now() at time zone 'America/Bogota')::date, v_batch, s.code || ' · paso ' || st.label,
    auth.uid(), now()
  from public.equipment e where e.id = any(coalesce(p_equipment, '{}'));
  v_res := app_private.sign_execution('step_records', v_id, 'ejecuto', p_password, not st.requires_verification);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  delete from public.step_drafts where stage_order_id = s.id and step_key = p_step_key
    and presentation_id is not distinct from p_presentation and user_id = auth.uid();
  perform set_config('app.audit_reason', '', true);
  return v_res || jsonb_build_object('step_record_id', v_id, 'out_of_range', v_oor, 'values', v_vals);
end;
$$;

create or replace function public.verify_step(p_record uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.step_records;
  v_res jsonb;
  v_auth jsonb;
begin
  perform app_private.require_signer();
  select * into r from public.step_records where id = p_record for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el paso';
  end if;
  if r.status = 'verificado' or not r.requires_verification then
    raise exception 'INVALID_TRANSITION: el paso no requiere verificación pendiente';
  end if;
  if r.executed_by = auth.uid() then
    raise exception 'SOD_VIOLATION: SOD-1: usted ejecutó este paso; lo verifica otra persona';
  end if;
  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  update public.step_records set status = 'verificado', verified_by = auth.uid(), verified_at = now() where id = r.id;
  v_res := app_private.sign_execution('step_records', r.id, 'verifico', p_password, true);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  return v_res;
end;
$$;


create or replace function public.record_weight_control(p_stage_order uuid, p_presentation uuid, p_value numeric, p_action text,
  p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stage_orders;
  v_lim jsonb;
  v_in boolean;
  v_id uuid;
  v_no int;
  v_res jsonb;
  v_auth jsonb;
begin
  perform app_private.require_executor();
  s := app_private.stage_in_progress(p_stage_order);
  if s.stage <> 'envase' then
    raise exception 'INVALID_FIELD: el control de peso es de la etapa de envase';
  end if;
  perform app_private.require_training_for(s.id);
  if p_value is null or p_value <= 0 then
    raise exception 'INVALID_FIELD: registre el peso neto';
  end if;
  v_lim := app_private.fill_limits(s.id, p_presentation);
  v_in := p_value between (v_lim ->> 'min')::numeric and (v_lim ->> 'max')::numeric;
  if not v_in and length(trim(coalesce(p_action, ''))) = 0 then
    raise exception 'INVALID_FIELD: % g está fuera del rango %–% g; registre la acción tomada', p_value, v_lim ->> 'min', v_lim ->> 'max';
  end if;
  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  select coalesce(max(sample_no), 0) + 1 into v_no from public.weight_controls
  where stage_order_id = s.id and presentation_id = p_presentation;
  insert into public.weight_controls (stage_order_id, presentation_id, sample_no, value, min_value, max_value, in_range,
    action, recorded_by)
  values (s.id, p_presentation, v_no, p_value, (v_lim ->> 'min')::numeric, (v_lim ->> 'max')::numeric, v_in,
    nullif(trim(p_action), ''), auth.uid())
  returning id into v_id;
  v_res := app_private.sign_execution('weight_controls', v_id, 'ejecuto', p_password, true);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  return v_res || jsonb_build_object('control_id', v_id, 'in_range', v_in, 'min', v_lim -> 'min', 'max', v_lim -> 'max');
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Rendimiento, inspección, devolución y codificado (RF-36, RF-37)
-- ---------------------------------------------------------------------------
-- p_data: fabricación {actual, remnant}; envase {actual, rejected}; acondicionamiento {received, rejected, retained}.
create or replace function public.record_stage_output(p_stage_order uuid, p_presentation uuid, p_data jsonb, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stage_orders;
  b public.batches;
  o public.production_orders;
  v_pres jsonb;
  v_theo numeric;
  v_actual numeric;
  v_received numeric := nullif(p_data ->> 'received', '')::numeric;
  v_rej numeric := coalesce(nullif(p_data ->> 'rejected', '')::numeric, 0);
  v_ret numeric := coalesce(nullif(p_data ->> 'retained', '')::numeric, 0);
  v_rem numeric := coalesce(nullif(p_data ->> 'remnant', '')::numeric, 0);
  v_unit text;
  v_pct numeric;
  v_min numeric;
  v_id uuid;
  v_res jsonb;
  v_auth jsonb;
begin
  perform app_private.require_executor();
  s := app_private.stage_in_progress(p_stage_order);
  select * into b from public.batches where id = s.batch_id;
  select * into o from public.production_orders where id = b.order_id;
  if s.stage = 'dispensacion' then
    raise exception 'INVALID_FIELD: la dispensación no tiene rendimiento';
  end if;
  if s.stage = 'fabricacion' then
    if p_presentation is not null then
      raise exception 'INVALID_FIELD: el rendimiento de fabricación es del granel';
    end if;
    v_theo := b.batch_size;
    v_unit := b.batch_unit;
    v_actual := nullif(p_data ->> 'actual', '')::numeric;
  else
    select pr into v_pres from jsonb_array_elements(o.presentations) pr where (pr ->> 'presentation_id')::uuid = p_presentation;
    if v_pres is null then
      raise exception 'INVALID_FIELD: la presentación no está en la orden';
    end if;
    v_theo := (v_pres ->> 'units')::numeric;
    v_unit := 'und';
    if s.stage = 'envase' then
      v_actual := nullif(p_data ->> 'actual', '')::numeric;
    else
      if v_received is null then
        raise exception 'INVALID_FIELD: indique las unidades recibidas de envase';
      end if;
      v_actual := v_received - v_rej - v_ret;
      v_min := coalesce((public.get_setting('yield_min_pt_pct') #>> '{}')::numeric, 97);
    end if;
  end if;
  if v_actual is null or v_actual < 0 then
    raise exception 'INVALID_FIELD: las cantidades no cuadran; revise lo registrado';
  end if;
  v_pct := round(v_actual * 100 / v_theo, 1);
  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  perform set_config('app.audit_reason', 'Rendimiento de ' || s.code, true);
  insert into public.stage_outputs (stage_order_id, presentation_id, theoretical, received, actual, rejected, retained, remnant,
    unit, pct, limit_min, within_limits, recorded_by)
  values (s.id, p_presentation, v_theo, v_received, v_actual, v_rej, v_ret, v_rem, v_unit, v_pct, v_min,
    v_min is null or v_pct >= v_min, auth.uid())
  returning id into v_id;
  v_res := app_private.sign_execution('stage_outputs', v_id, 'ejecuto', p_password, true);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  perform set_config('app.audit_reason', '', true);
  return v_res || jsonb_build_object('output_id', v_id, 'pct', v_pct, 'actual', v_actual, 'within_limits', v_min is null or v_pct >= v_min);
end;
$$;

-- Inspección de producto terminado de 9 puntos (RF-36, D-47): la firma el coordinador o el supervisor.
create or replace function public.record_pt_inspection(p_stage_order uuid, p_presentation uuid, p_points jsonb, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stage_orders;
  v_id uuid;
  v_res jsonb;
  v_result text;
  v_auth jsonb;
begin
  perform app_private.require_verifier();
  s := app_private.stage_in_progress(p_stage_order);
  if s.stage <> 'acondicionamiento' then
    raise exception 'INVALID_FIELD: la inspección de producto terminado es del acondicionamiento';
  end if;
  if jsonb_typeof(p_points) <> 'array' or jsonb_array_length(p_points) <> 9
     or exists (select 1 from jsonb_array_elements(p_points) x where x ->> 'result' not in ('conforme', 'no_conforme')
                or x ->> 'result' is null) then
    raise exception 'INVALID_FIELD: los 9 puntos de la inspección deben tener resultado';
  end if;
  v_result := case when exists (select 1 from jsonb_array_elements(p_points) x where x ->> 'result' = 'no_conforme')
    then 'no_conforme' else 'conforme' end;
  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  insert into public.pt_inspections (stage_order_id, presentation_id, points, result, inspector_id)
  values (s.id, p_presentation, p_points, v_result, auth.uid()) returning id into v_id;
  v_res := app_private.sign_execution('pt_inspections', v_id, 'verifico', p_password, true);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  return v_res || jsonb_build_object('inspection_id', v_id, 'result', v_result);
end;
$$;

-- Devolución de material de acondicionamiento: entregado = usado + dañado + devuelto (D-48).
create or replace function public.record_material_return(p_line uuid, p_data jsonb, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.material_request_lines;
  r public.material_requests;
  s public.stage_orders;
  v_del numeric;
  v_used numeric := nullif(p_data ->> 'used', '')::numeric;
  v_dam numeric := coalesce(nullif(p_data ->> 'damaged', '')::numeric, 0);
  v_ret numeric := coalesce(nullif(p_data ->> 'returned', '')::numeric, 0);
  v_tol numeric := coalesce((public.get_setting('material_return_tolerance_units') #>> '{}')::numeric, 0);
  v_id uuid;
  v_res jsonb;
  v_auth jsonb;
begin
  perform app_private.require_executor();
  select * into l from public.material_request_lines where id = p_line;
  select * into r from public.material_requests where id = l.request_id;
  if r.type <> 'acondicionamiento' then
    raise exception 'INVALID_FIELD: la devolución es del material de acondicionamiento';
  end if;
  select * into s from public.stage_orders where batch_id = r.batch_id and stage = 'acondicionamiento';
  s := app_private.stage_in_progress(s.id);
  v_del := coalesce(nullif(p_data ->> 'delivered', '')::numeric, l.required_qty);
  if v_used is null then
    raise exception 'INVALID_FIELD: indique lo usado';
  end if;
  if abs(v_del - v_used - v_dam - v_ret) > v_tol then
    raise exception 'INVALID_FIELD: la devolución no cuadra: % + % + % = % y se entregaron %', v_used, v_dam, v_ret,
      v_used + v_dam + v_ret, v_del;
  end if;
  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  insert into public.material_returns (request_line_id, delivered, used, damaged, returned, balanced, recorded_by)
  values (l.id, v_del, v_used, v_dam, v_ret, true, auth.uid()) returning id into v_id;
  v_res := app_private.sign_execution('material_returns', v_id, 'ejecuto', p_password, true);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  return v_res || jsonb_build_object('return_id', v_id);
end;
$$;

create or replace function public.verify_coding(p_batch uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.coding_orders;
  s public.stage_orders;
  v_res jsonb;
  v_auth jsonb;
begin
  perform app_private.require_executor();
  select * into s from public.stage_orders where batch_id = p_batch and stage = 'acondicionamiento';
  s := app_private.stage_in_progress(s.id);
  select * into c from public.coding_orders where batch_id = p_batch for update;
  if c.status = 'verificada' then
    raise exception 'INVALID_TRANSITION: la codificación ya está verificada';
  end if;
  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  update public.coding_orders set status = 'verificada', verified_by = auth.uid(), verified_at = now() where id = c.id;
  v_res := app_private.sign_execution('coding_orders', c.id, 'ejecuto', p_password, true);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Cierre de etapa: todo registrado y verificado; transferencia de granel (RF-37)
-- ---------------------------------------------------------------------------
create or replace function public.complete_stage(p_stage_order uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stage_orders;
  b public.batches;
  o public.production_orders;
  v_missing text[] := '{}';
  v_p jsonb;
  v_out public.stage_outputs;
  v_next text;
  v_res jsonb;
  v_auth jsonb;
begin
  perform app_private.require_executor();
  s := app_private.stage_in_progress(p_stage_order);
  select * into b from public.batches where id = s.batch_id;
  select * into o from public.production_orders where id = b.order_id;

  if s.stage = 'dispensacion' then
    select array_agg(m.name || ' (' || coalesce(d.done, 0) || ' de ' || l.required_qty || ' ' || l.unit || ')') into v_missing
    from public.material_request_lines l
    join public.material_requests r on r.id = l.request_id and r.batch_id = b.id and r.type = 'dispensacion'
    join public.materials m on m.id = l.material_id
    left join lateral (select sum(x.qty) as done, bool_and(x.status = 'verificado') as ok
                       from public.dispensing_line_lots x where x.request_line_id = l.id) d on true
    where coalesce(d.done, 0) < l.required_qty * (1 - coalesce((public.get_setting('dispensing_tolerance_pct') #>> '{}')::numeric, 0) / 100)
       or not coalesce(d.ok, false);
  else
    select array_agg('paso ' || x.label || ' «' || x.text || '»' || coalesce(' · ' || (p.v ->> 'name'), '')) into v_missing
    from app_private.stage_steps(s.id) x
    left join lateral (select v from jsonb_array_elements(o.presentations) v where s.stage in ('envase', 'acondicionamiento')) p on true
    where not exists (select 1 from public.step_records r where r.stage_order_id = s.id and r.step_key = x.step_key
                        and r.presentation_id is not distinct from (p.v ->> 'presentation_id')::uuid
                        and (r.status = 'verificado' or not r.requires_verification));
    if exists (select 1 from public.step_records where stage_order_id = s.id and out_of_range) then
      v_missing := v_missing || 'valores fuera de rango que exigen desviación (F8)'::text;
    end if;
    if s.stage = 'fabricacion' and not exists (select 1 from public.stage_outputs where stage_order_id = s.id) then
      v_missing := v_missing || 'rendimiento del granel'::text;
    end if;
    if s.stage in ('envase', 'acondicionamiento') then
      for v_p in select * from jsonb_array_elements(o.presentations) loop
        if not exists (select 1 from public.stage_outputs where stage_order_id = s.id
                       and presentation_id = (v_p ->> 'presentation_id')::uuid) then
          v_missing := v_missing || ('rendimiento de ' || (v_p ->> 'name'));
        end if;
        if s.stage = 'envase' and not exists (select 1 from public.weight_controls where stage_order_id = s.id
                       and presentation_id = (v_p ->> 'presentation_id')::uuid) then
          v_missing := v_missing || ('controles de peso de ' || (v_p ->> 'name'));
        end if;
        if s.stage = 'acondicionamiento' and not exists (select 1 from public.pt_inspections where stage_order_id = s.id
                       and presentation_id = (v_p ->> 'presentation_id')::uuid) then
          v_missing := v_missing || ('inspección de producto terminado de ' || (v_p ->> 'name'));
        end if;
      end loop;
    end if;
    if s.stage = 'acondicionamiento' then
      if not exists (select 1 from public.coding_orders where batch_id = b.id and status = 'verificada') then
        v_missing := v_missing || 'verificación de la codificación'::text;
      end if;
      if exists (select 1 from public.material_request_lines l join public.material_requests r on r.id = l.request_id
                 where r.batch_id = b.id and r.type = 'acondicionamiento'
                   and not exists (select 1 from public.material_returns m where m.request_line_id = l.id)) then
        v_missing := v_missing || 'devolución del material de acondicionamiento'::text;
      end if;
    end if;
    if exists (select 1 from public.stage_outputs where stage_order_id = s.id and not within_limits) then
      v_missing := v_missing || 'rendimiento fuera de límites que exige desviación (F8)'::text;
    end if;
  end if;
  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'INVALID_TRANSITION: falta para cerrar %: %', s.code, array_to_string(v_missing, '; ');
  end if;

  v_auth := app_private.verify_reauth(auth.uid(), p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;
  perform set_config('app.audit_reason', 'Cierre de la etapa ' || s.code, true);
  update public.stage_orders set status = 'completada', completed_at = now(), completed_by = auth.uid() where id = s.id;
  v_res := app_private.sign_execution('stage_orders', s.id, 'ejecuto', p_password, true);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'REAUTH_FAILED: contraseña incorrecta';
  end if;
  -- Transferencia de granel con su rótulo (RF-37).
  if s.stage = 'fabricacion' then
    select * into v_out from public.stage_outputs where stage_order_id = s.id;
    insert into public.bulk_transfers (batch_id, from_stage, to_stage, qty, unit, label_code)
    values (b.id, 'fabricacion', 'envase', v_out.actual, v_out.unit, 'GR-' || b.batch_code);
  elsif s.stage = 'envase' then
    insert into public.bulk_transfers (batch_id, from_stage, to_stage, qty, unit, label_code)
    select b.id, 'envase', 'acondicionamiento', sum(actual), 'und', 'GE-' || b.batch_code
    from public.stage_outputs where stage_order_id = s.id;
  elsif s.stage = 'acondicionamiento' then
    update public.batches set status = 'en_revision', completed_at = now() where id = b.id;
    perform app_private.set_locked_status('production_orders', o.id, 'cerrada');
    update public.material_requests set status = 'cerrada' where batch_id = b.id;
  end if;
  perform set_config('app.audit_reason', '', true);
  return v_res || jsonb_build_object('status', 'completada');
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Aviso al verificador y a Calidad al superar el umbral de correcciones (DI-12, AC-35)
-- ---------------------------------------------------------------------------
create or replace function app_private.notify_corrections()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_threshold int := coalesce((public.get_setting('corrections_warning_threshold'))::int, 5);
  v_label text;
  v_batch text;
begin
  if new.record_table not in ('line_clearances', 'cleaning_records', 'dispensing_line_lots', 'step_records',
                              'weight_controls', 'stage_outputs', 'pt_inspections', 'material_returns') then
    return new;
  end if;
  select count(*) into v_count from public.corrections where record_table = new.record_table and record_id = new.record_id;
  if v_count <> v_threshold + 1 then
    return new;
  end if;
  select label into v_label from public.signable_tables where table_name = new.record_table;
  execute format('select b.batch_code from public.%I t join public.stage_orders so on so.id = t.stage_order_id
                  join public.batches b on b.id = so.batch_id where t.id = $1', new.record_table)
    into v_batch using new.record_id;
  insert into public.notifications (user_id, kind, title, body, link, entity_table, entity_id, threshold_days)
  select distinct p.id, 'correcciones',
    v_label || coalesce(' del lote ' || v_batch, '') || ': ' || v_count || ' correcciones',
    'Supera el umbral de ' || v_threshold || ' correcciones (DI-12). Revise el registro antes de verificarlo.',
    '/produccion/lotes', new.record_table, new.record_id, v_count
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.revoked_at is null and (ur.expires_at is null or ur.expires_at > now())
  join public.module_permissions mp on mp.role::text = ur.role::text
  where p.active and (
    (mp.module_code = 'dispensacion_fabricacion_envase_acond' and mp.can_sign and not mp.can_create)
    or ur.role::text = 'aq_dir')
  on conflict do nothing;
  return new;
end;
$$;
create trigger corrections_notify after insert on public.corrections
  for each row execute function app_private.notify_corrections();

-- Correcciones: el autor del registro o el verificador (sign_permissions) pueden corregir.
insert into public.sign_permissions (table_name, meaning, role)
select t, 'verifico', 'prod_coord'
from unnest(array['line_clearances', 'cleaning_records', 'dispensing_line_lots', 'step_records', 'weight_controls',
                  'stage_outputs', 'pt_inspections', 'material_returns']) t;

-- ---------------------------------------------------------------------------
-- 11. Tablero (S-16)
-- ---------------------------------------------------------------------------
create or replace view public.v_production_board
with (security_invoker = true)
as
select b.id as batch_id, b.batch_code, b.status as batch_status, b.batch_size, b.batch_unit, b.expiry_date,
  o.id as order_id, o.code as order_code, o.status as order_status, o.planned_date, o.presentations,
  p.code as product_code, p.name as product_name, o.created_by,
  (select so.stage from public.stage_orders so where so.batch_id = b.id and so.status <> 'completada' order by so.order_no limit 1)
    as current_stage,
  (select so.status from public.stage_orders so where so.batch_id = b.id and so.status <> 'completada' order by so.order_no limit 1)
    as current_stage_status,
  o.created_at
from public.batches b
join public.production_orders o on o.id = b.order_id
join public.products p on p.id = b.product_id;
revoke all on public.v_production_board from anon;

-- Pasos congelados de una etapa para la interfaz (lectura).
create or replace function public.production_stage_steps(p_stage_order uuid)
returns table (step_key text, order_no int, label text, text text, params jsonb, requires_equipment text,
               requires_verification boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select * from app_private.stage_steps(p_stage_order) where public.can_read_production();
$$;
revoke execute on function public.production_stage_steps(uuid) from public, anon;
grant execute on function public.production_stage_steps(uuid) to authenticated;

-- Límites del peso neto de una presentación en envase (para la interfaz).
create or replace function public.production_fill_limits(p_stage_order uuid, p_presentation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.fill_limits(p_stage_order, p_presentation) where public.can_read_production();
$$;
revoke execute on function public.production_fill_limits(uuid, uuid) from public, anon;
grant execute on function public.production_fill_limits(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Permisos de ejecución
-- ---------------------------------------------------------------------------
revoke execute on function public.execute_line_clearance(uuid, jsonb, text) from public, anon;
revoke execute on function public.verify_line_clearance(uuid, text) from public, anon;
revoke execute on function public.record_stage_cleaning(uuid, uuid, jsonb, text) from public, anon;
revoke execute on function public.verify_stage_cleaning(uuid, text) from public, anon;
revoke execute on function public.start_stage(uuid) from public, anon;
revoke execute on function public.dispense_lot(uuid, uuid, numeric, uuid, numeric, text) from public, anon;
revoke execute on function public.verify_dispensing(uuid, text) from public, anon;
revoke execute on function public.save_step_draft(uuid, text, uuid, jsonb) from public, anon;
revoke execute on function public.complete_step(uuid, text, uuid, jsonb, uuid[], text, text) from public, anon;
revoke execute on function public.verify_step(uuid, text) from public, anon;
revoke execute on function public.record_weight_control(uuid, uuid, numeric, text, text) from public, anon;
revoke execute on function public.record_stage_output(uuid, uuid, jsonb, text) from public, anon;
revoke execute on function public.record_pt_inspection(uuid, uuid, jsonb, text) from public, anon;
revoke execute on function public.record_material_return(uuid, jsonb, text) from public, anon;
revoke execute on function public.verify_coding(uuid, text) from public, anon;
revoke execute on function public.complete_stage(uuid, text) from public, anon;
grant execute on function public.execute_line_clearance(uuid, jsonb, text) to authenticated;
grant execute on function public.verify_line_clearance(uuid, text) to authenticated;
grant execute on function public.record_stage_cleaning(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.verify_stage_cleaning(uuid, text) to authenticated;
grant execute on function public.start_stage(uuid) to authenticated;
grant execute on function public.dispense_lot(uuid, uuid, numeric, uuid, numeric, text) to authenticated;
grant execute on function public.verify_dispensing(uuid, text) to authenticated;
grant execute on function public.save_step_draft(uuid, text, uuid, jsonb) to authenticated;
grant execute on function public.complete_step(uuid, text, uuid, jsonb, uuid[], text, text) to authenticated;
grant execute on function public.verify_step(uuid, text) to authenticated;
grant execute on function public.record_weight_control(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.record_stage_output(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.record_pt_inspection(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.record_material_return(uuid, jsonb, text) to authenticated;
grant execute on function public.verify_coding(uuid, text) to authenticated;
grant execute on function public.complete_stage(uuid, text) to authenticated;
