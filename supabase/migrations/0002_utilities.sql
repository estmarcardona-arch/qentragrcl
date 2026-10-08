-- 0002_utilities.sql · Etapa E0 (cimientos)
-- Funciones utilitarias. No crea tablas de negocio.

-- set_updated_at(): trigger BEFORE UPDATE que fija updated_at con la hora del servidor (DI-5).
-- updated_by lo fijan las RPC de cada etapa (requiere auth.uid(), E1).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger BEFORE UPDATE: updated_at = now() del servidor (PRD DI-5).';

-- Las funciones de trigger no se invocan por API.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- health_check(): verificación de conexión para /api/health. No expone datos.
create or replace function public.health_check()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('ok', true, 'db_time', now());
$$;

comment on function public.health_check() is
  'Verificación de salud para /api/health: devuelve ok y la hora del servidor; no expone datos.';

revoke execute on function public.health_check() from public;
grant execute on function public.health_check() to anon, authenticated;
