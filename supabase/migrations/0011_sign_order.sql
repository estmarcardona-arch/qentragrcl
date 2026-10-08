-- 0011_sign_order.sql · Etapa E2 (corrección de E1)
-- sign_record valida primero todo lo que puede rechazar la firma (registro, rol, orden, SOD) y solo
-- después la contraseña. Antes, una contraseña correcta seguida de un rechazo revertía también el
-- reinicio del contador de intentos fallidos; además, un bloqueo por SOD consumía un intento.
-- Se agrega practice_reauth: verifica la contraseña con el mismo contador, sin firmar (prueba en vivo).

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

  -- 1. Validaciones que pueden rechazar la firma (no consumen intentos de contraseña).
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

  -- 2. Reautenticación (un fallo devuelve {ok:false} y deja registrado el intento).
  v_auth := app_private.verify_reauth(v_uid, p_password);
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  -- 3. Firma, bloqueo, estado y bitácora.
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

-- Práctica de reautenticación (prueba en vivo de /_design y capacitación): mismo contador de
-- intentos y mismo bloqueo que la firma, pero no firma ningún registro.
create or replace function public.practice_reauth(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN_ROLE: se requiere una sesión';
  end if;
  return app_private.verify_reauth(auth.uid(), p_password);
end;
$$;

revoke execute on function public.practice_reauth(text) from public, anon;
grant execute on function public.practice_reauth(text) to authenticated;
