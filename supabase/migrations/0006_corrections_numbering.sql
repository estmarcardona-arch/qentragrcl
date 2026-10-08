-- 0006_corrections_numbering.sql · Etapa E1 (núcleo GxP)
-- Correcciones sin borrado (DI-4, DI-12) y secuencias de numeración genéricas sin saltos (DI-9).

-- ---------------------------------------------------------------------------
-- Correcciones
-- ---------------------------------------------------------------------------
-- Una corrección no modifica el registro: agrega una fila con el valor anterior (que la interfaz
-- muestra tachado), el nuevo valor, el motivo, el usuario, su firma corta y la hora del servidor.
create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  record_table text not null references public.signable_tables (table_name),
  record_id uuid not null,
  field text not null,
  old_value jsonb,
  new_value jsonb,
  reason text not null check (length(trim(reason)) > 0),
  corrected_by uuid not null references public.profiles (id),
  short_signature text not null,
  corrected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.corrections is 'Correcciones con motivo (PRD DI-4, DI-12). Solo se agregan.';

create index corrections_record_idx on public.corrections (record_table, record_id);

alter table public.corrections enable row level security;
select app_private.register_table('public.corrections', p_append_only => true);

-- Campos que nunca se corrigen (identidad, metadatos y estado de firma).
create or replace function app_private.protected_fields()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'locked_at', 'status'];
$$;

create or replace function public.record_correction(
  p_table text,
  p_record_id uuid,
  p_field text,
  p_new_value jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg public.signable_tables;
  v_row jsonb;
  v_old jsonb;
  v_short text;
  v_id uuid;
  v_count int;
  v_threshold int := coalesce((public.get_setting('corrections_warning_threshold'))::int, 5);
begin
  if v_uid is null then
    raise exception 'FORBIDDEN_ROLE: se requiere una sesión para corregir';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED: toda corrección exige un motivo';
  end if;

  select * into v_cfg from public.signable_tables where table_name = p_table;
  if not found then
    raise exception 'RECORD_NOT_FOUND: % no admite correcciones', p_table;
  end if;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1', p_table) into v_row using p_record_id;
  if v_row is null then
    raise exception 'RECORD_NOT_FOUND: no existe el registro % en %', p_record_id, p_table;
  end if;
  if not (v_row ? p_field) or p_field = any(app_private.protected_fields()) then
    raise exception 'INVALID_FIELD: el campo «%» no se puede corregir', p_field;
  end if;

  -- Corrige el autor del registro o quien tenga permiso de firma sobre esta tabla.
  if (v_row ->> v_cfg.author_column) is distinct from v_uid::text and not exists (
    select 1 from public.sign_permissions sp
    where sp.table_name = p_table and sp.role = any(public.user_active_roles(v_uid))
  ) then
    raise exception 'FORBIDDEN_ROLE: su rol no permite corregir registros de %', v_cfg.label;
  end if;

  -- Valor vigente: la última corrección del campo o el valor original.
  select c.new_value into v_old
  from public.corrections c
  where c.record_table = p_table and c.record_id = p_record_id and c.field = p_field
  order by c.corrected_at desc, c.created_at desc
  limit 1;
  if not found then
    v_old := v_row -> p_field;
  end if;

  if v_old is not distinct from p_new_value then
    raise exception 'NO_CHANGE: el nuevo valor es igual al vigente';
  end if;

  select short_signature into v_short from public.signature_registry where user_id = v_uid;

  perform set_config('app.audit_reason', p_reason, true);
  insert into public.corrections (record_table, record_id, field, old_value, new_value, reason,
                                  corrected_by, short_signature)
  values (p_table, p_record_id, p_field, v_old, p_new_value, trim(p_reason), v_uid,
          coalesce(v_short, (select full_name from public.profiles where id = v_uid)))
  returning id into v_id;
  perform set_config('app.audit_reason', '', true);

  select count(*) into v_count from public.corrections
  where record_table = p_table and record_id = p_record_id;

  return jsonb_build_object(
    'ok', true,
    'correction_id', v_id,
    'old_value', v_old,
    'new_value', p_new_value,
    'count', v_count,
    'threshold', v_threshold,
    'warning', v_count > v_threshold
  );
end;
$$;

revoke execute on function public.record_correction(text, uuid, text, jsonb, text) from public, anon;
grant execute on function public.record_correction(text, uuid, text, jsonb, text) to authenticated;

-- Contador de correcciones por registro y aviso al superar el umbral (DI-12; 6 correcciones → aviso).
create or replace view public.v_record_corrections
with (security_invoker = true) as
select
  c.record_table,
  c.record_id,
  count(*)::int as corrections_count,
  max(c.corrected_at) as last_corrected_at,
  count(*) > coalesce((public.get_setting('corrections_warning_threshold'))::int, 5) as warning
from public.corrections c
group by c.record_table, c.record_id;

grant select on public.v_record_corrections to authenticated;
revoke all on public.v_record_corrections from anon;

-- get_setting es interno; la vista lo usa con privilegios del invocador.
grant execute on function public.get_setting(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Numeración (DI-9): códigos legibles sin saltos ni reutilización
-- ---------------------------------------------------------------------------
-- Formato con marcadores {YYYY}, {YY} y {N…} (cantidad de N = dígitos). Con año en el formato,
-- el consecutivo se reinicia cada año (zona America/Bogota, fecha de referencia).
create table public.numbering_sequences (
  key text primary key,
  format text not null check (format ~ '\{N+\}'),
  description text not null,
  year int,
  last_value int not null default 0 check (last_value >= 0),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.numbering_sequences is
  'Secuencias de códigos legibles (p. ej. OP-{YYYY}-{NNNN}). El formato lo define Aseguramiento de calidad (D-11).';

alter table public.numbering_sequences enable row level security;
select app_private.register_table('public.numbering_sequences', p_no_delete => true);

create policy "authenticated can read numbering sequences" on public.numbering_sequences
  for select to authenticated using (true);
revoke all on table public.numbering_sequences from anon;
revoke insert, update, delete, truncate on table public.numbering_sequences from authenticated;

create or replace function public.format_sequence_code(p_format text, p_year int, p_value int)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits int;
  v_out text := p_format;
begin
  v_digits := length(substring(p_format from '\{(N+)\}'));
  v_out := replace(v_out, '{YYYY}', lpad(p_year::text, 4, '0'));
  v_out := replace(v_out, '{YY}', right(p_year::text, 2));
  v_out := regexp_replace(v_out, '\{N+\}', lpad(p_value::text, v_digits, '0'));
  return v_out;
end;
$$;

-- Uso interno de las RPC (no se expone a la API): bloquea la fila, incrementa y formatea.
create or replace function public.next_number(p_key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq public.numbering_sequences;
  v_year int := extract(year from (public.reference_now() at time zone 'America/Bogota'))::int;
  v_next int;
begin
  select * into v_seq from public.numbering_sequences where key = p_key for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la secuencia %', p_key;
  end if;

  if v_seq.format like '%{YY%' and v_seq.year is distinct from v_year then
    v_next := 1;
  else
    v_next := v_seq.last_value + 1;
  end if;

  update public.numbering_sequences
  set last_value = v_next,
      year = case when v_seq.format like '%{YY%' then v_year else year end
  where key = p_key;

  return public.format_sequence_code(v_seq.format, v_year, v_next);
end;
$$;

revoke execute on function public.next_number(text) from public, anon, authenticated;
