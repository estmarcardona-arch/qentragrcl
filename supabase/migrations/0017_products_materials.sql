-- 0017_products_materials.sql · Etapa E4 (PRD F3: documentos maestros de producto)
-- Catálogos de materiales (materias primas, envase y empaque) y productos con presentaciones,
-- titular y registro sanitario (PRD 6.3: materials, products). Criterios de cumplimiento de la
-- estabilidad preliminar por producto (D-13): configurables y vacíos hasta que Calidad los defina.

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2,4}-[A-Z0-9-]{2,12}$'),
  name text not null check (length(trim(name)) > 0),
  type text not null check (type in ('mp', 'envase', 'empaque')),
  unit text not null default 'kg',
  inci_name text,
  default_function text,
  requires_coa boolean not null default true,
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.materials is 'Materiales (PRD 6.3): materias primas (mp), material de envase y de empaque.';
select app_private.register_catalog('public.materials');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^PRD-[0-9]{3}$'),
  name text not null check (length(trim(name)) > 0),
  line_id uuid not null references public.product_lines (id),
  brand_id uuid references public.brands (id),
  titular text,
  sanitary_registration text,
  sanitary_registration_expires date,
  shelf_life_months int check (shelf_life_months is null or shelf_life_months between 1 and 120),
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.products is
  'Productos (PRD 6.3) con titular, notificación o registro sanitario y vida útil. El vencimiento del registro fija la vigencia de sus documentos maestros (2.5.8).';
select app_private.register_catalog('public.products');

create table public.product_presentations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  code text not null,
  name text not null,
  net_content numeric(14, 4) not null check (net_content > 0),
  unit text not null default 'mL',
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (product_id, code)
);

select app_private.register_catalog('public.product_presentations');

-- Criterios de cumplimiento de la estabilidad preliminar (D-13). Vacíos = sin definir: el cierre
-- «cumple» de un estudio exige que estén definidos (STABILITY_CRITERIA_MISSING).
create table public.stability_criteria (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id),
  ph_max_variation numeric(6, 3) check (ph_max_variation is null or ph_max_variation >= 0),
  viscosity_max_variation_pct numeric(6, 2) check (viscosity_max_variation_pct is null or viscosity_max_variation_pct >= 0),
  density_max_variation numeric(8, 4) check (density_max_variation is null or density_max_variation >= 0),
  micro_limits jsonb,
  organoleptic_changes_allowed boolean,
  reading_window_hours numeric(8, 2) check (reading_window_hours is null or reading_window_hours >= 0),
  notes text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.stability_criteria is
  'Criterios de cumplimiento de la estabilidad preliminar por producto (D-13): variación máxima de pH, viscosidad y densidad, '
  'límites microbiológicos {"mesofilos_max": 100, "ausentes": ["pseudomonas", "staphylococcus", "ecoli"]}, cambios organolépticos admitidos y ventana horaria.';

alter table public.stability_criteria enable row level security;
select app_private.register_table('public.stability_criteria', p_no_delete => true);
create trigger stability_criteria_version before update on public.stability_criteria
  for each row execute function public.bump_version();
create policy "authenticated can read stability criteria" on public.stability_criteria
  for select to authenticated using (true);
revoke all on table public.stability_criteria from anon;
revoke insert, update, delete, truncate on table public.stability_criteria from authenticated;

-- Catálogos editables por el administrador (con motivo y bitácora).
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
    when 'materials' then array['code', 'name', 'type', 'unit', 'inci_name', 'default_function', 'requires_coa', 'active']
    when 'products' then array['code', 'name', 'line_id', 'brand_id', 'titular', 'sanitary_registration',
                               'sanitary_registration_expires', 'shelf_life_months', 'active']
    when 'product_presentations' then array['product_id', 'code', 'name', 'net_content', 'unit', 'active']
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
