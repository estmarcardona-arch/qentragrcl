-- seed.sql · Datos ficticios del Prompt 0B (AGENTS.md regla 9). SOLO PARA ENTORNO LOCAL Y CI:
-- `supabase start` / `supabase db reset` lo cargan; `supabase db push` NO lo aplica a la nube.
-- Nunca se cargan datos reales. Contraseña de desarrollo común: Grufarcol.Dev.2026
-- Correos con dominio reservado .test (no existe en internet).

do $$
declare
  v_password constant text := 'Grufarcol.Dev.2026';
  v_user record;
begin
  for v_user in
    select * from (values
      ('a1000000-0000-4000-8000-000000000001'::uuid, 'camila.ortega@grufarcol.test', 'Camila Ortega', 'Comercial', 'comercial'::text, null::timestamptz),
      ('a1000000-0000-4000-8000-000000000002', 'sebastian.rojas@grufarcol.test', 'Sebastián Rojas', 'Químico formulador (I+D)', 'idi', null),
      ('a1000000-0000-4000-8000-000000000003', 'marta.quintero@grufarcol.test', 'Marta Quintero', 'Auxiliar de bodega', 'bodega_aux', null),
      ('a1000000-0000-4000-8000-000000000004', 'hernan.salgado@grufarcol.test', 'Hernán Salgado', 'Jefe de bodega', 'bodega_jefe', null),
      ('a1000000-0000-4000-8000-000000000005', 'diego.cardenas@grufarcol.test', 'Diego Cárdenas', 'Auxiliar de producción', 'prod_aux', null),
      ('a1000000-0000-4000-8000-000000000006', 'paola.mejia@grufarcol.test', 'Paola Mejía', 'Coordinadora de producción', 'prod_coord', null),
      ('a1000000-0000-4000-8000-000000000007', 'natalia.ruiz@grufarcol.test', 'Natalia Ruiz', 'Auxiliar de laboratorio', 'lab_aux', null),
      ('a1000000-0000-4000-8000-000000000008', 'ricardo.pena@grufarcol.test', 'Ricardo Peña', 'Jefe de control de calidad', 'cc_jefe', null),
      ('a1000000-0000-4000-8000-000000000009', 'lucia.barrera@grufarcol.test', 'Lucía Barrera', 'Directora de aseguramiento de calidad', 'aq_dir', null),
      ('a1000000-0000-4000-8000-000000000010', 'esteban.gaviria@grufarcol.test', 'Dr. Esteban Gaviria', 'Director técnico', 'dt', null),
      ('a1000000-0000-4000-8000-000000000011', 'tomas.herrera@grufarcol.test', 'Tomás Herrera', 'Administrador del sistema', 'admin', null),
      ('a1000000-0000-4000-8000-000000000012', 'ines.valencia@grufarcol.test', 'Inés Valencia', 'Auditora invitada', 'auditor', '2026-11-30T23:59:59-05:00'),
      ('a1000000-0000-4000-8000-000000000013', 'gabriela.torres@grufarcol.test', 'Gabriela Torres', 'Usuario master', 'master', null),
      ('a1000000-0000-4000-8000-000000000014', 'valentina.cruz@grufarcol.test', 'Valentina Cruz', 'Analista de gestión documental', 'aq_doc', null),
      ('a1000000-0000-4000-8000-000000000015', 'marcela.duarte@grufarcol.test', 'Marcela Duarte', 'Gerente general', 'gerencia', null)
    ) as t(id, email, full_name, job_title, role, expires_at)
  loop
    if not exists (select 1 from auth.users where id = v_user.id) then
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, reauthentication_token, phone_change, phone_change_token
      ) values (
        '00000000-0000-0000-0000-000000000000', v_user.id, 'authenticated', 'authenticated', v_user.email,
        extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', v_user.full_name, 'job_title', v_user.job_title),
        now(), now(), '', '', '', '', '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_user.id, v_user.id::text,
              jsonb_build_object('sub', v_user.id::text, 'email', v_user.email, 'email_verified', true),
              'email', now(), now(), now());
    end if;

    if not exists (select 1 from public.user_roles where user_id = v_user.id and role = v_user.role and revoked_at is null) then
      insert into public.user_roles (user_id, role, expires_at) values (v_user.id, v_user.role, v_user.expires_at);
    end if;
  end loop;
end $$;

-- Áreas de los usuarios ficticios (organigrama de ejemplo, D-06) y jefes de área del Prompt 0B.
update public.profiles p
set area_id = a.id
from (values
  ('camila.ortega@grufarcol.test', 'COM'), ('sebastian.rojas@grufarcol.test', 'IDI'),
  ('marta.quintero@grufarcol.test', 'GLG'), ('hernan.salgado@grufarcol.test', 'GLG'),
  ('diego.cardenas@grufarcol.test', 'PRD'), ('paola.mejia@grufarcol.test', 'PRD'),
  ('natalia.ruiz@grufarcol.test', 'CC'), ('ricardo.pena@grufarcol.test', 'CC'),
  ('lucia.barrera@grufarcol.test', 'GCA'), ('esteban.gaviria@grufarcol.test', 'DT'),
  ('tomas.herrera@grufarcol.test', 'ADM'), ('gabriela.torres@grufarcol.test', 'DT'),
  ('valentina.cruz@grufarcol.test', 'GCA'), ('marcela.duarte@grufarcol.test', 'DG')
) as v(email, area_code)
join public.organizational_areas a on a.code = v.area_code
where p.email = v.email and p.area_id is distinct from a.id;

update public.organizational_areas oa
set head_user_id = p.id
from (values
  ('GCA', 'lucia.barrera@grufarcol.test'), ('DT', 'esteban.gaviria@grufarcol.test'),
  ('CC', 'ricardo.pena@grufarcol.test'), ('GLG', 'hernan.salgado@grufarcol.test'),
  ('DG', 'marcela.duarte@grufarcol.test')
) as v(area_code, email)
join public.profiles p on p.email = v.email
where oa.code = v.area_code and oa.head_user_id is distinct from p.id;
