-- 0005_signatures_sod.sql · Etapa E1 (núcleo GxP)
-- Firma electrónica con reautenticación (DI-2), huella SHA-256 (DI-7), bloqueo tras firma (DI-3)
-- y segregación de funciones SOD-1…SOD-10 (PRD 2.3) evaluada por registro en la base.

-- ---------------------------------------------------------------------------
-- Significados de firma
-- ---------------------------------------------------------------------------
-- ejecuto/verifico/reviso/aprobo/libero (PRD §6.3 signatures.meaning) y actualizo
-- («Actualizado por», cuadro de firmas del SGD, PRD 2.5.3).
create type public.signature_meaning as enum ('ejecuto', 'verifico', 'reviso', 'aprobo', 'libero', 'actualizo');

-- ---------------------------------------------------------------------------
-- Catálogo de tablas firmables (cada etapa registra las suyas)
-- ---------------------------------------------------------------------------
create table public.signable_tables (
  table_name text primary key,
  label text not null,
  kind text not null,                         -- p. ej. dispensacion, analisis, certificado, lote, documento
  is_execution boolean not null default false, -- registros de ejecución de lote (SOD-9)
  is_quality boolean not null default false,   -- registros de calidad (SOD-7)
  is_document boolean not null default false,  -- versiones de documentos controlados (SOD-3, SOD-8)
  author_column text not null default 'created_by',
  group_column text,                           -- agrupa registros para reglas cruzadas (p. ej. batch_id)
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.signable_tables is
  'Tablas cuyos registros se firman con sign_record. Toda tabla registrada tiene id uuid, locked_at y status.';

alter table public.signable_tables enable row level security;
select app_private.register_table('public.signable_tables', p_no_delete => true);

-- Qué rol puede firmar qué significado en qué tabla, qué firma previa exige y qué estado deja.
create table public.sign_permissions (
  id uuid primary key default gen_random_uuid(),
  table_name text not null references public.signable_tables (table_name),
  meaning public.signature_meaning not null,
  role public.app_role not null,
  requires_meaning public.signature_meaning,
  sets_status text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (table_name, meaning, role)
);

alter table public.sign_permissions enable row level security;
select app_private.register_table('public.sign_permissions', p_no_delete => true);

-- Reglas cruzadas entre registros del mismo grupo (p. ej. el mismo lote): SOD-5 y SOD-6.
create table public.sod_cross_rules (
  code text primary key,
  description text not null,
  meaning public.signature_meaning not null,       -- firma que se intenta
  kind text,                                       -- tipo de registro que se firma (nulo = cualquiera)
  prior_meaning public.signature_meaning not null, -- firma previa que lo impide
  prior_kind text,                                 -- tipo del registro previo (nulo = cualquiera)
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.sod_cross_rules enable row level security;
select app_private.register_table('public.sod_cross_rules', p_no_delete => true);

insert into public.sod_cross_rules (code, description, meaning, kind, prior_meaning, prior_kind) values
  ('SOD-5', 'Quien analiza no aprueba el certificado de ese lote', 'aprobo', 'certificado', 'ejecuto', 'analisis'),
  ('SOD-6', 'Quien libera el lote no pudo haber ejecutado pasos de ese lote', 'libero', null, 'ejecuto', null);

-- ---------------------------------------------------------------------------
-- Firmas
-- ---------------------------------------------------------------------------
create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  record_table text not null references public.signable_tables (table_name),
  record_id uuid not null,
  meaning public.signature_meaning not null,
  signed_as public.app_role not null,
  record_hash text not null check (record_hash ~ '^[0-9a-f]{64}$'),
  short_signature text not null,
  signer_name text not null,
  group_key text,
  reason text,
  reauth_method text not null,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (record_table, record_id, meaning)
);

comment on table public.signatures is 'Firmas electrónicas (PRD DI-2). Solo se agregan; nunca se modifican ni borran.';

create index signatures_record_idx on public.signatures (record_table, record_id);
create index signatures_user_idx on public.signatures (user_id);
create index signatures_group_idx on public.signatures (group_key) where group_key is not null;

alter table public.signatures enable row level security;
select app_private.register_table('public.signatures', p_append_only => true);

-- Intentos fallidos de reautenticación al firmar.
create table public.sign_attempts (
  user_id uuid primary key references public.profiles (id),
  failed_count int not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.sign_attempts enable row level security;
select app_private.register_table('public.sign_attempts');

-- ---------------------------------------------------------------------------
-- Huella del contenido (DI-7)
-- ---------------------------------------------------------------------------
-- SHA-256 del JSON canónico del registro. jsonb ordena las claves de forma determinista;
-- se excluyen los campos que cambian al firmar (estado, bloqueo y metadatos de actualización).
create or replace function public.record_hash(p_row jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    extensions.digest(
      convert_to((p_row - array['status', 'locked_at', 'updated_at', 'updated_by'])::text, 'UTF8'),
      'sha256'),
    'hex');
$$;

comment on function public.record_hash(jsonb) is
  'SHA-256 (hex) del jsonb canónico sin status/locked_at/updated_at/updated_by (PRD DI-7).';

-- ---------------------------------------------------------------------------
-- Segregación de funciones (PRD 2.3)
-- ---------------------------------------------------------------------------
-- Lanza SOD_VIOLATION o FORBIDDEN_ROLE con el código de la regla. SOD-10 (versión aprobada no se edita)
-- se cumple con el bloqueo tras firma (RECORD_LOCKED).
create or replace function public.check_sod(
  p_user uuid,
  p_table text,
  p_record_id uuid,
  p_meaning public.signature_meaning,
  p_row jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cfg public.signable_tables;
  v_roles public.app_role[] := public.user_active_roles(p_user);
  v_group text;
  v_rule public.sod_cross_rules;
begin
  select * into v_cfg from public.signable_tables where table_name = p_table;
  if not found then
    raise exception 'RECORD_NOT_FOUND: % no es una tabla firmable', p_table;
  end if;

  -- SOD-7: admin no firma registros de calidad.
  if v_cfg.is_quality and 'admin' = any(v_roles) then
    raise exception 'FORBIDDEN_ROLE: SOD-7: el administrador del sistema no puede firmar registros de calidad';
  end if;

  -- SOD-9: master y aq_doc no firman registros de ejecución de lote.
  if v_cfg.is_execution and v_roles && array['master', 'aq_doc']::public.app_role[] then
    raise exception 'FORBIDDEN_ROLE: SOD-9: el usuario master y la analista de gestión documental no firman registros de ejecución';
  end if;

  -- SOD-1 (y SOD-4 en dispensación): quien ejecuta no verifica el mismo registro.
  if p_meaning = 'verifico' and exists (
    select 1 from public.signatures s
    where s.record_table = p_table and s.record_id = p_record_id and s.user_id = p_user and s.meaning = 'ejecuto'
  ) then
    raise exception 'SOD_VIOLATION: SOD-1: usted ejecutó este registro; la verificación debe hacerla otra persona';
  end if;

  -- SOD-2: quien verifica no aprueba el mismo registro.
  if p_meaning = 'aprobo' and exists (
    select 1 from public.signatures s
    where s.record_table = p_table and s.record_id = p_record_id and s.user_id = p_user and s.meaning = 'verifico'
  ) then
    raise exception 'SOD_VIOLATION: SOD-2: usted verificó este registro; la aprobación debe hacerla otra persona';
  end if;

  -- SOD-3 y SOD-8: quien elabora o modifica una versión no la revisa ni la aprueba (el revisor sí puede aprobar).
  if v_cfg.is_document and p_meaning in ('reviso', 'aprobo') and (
    (p_row ->> v_cfg.author_column) = p_user::text
    or exists (
      select 1 from public.signatures s
      where s.record_table = p_table and s.record_id = p_record_id and s.user_id = p_user and s.meaning = 'actualizo'
    )
  ) then
    raise exception 'SOD_VIOLATION: %: usted elaboró esta versión y no puede revisarla ni aprobarla',
      case when p_meaning = 'aprobo' then 'SOD-3/SOD-8' else 'SOD-8' end;
  end if;

  -- SOD-5 y SOD-6: reglas cruzadas entre registros del mismo grupo (lote).
  if v_cfg.group_column is not null then
    v_group := p_row ->> v_cfg.group_column;
    if v_group is not null then
      for v_rule in
        select * from public.sod_cross_rules r
        where r.meaning = p_meaning and (r.kind is null or r.kind = v_cfg.kind)
        order by r.code
      loop
        if exists (
          select 1
          from public.signatures s
          join public.signable_tables st on st.table_name = s.record_table
          where s.group_key = v_group
            and s.user_id = p_user
            and s.meaning = v_rule.prior_meaning
            and (v_rule.prior_kind is null or st.kind = v_rule.prior_kind)
        ) then
          raise exception 'SOD_VIOLATION: %: %', v_rule.code, v_rule.description;
        end if;
      end loop;
    end if;
  end if;
end;
$$;

revoke execute on function public.check_sod(uuid, text, uuid, public.signature_meaning, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reautenticación (D-09): contraseña; con «password_mfa» exige además sesión AAL2 (segundo factor)
-- ---------------------------------------------------------------------------
create or replace function app_private.verify_reauth(p_user uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_method text := coalesce(public.get_setting('reauth_method') #>> '{}', 'password');
  v_max int := coalesce((public.get_setting('sign_max_failed_attempts'))::int, 3);
  v_lock_min int := coalesce((public.get_setting('sign_lockout_minutes'))::int, 15);
  v_attempt public.sign_attempts;
  v_hash text;
  v_count int;
  v_has_attempt boolean;
begin
  select * into v_attempt from public.sign_attempts where user_id = p_user for update;
  v_has_attempt := found;
  if v_has_attempt and v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    return jsonb_build_object('ok', false, 'code', 'REAUTH_LOCKED', 'locked_until', v_attempt.locked_until);
  end if;

  select encrypted_password into v_hash from auth.users where id = p_user;
  if v_hash is null or p_password is null or extensions.crypt(p_password, v_hash) <> v_hash then
    v_count := coalesce(v_attempt.failed_count, 0) + 1;
    if v_count >= v_max then
      insert into public.sign_attempts (user_id, failed_count, locked_until, last_failed_at)
      values (p_user, 0, now() + make_interval(mins => v_lock_min), now())
      on conflict (user_id) do update
        set failed_count = 0, locked_until = excluded.locked_until, last_failed_at = now();
      return jsonb_build_object('ok', false, 'code', 'REAUTH_LOCKED',
        'locked_until', now() + make_interval(mins => v_lock_min));
    end if;
    insert into public.sign_attempts (user_id, failed_count, locked_until, last_failed_at)
    values (p_user, v_count, null, now())
    on conflict (user_id) do update
      set failed_count = v_count, locked_until = null, last_failed_at = now();
    return jsonb_build_object('ok', false, 'code', 'REAUTH_FAILED', 'remaining', v_max - v_count);
  end if;

  if v_method = 'password_mfa' and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    return jsonb_build_object('ok', false, 'code', 'MFA_REQUIRED');
  end if;

  if v_has_attempt and (v_attempt.failed_count > 0 or v_attempt.locked_until is not null) then
    update public.sign_attempts set failed_count = 0, locked_until = null where user_id = p_user;
  end if;
  return jsonb_build_object('ok', true, 'method', v_method);
end;
$$;

revoke execute on function app_private.verify_reauth(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- ¿Puede firmar? (para que la interfaz muestre el aviso de segregación antes de pedir contraseña)
-- ---------------------------------------------------------------------------
create or replace function public.can_sign(p_table text, p_record_id uuid, p_meaning public.signature_meaning)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_perm public.sign_permissions;
  v_msg text;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'code', 'FORBIDDEN_ROLE', 'message', 'Sesión requerida');
  end if;
  if not exists (select 1 from public.signable_tables where table_name = p_table) then
    return jsonb_build_object('allowed', false, 'code', 'RECORD_NOT_FOUND', 'message', p_table);
  end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', p_table) into v_row using p_record_id;
  if v_row is null then
    return jsonb_build_object('allowed', false, 'code', 'RECORD_NOT_FOUND', 'message', p_record_id::text);
  end if;

  select * into v_perm from public.sign_permissions
  where table_name = p_table and meaning = p_meaning and role = any(public.user_active_roles(v_uid))
  order by role limit 1;
  if not found then
    return jsonb_build_object('allowed', false, 'code', 'FORBIDDEN_ROLE',
      'message', 'Su rol no permite firmar este registro con este significado');
  end if;

  begin
    perform public.check_sod(v_uid, p_table, p_record_id, p_meaning, v_row);
  exception when others then
    v_msg := sqlerrm;
    return jsonb_build_object('allowed', false, 'code', split_part(v_msg, ':', 1),
      'message', trim(substr(v_msg, length(split_part(v_msg, ':', 1)) + 2)));
  end;
  return jsonb_build_object('allowed', true);
end;
$$;

revoke execute on function public.can_sign(text, uuid, public.signature_meaning) from public, anon;
grant execute on function public.can_sign(text, uuid, public.signature_meaning) to authenticated;

-- ---------------------------------------------------------------------------
-- sign_record (DI-2): reautentica, valida rol, orden y SOD, calcula la huella, inserta la firma,
-- bloquea el registro, cambia su estado y deja bitácora, todo en una transacción.
-- ---------------------------------------------------------------------------
-- Un fallo de contraseña NO lanza excepción: devuelve {ok:false} para que quede registrado el intento.
create or replace function public.sign_record(
  p_table text,
  p_record_id uuid,
  p_meaning public.signature_meaning,
  p_password text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_auth jsonb;
  v_cfg public.signable_tables;
  v_row jsonb;
  v_perm public.sign_permissions;
  v_hash text;
  v_short text;
  v_name text;
  v_group text;
  v_sig public.signatures;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN_ROLE: se requiere una sesión para firmar';
  end if;

  v_auth := app_private.verify_reauth(v_uid, p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  select * into v_cfg from public.signable_tables where table_name = p_table;
  if not found then
    raise exception 'RECORD_NOT_FOUND: % no es una tabla firmable', p_table;
  end if;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1 for update', p_table)
    into v_row using p_record_id;
  if v_row is null then
    raise exception 'RECORD_NOT_FOUND: no existe el registro % en %', p_record_id, p_table;
  end if;

  select * into v_perm from public.sign_permissions
  where table_name = p_table and meaning = p_meaning and role = any(public.user_active_roles(v_uid))
  order by role limit 1;
  if not found then
    raise exception 'FORBIDDEN_ROLE: su rol no permite firmar «%» en %', p_meaning, v_cfg.label;
  end if;

  if exists (select 1 from public.signatures s
             where s.record_table = p_table and s.record_id = p_record_id and s.meaning = p_meaning) then
    raise exception 'INVALID_TRANSITION: el registro ya tiene la firma «%»', p_meaning;
  end if;

  if v_perm.requires_meaning is not null and not exists (
    select 1 from public.signatures s
    where s.record_table = p_table and s.record_id = p_record_id and s.meaning = v_perm.requires_meaning
  ) then
    raise exception 'INVALID_TRANSITION: «%» requiere antes la firma «%»', p_meaning, v_perm.requires_meaning;
  end if;

  perform public.check_sod(v_uid, p_table, p_record_id, p_meaning, v_row);

  v_hash := public.record_hash(v_row);
  select full_name into v_name from public.profiles where id = v_uid;
  select short_signature into v_short from public.signature_registry where user_id = v_uid;
  v_group := case when v_cfg.group_column is not null then v_row ->> v_cfg.group_column end;

  perform set_config('app.audit_reason', coalesce(p_reason, ''), true);

  insert into public.signatures (
    user_id, record_table, record_id, meaning, signed_as, record_hash, short_signature, signer_name,
    group_key, reason, reauth_method, created_by, updated_by
  ) values (
    v_uid, p_table, p_record_id, p_meaning, v_perm.role, v_hash, coalesce(v_short, v_name), v_name,
    v_group, nullif(trim(p_reason), ''), v_auth ->> 'method', v_uid, v_uid
  ) returning * into v_sig;

  perform set_config('app.signing_record', p_table || ':' || p_record_id, true);
  execute format(
    'update public.%I set locked_at = coalesce(locked_at, now())%s where id = $1',
    p_table,
    case when v_perm.sets_status is not null then format(', status = %L', v_perm.sets_status) else '' end
  ) using p_record_id;
  perform set_config('app.signing_record', '', true);
  perform set_config('app.audit_reason', '', true);

  return jsonb_build_object(
    'ok', true,
    'signature_id', v_sig.id,
    'meaning', v_sig.meaning,
    'record_hash', v_sig.record_hash,
    'signed_at', v_sig.signed_at,
    'short_signature', v_sig.short_signature,
    'signer_name', v_sig.signer_name
  );
end;
$$;

revoke execute on function public.sign_record(text, uuid, public.signature_meaning, text, text) from public, anon;
grant execute on function public.sign_record(text, uuid, public.signature_meaning, text, text) to authenticated;

-- DI-7: recalcula la huella del registro actual y la compara con la de la firma.
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
  return v_row is not null and public.record_hash(v_row) = v_sig.record_hash;
end;
$$;

revoke execute on function public.verify_signature_integrity(uuid) from public, anon;
grant execute on function public.verify_signature_integrity(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas RLS y permisos
-- ---------------------------------------------------------------------------
create policy "authenticated can read signable tables" on public.signable_tables
  for select to authenticated using (true);
create policy "authenticated can read sign permissions" on public.sign_permissions
  for select to authenticated using (true);
create policy "authenticated can read sod rules" on public.sod_cross_rules
  for select to authenticated using (true);
create policy "own signatures or audit readers" on public.signatures
  for select to authenticated using (user_id = auth.uid() or public.can_read_audit());
-- sign_attempts: sin políticas (solo funciones security definer).

revoke all on table public.signable_tables, public.sign_permissions, public.sod_cross_rules,
  public.signatures, public.sign_attempts from anon;
revoke insert, update, delete, truncate on table public.signable_tables, public.sign_permissions,
  public.sod_cross_rules, public.signatures from authenticated;
revoke all on table public.sign_attempts from authenticated;
