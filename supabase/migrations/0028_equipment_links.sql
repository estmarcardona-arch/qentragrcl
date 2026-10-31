-- 0028_equipment_links.sql · Etapa E6 (ajustes, PRD 1.11): el certificado o informe del proveedor puede registrarse como
-- archivo (con huella SHA-256) o como enlace verificable (D-64). La calibración y la calificación exigen al menos uno
-- (AC-44). Los enlaces viven en equipment_attachments, que no entra en la huella de la firma del evento.

alter table public.equipment_attachments
  add column url text,
  alter column path drop not null,
  alter column mime_type drop not null,
  alter column size_bytes drop not null,
  alter column sha256 drop not null,
  add constraint equipment_attachments_file_or_url check (
    (url is null and path is not null and mime_type is not null and size_bytes is not null and sha256 is not null)
    or (url is not null and path is null and mime_type is null and size_bytes is null and sha256 is null
        and url ~ '^https?://[^\s]+$' and length(url) <= 2000));

comment on column public.equipment_attachments.url is
  'Enlace del proveedor para verificar el certificado o informe (D-64); sin archivo ni huella.';

-- Registro de eventos: igual que en 0027, más los enlaces y la exigencia para la calificación.
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
  v_links jsonb := coalesce(p_data -> 'links', '[]');
  v_l jsonb;
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
  -- AC-44 (PRD 1.11): la calibración y la calificación exigen el certificado o informe del proveedor, como archivo o como
  -- enlace verificable (D-64).
  if p_type in ('calibracion', 'calificacion') and jsonb_array_length(v_att) + jsonb_array_length(v_links) = 0 then
    raise exception 'INVALID_FIELD: adjunte el certificado o el enlace del proveedor (AC-44)';
  end if;
  if p_type = 'uso' and jsonb_array_length(v_att) + jsonb_array_length(v_links) > 0 then
    raise exception 'INVALID_FIELD: el uso no lleva adjuntos';
  end if;
  for v_l in select * from jsonb_array_elements(v_links) loop
    if coalesce(v_l ->> 'url', '') !~ '^https?://[^\s]+$' or length(v_l ->> 'url') > 2000 then
      raise exception 'INVALID_FIELD: el enlace % no es una dirección web válida (http o https)', coalesce(v_l ->> 'url', '');
    end if;
  end loop;
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
  insert into public.equipment_attachments (equipment_id, event_id, url, file_name, uploaded_by)
  select e.id, v_ev.id, trim(l ->> 'url'), coalesce(nullif(trim(l ->> 'label'), ''), 'Enlace del proveedor'), v_uid
  from jsonb_array_elements(v_links) l;
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
