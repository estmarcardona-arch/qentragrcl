-- 0021_stability_signer_judgment.sql · Etapa E4 (PRD F3) · decisión D-13 del responsable (24/10/2026)
-- Cerrar un estudio como «cumple» ya no exige criterios de cumplimiento definidos por producto: con todas las
-- lecturas obligatorias registradas, quien firma decide y justifica el resultado en las conclusiones. Si el
-- producto tiene criterios completos, se siguen evaluando (STABILITY_OUT_OF_CRITERIA). Las lecturas de
-- temperatura fuera del rango de la prueba (PRD RF-16: 42–48 °C y 0–8 °C) siguen impidiendo el «cumple».

create or replace function public.close_stability_study(p_study uuid, p_result text, p_reason text, p_conclusions text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_study public.stability_studies;
  v_missing jsonb;
  v_crit public.stability_criteria;
  v_product uuid;
  v_viol text[];
  v_res jsonb;
  v_as text := app_private.first_role(array['cc_jefe', 'idi']);
begin
  if v_as is null then
    raise exception 'FORBIDDEN_ROLE: cierra el estudio Control de calidad o I+D';
  end if;
  if p_result not in ('cumple', 'no_cumple') then
    raise exception 'INVALID_FIELD: el resultado es «cumple» o «no_cumple»';
  end if;
  select * into v_study from public.stability_studies where id = p_study for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el estudio';
  end if;
  if v_study.status <> 'en_curso' then
    raise exception 'INVALID_TRANSITION: el estudio ya está %', v_study.status;
  end if;
  if exists (select 1 from public.stability_tests t join public.stability_readings r on r.test_id = t.id
             where t.study_id = p_study and r.recorded_by = auth.uid()) then
    raise exception 'SOD_VIOLATION: usted registró lecturas de este estudio; el resultado lo firma otra persona';
  end if;

  v_missing := public.stability_missing(p_study);
  if p_result = 'cumple' then
    if jsonb_array_length(v_missing) > 0 then
      raise exception 'STABILITY_INCOMPLETE: faltan % lectura(s) obligatorias (%)',
        (select sum((m ->> 'missing')::int) from jsonb_array_elements(v_missing) m),
        (select string_agg((m ->> 'test') || ' ' || (m ->> 'time_point'), ', ') from jsonb_array_elements(v_missing) m);
    end if;
    select b.product_id into v_product from public.formula_prototypes p join public.briefs b on b.id = p.brief_id
    where p.id = v_study.prototype_id;
    select * into v_crit from public.stability_criteria where product_id = v_product;
    if found and v_crit.ph_max_variation is not null and v_crit.viscosity_max_variation_pct is not null
       and v_crit.micro_limits is not null and v_crit.organoleptic_changes_allowed is not null
       and v_crit.reading_window_hours is not null then
      v_viol := app_private.stability_violations(p_study, v_crit);
    else
      -- D-13: sin criterios completos decide quien firma, con justificación.
      if coalesce(length(trim(p_conclusions)), 0) = 0 then
        raise exception 'INVALID_FIELD: el producto no tiene criterios de cumplimiento definidos (D-13); justifique el resultado en las conclusiones';
      end if;
      v_viol := case when exists (
          select 1 from public.stability_tests t join public.stability_readings r on r.test_id = t.id
          where t.study_id = p_study and t.test_type in ('calentamiento', 'enfriamiento') and r.in_range is false)
        then array['hay lecturas de temperatura fuera del rango de la prueba'] else '{}'::text[] end;
    end if;
    if array_length(v_viol, 1) > 0 then
      raise exception 'STABILITY_OUT_OF_CRITERIA: %', array_to_string(v_viol, '; ');
    end if;
  else
    perform app_private.require_reason(p_reason);
  end if;

  v_res := app_private.sign_simple('stability_studies', p_study, 'aprobo', p_password, p_reason, v_as);
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  update public.stability_studies set
    status = case when p_result = 'no_cumple' and jsonb_array_length(v_missing) > 0 then 'cerrado_anticipado' else 'completo' end,
    result = p_result, early_close_reason = case when p_result = 'no_cumple' then trim(p_reason) end,
    conclusions = nullif(trim(p_conclusions), ''), closed_by = auth.uid(), closed_at = now(), locked_at = now()
  where id = p_study;
  update public.formula_prototypes
  set status = case when p_result = 'cumple' then 'seleccionado' else 'reformular' end,
      status_reason = case when p_result = 'no_cumple' then trim(p_reason) end
  where id = v_study.prototype_id;
  return v_res || jsonb_build_object('result', p_result);
end;
$$;

comment on function public.close_stability_study(uuid, text, text, text, text) is
  'RF-16 / D-13: cierre firmado del estudio. «cumple» exige lecturas completas, temperaturas en rango y, si el producto tiene criterios, cumplirlos; sin criterios exige justificación en las conclusiones.';
comment on table public.stability_criteria is
  'Criterios de cumplimiento de la estabilidad preliminar por producto (D-13), opcionales: si están completos se evalúan al cerrar como «cumple»; si no, quien firma justifica el resultado.';
