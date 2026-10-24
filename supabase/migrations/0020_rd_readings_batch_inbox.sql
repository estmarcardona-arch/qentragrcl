-- 0020_rd_readings_batch_inbox.sql · Etapa E4 (PRD F3)
-- 1. record_stability_readings (RF-16): registra las repeticiones de un tiempo de una prueba en una sola
--    transacción. Si una repetición falla, no queda ninguna registrada (antes la pantalla llamaba una RPC por
--    repetición y podía dejar el tiempo a medias).
-- 2. my_pending_versions (RF-14, S-10): versiones del SGD que le toca firmar al usuario según la ruta de
--    aprobación. Reproduce las condiciones de review_document y approve_document (0015) para que la bandeja no
--    muestre lo que el usuario no puede firmar, ni las versiones ya aprobadas que esperan publicación.

-- ---------------------------------------------------------------------------
-- 1. Lecturas de estabilidad por tiempo (todas o ninguna)
-- ---------------------------------------------------------------------------
create or replace function public.record_stability_readings(p_test uuid, p_time_point text, p_readings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r jsonb;
  v_res jsonb;
  v_out jsonb := '[]';
begin
  if jsonb_typeof(p_readings) is distinct from 'array' or jsonb_array_length(p_readings) = 0 then
    raise exception 'INVALID_FIELD: registre al menos una repetición';
  end if;
  -- Cada repetición pasa por record_stability_reading (rol, estado, duplicados, campos, AC-17); cualquier
  -- excepción revierte toda la llamada.
  for v_r in select * from jsonb_array_elements(p_readings) loop
    v_res := public.record_stability_reading(p_test, p_time_point, (v_r ->> 'replicate')::int, coalesce(v_r -> 'values', '{}'));
    v_out := v_out || jsonb_build_array(jsonb_build_object('replicate', (v_r ->> 'replicate')::int, 'in_range', v_res -> 'in_range'));
  end loop;
  return jsonb_build_object('ok', true, 'recorded', jsonb_array_length(v_out), 'readings', v_out);
end;
$$;

comment on function public.record_stability_readings(uuid, text, jsonb) is
  'RF-16: registra varias repeticiones de un tiempo de una prueba de estabilidad en una sola transacción.';
revoke execute on function public.record_stability_readings(uuid, text, jsonb) from public, anon;
grant execute on function public.record_stability_readings(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Bandeja de aprobación: versiones que le toca firmar al usuario
-- ---------------------------------------------------------------------------
create or replace function public.my_pending_versions()
returns table (version_id uuid, step text)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, s.step
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  join public.approval_route_steps s on s.route_id = d.route_id
    and s.step = case v.status when 'en_revision' then 'revision' else 'aprobacion' end
  join public.approval_routes r on r.id = d.route_id
  where auth.uid() is not null
    and (v.status = 'en_revision' or (v.status = 'en_aprobacion' and v.locked_at is null))
    and (
      exists (select 1 from unnest(s.roles) x where public.has_role(x))
      or (s.step = 'revision' and s.includes_author_head and exists (
        select 1 from public.profiles p join public.organizational_areas a on a.id = p.area_id
        where p.id = v.author_id and a.head_user_id = auth.uid()))
    )
    -- En una ruta donde quien revisa no aprueba, el revisor no ve la versión en la aprobación.
    and not (s.step = 'aprobacion' and not r.allow_reviewer_as_approver and exists (
      select 1 from public.signatures g where g.record_table = 'document_versions' and g.record_id = v.id
        and g.meaning = 'reviso' and g.user_id = auth.uid()));
$$;

comment on function public.my_pending_versions() is
  'S-10: versiones en revisión o pendientes de aprobación que el usuario puede firmar según la ruta (incluye las propias, que la pantalla muestra bloqueadas por SOD).';
revoke execute on function public.my_pending_versions() from public, anon;
grant execute on function public.my_pending_versions() to authenticated;
