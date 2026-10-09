-- Ayudas para pruebas pgTAP. El ejecutor (scripts/db-test.ts) las inserta después del «begin;»
-- de cada archivo; viven en pg_temp y desaparecen con la transacción (rollback).

-- Crea un usuario de prueba en auth.users (el trigger crea perfil y firma corta) con sus roles.
create or replace function pg_temp.test_user(
  p_email text,
  p_name text,
  p_roles text[],
  p_password text default 'Clave-Prueba-2026',
  p_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
          extensions.crypt(p_password, extensions.gen_salt('bf', 4)), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_name), now(), now());
  insert into public.user_roles (user_id, role) select v_id, unnest(p_roles);
  return v_id;
end;
$$;

-- Simula la sesión de un usuario como lo hace PostgREST (rol authenticated + claims del JWT).
-- Para cambiar de usuario: «reset role;» y volver a llamar.
create or replace function pg_temp.login_as(p_user uuid, p_aal text default 'aal1')
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Registra una tabla de prueba firmable (id, batch_id, value, status, locked_at, metadatos).
create or replace function pg_temp.fixture_table(
  p_name text,
  p_kind text,
  p_execution boolean default false,
  p_quality boolean default false,
  p_document boolean default false,
  p_group boolean default true
)
returns void
language plpgsql
as $$
begin
  execute format('create table public.%I (
    id uuid primary key default gen_random_uuid(),
    batch_id uuid,
    value text,
    status text not null default ''borrador'',
    locked_at timestamptz,
    created_at timestamptz not null default now(),
    created_by uuid,
    updated_at timestamptz not null default now(),
    updated_by uuid)', p_name);
  execute format('alter table public.%I enable row level security', p_name);
  perform app_private.register_table(format('public.%I', p_name)::regclass, p_signable => true, p_no_delete => true);
  insert into public.signable_tables (table_name, label, kind, is_execution, is_quality, is_document, group_column)
  values (p_name, 'Prueba ' || p_name, p_kind, p_execution, p_quality, p_document,
          case when p_group then 'batch_id' end);
end;
$$;
