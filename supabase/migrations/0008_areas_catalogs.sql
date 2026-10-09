-- 0008_areas_catalogs.sql · Etapa E2 (administración)
-- Áreas de la empresa con sigla de proceso (PRD 2.5.2, RF-06) y catálogos versionados con bitácora
-- (RF-04): genéricos, líneas de producto, perfiles regulatorios (PRD §10), retención (RNF-05) y marcas.

-- ---------------------------------------------------------------------------
-- Versión de fila: cada modificación de un catálogo incrementa «version» (la bitácora guarda el antes/después)
-- ---------------------------------------------------------------------------
create or replace function public.bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := coalesce(old.version, 0) + 1;
  return new;
end;
$$;

revoke execute on function public.bump_version() from public, anon, authenticated;

create or replace function app_private.register_catalog(p_table regclass)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_name text := (select relname from pg_class where oid = p_table);
begin
  perform app_private.register_table(p_table, p_no_delete => true);
  execute format('create trigger %I before update on %s for each row execute function public.bump_version()',
                 v_name || '_version', p_table);
  execute format('alter table %s enable row level security', p_table);
  execute format('create policy %I on %s for select to authenticated using (true)',
                 'authenticated can read ' || v_name, p_table);
  execute format('revoke all on table %s from anon', p_table);
  -- Las escrituras pasan por admin_save_catalog (valida rol, motivo y deja bitácora).
  execute format('revoke insert, update, delete, truncate on table %s from authenticated', p_table);
end;
$$;

revoke execute on function app_private.register_catalog(regclass) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Áreas de la empresa (árbol) — organigrama de ejemplo hasta confirmar el real (D-06)
-- ---------------------------------------------------------------------------
create table public.organizational_areas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2,6}$'),
  name text not null check (length(trim(name)) > 0),
  process_code text unique check (process_code ~ '^[A-Z]{2,3}$'),
  parent_id uuid references public.organizational_areas (id),
  head_user_id uuid references public.profiles (id),
  is_quality_owner boolean not null default false,
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (parent_id is null or parent_id <> id)
);

comment on table public.organizational_areas is
  'Áreas (RF-06). process_code = sigla de 3 caracteres de los códigos de documento (PRD 2.5.2). '
  'Aseguramiento de la calidad es la dueña del SGD (is_quality_owner).';
comment on column public.organizational_areas.process_code is
  'Sigla del proceso en los códigos de documento (GCA, ADM, CC, PRD, MTO, TH, GLG, IDI; D-15).';

create unique index organizational_areas_one_quality_owner
  on public.organizational_areas (is_quality_owner) where is_quality_owner;

select app_private.register_catalog('public.organizational_areas');

-- Organigrama de ejemplo (D-06): siglas propuestas del PRD 2.5.2 y áreas del Prompt 0B.
insert into public.organizational_areas (code, name, process_code, is_quality_owner) values
  ('DG', 'Dirección general', null, false);
insert into public.organizational_areas (code, name, process_code, parent_id, is_quality_owner)
select v.code, v.name, v.process_code, (select id from public.organizational_areas where code = v.parent), v.quality
from (values
  ('DT', 'Dirección técnica', null, 'DG', false),
  ('GCA', 'Aseguramiento de la calidad', 'GCA', 'DG', true),
  ('ADM', 'Administrativa', 'ADM', 'DG', false),
  ('COM', 'Comercial', null, 'DG', false)
) as v(code, name, process_code, parent, quality);
insert into public.organizational_areas (code, name, process_code, parent_id)
select v.code, v.name, v.process_code, (select id from public.organizational_areas where code = v.parent)
from (values
  ('CC', 'Control de calidad', 'CC', 'DT'),
  ('PRD', 'Producción', 'PRD', 'DT'),
  ('IDI', 'Investigación y desarrollo', 'IDI', 'DT'),
  ('MTO', 'Mantenimiento', 'MTO', 'DT'),
  ('TH', 'Talento humano', 'TH', 'ADM'),
  ('GLG', 'Gestión logística y almacenamiento', 'GLG', 'ADM')
) as v(code, name, process_code, parent);

-- Ciclos en el árbol: un área no puede quedar bajo una de sus descendientes.
create or replace function app_private.check_area_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null and exists (
    with recursive up as (
      select id, parent_id from public.organizational_areas where id = new.parent_id
      union all
      select a.id, a.parent_id from public.organizational_areas a join up on a.id = up.parent_id
    )
    select 1 from up where id = new.id
  ) then
    raise exception 'INVALID_TRANSITION: el área no puede depender de una de sus subáreas';
  end if;
  return new;
end;
$$;

create trigger organizational_areas_no_cycle
  before insert or update of parent_id on public.organizational_areas
  for each row execute function app_private.check_area_cycle();

-- El usuario pertenece a un área (RF-06).
alter table public.profiles
  add constraint profiles_area_fk foreign key (area_id) references public.organizational_areas (id);

-- ---------------------------------------------------------------------------
-- Catálogos genéricos
-- ---------------------------------------------------------------------------
create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  catalog text not null check (catalog in (
    'unidades', 'tipos_material', 'tipos_equipo', 'clasificacion_desviacion', 'motivos_correccion')),
  code text not null check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  description text,
  attributes jsonb not null default '{}',
  order_no int not null default 0,
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (catalog, code)
);

comment on table public.catalog_items is
  'Catálogos simples versionados (RF-04): unidades, tipos de material, tipos de equipo, '
  'clasificaciones de desviación y motivos de corrección.';

select app_private.register_catalog('public.catalog_items');

insert into public.catalog_items (catalog, code, name, description, order_no) values
  -- Unidades del Sistema Internacional y de uso en planta (Prompt 0, Prompt 0B).
  ('unidades', 'kg', 'Kilogramo', null, 1),
  ('unidades', 'g', 'Gramo', null, 2),
  ('unidades', 'mg', 'Miligramo', null, 3),
  ('unidades', 'L', 'Litro', null, 4),
  ('unidades', 'mL', 'Mililitro', null, 5),
  ('unidades', '°C', 'Grado Celsius', null, 6),
  ('unidades', '%', 'Porcentaje', null, 7),
  ('unidades', 'rpm', 'Revoluciones por minuto', null, 8),
  ('unidades', 'min', 'Minuto', null, 9),
  ('unidades', 'h', 'Hora', null, 10),
  ('unidades', 'g/mL', 'Gramo por mililitro', 'Densidad', 11),
  ('unidades', 'mPa·s', 'Milipascal segundo', 'Viscosidad', 12),
  ('unidades', 'UFC/g', 'Unidades formadoras de colonia por gramo', 'Microbiología', 13),
  ('unidades', 'und', 'Unidad', 'Unidades de producto terminado', 14),
  -- Tipos de material (PRD §6.3 materials.type y warehouse_allowed_types).
  ('tipos_material', 'materia_prima', 'Materia prima', null, 1),
  ('tipos_material', 'material_envase', 'Material de envase', null, 2),
  ('tipos_material', 'material_empaque', 'Material de empaque', null, 3),
  ('tipos_material', 'granel', 'Granel', null, 4),
  ('tipos_material', 'producto_terminado', 'Producto terminado', null, 5),
  -- Tipos de equipo (equipos del Prompt 0B).
  ('tipos_equipo', 'tanque', 'Tanque de fabricación', null, 1),
  ('tipos_equipo', 'homogeneizador', 'Homogeneizador', null, 2),
  ('tipos_equipo', 'balanza', 'Balanza', null, 3),
  ('tipos_equipo', 'llenadora', 'Llenadora', null, 4),
  ('tipos_equipo', 'etiquetadora', 'Etiquetadora', null, 5),
  -- Severidad de desviaciones (PRD §6.3 deviations.severity; textos del sistema de diseño).
  ('clasificacion_desviacion', 'menor', 'Menor', 'Sin efecto sobre la calidad del producto. Corrección documental.', 1),
  ('clasificacion_desviacion', 'mayor', 'Mayor', 'Posible efecto sobre calidad. Requiere investigación y CAPA.', 2),
  ('clasificacion_desviacion', 'critica', 'Crítica', 'Riesgo para el paciente o el usuario. Detiene el lote y notifica.', 3),
  -- Motivos de corrección: el PRD no los enumera (D-36); se parte del ejemplo del Prompt 0B.
  ('motivos_correccion', 'error_transcripcion', 'Error de transcripción', null, 1),
  ('motivos_correccion', 'otro', 'Otro (especificar)', 'El motivo detallado se escribe en la corrección', 2);

-- ---------------------------------------------------------------------------
-- Líneas de producto y perfiles regulatorios (PRD §10)
-- ---------------------------------------------------------------------------
create type public.regulatory_profile_kind as enum ('cosmetico', 'medicamento');

create table public.product_lines (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{2,12}$'),
  name text not null,
  regulatory_profile public.regulatory_profile_kind not null,
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

select app_private.register_catalog('public.product_lines');

insert into public.product_lines (code, name, regulatory_profile) values
  ('COS', 'Cosmética', 'cosmetico'),
  ('MED', 'Medicamentos', 'medicamento');

create table public.regulatory_profiles (
  id uuid primary key default gen_random_uuid(),
  profile public.regulatory_profile_kind not null,
  rule_key text not null,
  label text not null,
  enabled boolean not null,
  mode text not null check (mode in ('obligatorio', 'configurable', 'segun_criticidad')),
  params jsonb not null default '{}',
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (profile, rule_key)
);

comment on table public.regulatory_profiles is
  'Reglas por perfil (PRD §10). Valores de partida por confirmar con regulatorio (D-05). '
  'Al crear un lote se guarda regulatory_profile_snapshot(): cambiar un perfil no altera lotes existentes.';

select app_private.register_catalog('public.regulatory_profiles');

insert into public.regulatory_profiles (profile, rule_key, label, enabled, mode) values
  ('cosmetico', 'independent_verification_dispensing', 'Verificación independiente en dispensación', false, 'configurable'),
  ('medicamento', 'independent_verification_dispensing', 'Verificación independiente en dispensación', true, 'obligatorio'),
  ('cosmetico', 'reauth_on_every_signature', 'Reautenticación en cada firma', true, 'obligatorio'),
  ('medicamento', 'reauth_on_every_signature', 'Reautenticación en cada firma', true, 'obligatorio'),
  ('cosmetico', 'aq_review_before_release', 'Revisión de Aseguramiento de calidad antes de liberar', true, 'obligatorio'),
  ('medicamento', 'aq_review_before_release', 'Revisión de Aseguramiento de calidad antes de liberar', true, 'obligatorio'),
  ('cosmetico', 'critical_equipment_qualification_required', 'Calificación de equipos críticos', true, 'segun_criticidad'),
  ('medicamento', 'critical_equipment_qualification_required', 'Calificación de equipos críticos', true, 'obligatorio'),
  ('cosmetico', 'critical_deviation_blocks_release', 'Desviación crítica abierta bloquea la liberación', true, 'obligatorio'),
  ('medicamento', 'critical_deviation_blocks_release', 'Desviación crítica abierta bloquea la liberación', true, 'obligatorio');

-- Foto del perfil que se guarda en cada lote al crearlo (DI-8): los cambios posteriores no lo alteran.
create or replace function public.regulatory_profile_snapshot(p_profile public.regulatory_profile_kind)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', p_profile,
    'taken_at', now(),
    'rules', coalesce(jsonb_object_agg(rule_key, jsonb_build_object(
      'enabled', enabled, 'mode', mode, 'params', params, 'version', version)), '{}'))
  from public.regulatory_profiles
  where profile = p_profile;
$$;

revoke execute on function public.regulatory_profile_snapshot(public.regulatory_profile_kind) from public, anon;
grant execute on function public.regulatory_profile_snapshot(public.regulatory_profile_kind) to authenticated;

-- ---------------------------------------------------------------------------
-- Reglas de retención (PRD 2.5.8, RNF-05)
-- ---------------------------------------------------------------------------
create table public.retention_rules (
  id uuid primary key default gen_random_uuid(),
  record_class text not null unique,
  label text not null,
  years int check (years is null or years > 0),
  basis text not null check (basis in (
    'desde_obsolescencia', 'desde_vencimiento_registro', 'vida_util_equipo', 'norma_aplicable')),
  note text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

select app_private.register_catalog('public.retention_rules');

insert into public.retention_rules (record_class, label, years, basis, note) values
  ('documento_obsoleto', 'Documentos obsoletos archivados', 5, 'desde_obsolescencia', 'Última versión obsoleta, físico y digital'),
  ('expediente_registro_sanitario', 'Expedientes de notificación o registro sanitario', 5, 'desde_vencimiento_registro', 'Después de cancelado o vencido el registro'),
  ('equipo', 'Documentación de equipos', null, 'vida_util_equipo', 'Hasta el fin de la vida útil del equipo'),
  ('registro_de_lote', 'Registros de lote', null, 'norma_aplicable', 'Según norma aplicable por línea; por confirmar con regulatorio (D-05)');

-- ---------------------------------------------------------------------------
-- Marcas / clientes de maquila (solo si D-01 = sí; interruptor maquila_enabled)
-- ---------------------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

select app_private.register_catalog('public.brands');

insert into public.app_settings (key, value, description) values
  ('maquila_enabled', 'false', 'Activa la dimensión Marca/cliente de maquila (D-01, supuesto S3). Apagada por defecto.');

create or replace function app_private.check_brands_enabled()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((public.get_setting('maquila_enabled'))::boolean, false) is not true then
    raise exception 'FEATURE_DISABLED: la maquila está desactivada (D-01). Actívela en la configuración del sistema.';
  end if;
  return new;
end;
$$;

create trigger brands_require_maquila
  before insert or update on public.brands
  for each row execute function app_private.check_brands_enabled();

-- ---------------------------------------------------------------------------
-- Escritura de catálogos: una sola RPC con lista blanca de tablas y columnas
-- ---------------------------------------------------------------------------
create or replace function public.admin_save_catalog(
  p_table text,
  p_id uuid,
  p_values jsonb,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed text[];
  v_cols text[];
  v_key text;
  v_id uuid;
  v_sets text;
begin
  if not public.has_role('admin') then
    raise exception 'FORBIDDEN_ROLE: solo el administrador del sistema modifica catálogos';
  end if;

  v_allowed := case p_table
    when 'organizational_areas' then array['code', 'name', 'process_code', 'parent_id', 'head_user_id', 'active']
    when 'catalog_items' then array['catalog', 'code', 'name', 'description', 'attributes', 'order_no', 'active']
    when 'product_lines' then array['code', 'name', 'regulatory_profile', 'active']
    when 'regulatory_profiles' then array['enabled', 'params']
    when 'retention_rules' then array['label', 'years', 'basis', 'note']
    when 'brands' then array['name', 'active']
  end;
  if v_allowed is null then
    raise exception 'RECORD_NOT_FOUND: % no es un catálogo editable', p_table;
  end if;

  for v_key in select jsonb_object_keys(p_values) loop
    if not v_key = any(v_allowed) then
      raise exception 'INVALID_FIELD: el campo «%» no se puede modificar en %', v_key, p_table;
    end if;
  end loop;
  select array_agg(k) into v_cols from jsonb_object_keys(p_values) k;
  if v_cols is null then
    raise exception 'NO_CHANGE: no hay campos para guardar';
  end if;

  if p_id is not null and (p_reason is null or length(trim(p_reason)) = 0) then
    raise exception 'REASON_REQUIRED: todo cambio de un catálogo exige un motivo';
  end if;
  perform set_config('app.audit_reason', coalesce(trim(p_reason), ''), true);

  if p_id is null then
    if p_table = 'regulatory_profiles' then
      raise exception 'FORBIDDEN_ROLE: las reglas regulatorias se agregan por migración';
    end if;
    execute format(
      'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) returning id',
      p_table, (select string_agg(format('%I', c), ', ') from unnest(v_cols) c))
      into v_id using p_values;
  else
    select string_agg(format('%1$I = r.%1$I', c), ', ') into v_sets from unnest(v_cols) c;
    execute format(
      'update public.%1$I t set %2$s from jsonb_populate_record(null::public.%1$I, $1) r where t.id = $2 returning t.id',
      p_table, v_sets)
      into v_id using p_values, p_id;
    if v_id is null then
      raise exception 'RECORD_NOT_FOUND: no existe el registro % en %', p_id, p_table;
    end if;
  end if;

  perform set_config('app.audit_reason', '', true);
  return v_id;
end;
$$;

revoke execute on function public.admin_save_catalog(text, uuid, jsonb, text) from public, anon;
grant execute on function public.admin_save_catalog(text, uuid, jsonb, text) to authenticated;
