-- 0016_training_default.sql · Etapa E3 (PRD F2B)
-- D-19 sigue abierta y su valor por defecto registrado es «avisa» (PREGUNTAS_ABIERTAS.md): la regla de
-- capacitación antes de ejecutar queda configurable y en modo «avisar» hasta que Calidad decida.
-- Para exigirla (AC-25, TRAINING_REQUIRED), el administrador la cambia a «bloquear» en S-04.
update public.app_settings
set value = '"avisar"',
    description = 'Capacitación antes de ejecutar pasos regidos por un documento (D-19): «avisar» (por defecto) o «bloquear» (TRAINING_REQUIRED).'
where key = 'training_enforcement' and value = '"bloquear"';

-- Validación de los ajustes del SGD en la configuración del sistema (S-04).
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
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.app_settings set value = p_value where key = p_key;
  perform set_config('app.audit_reason', '', true);
end;
$$;
