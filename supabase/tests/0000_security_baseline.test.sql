-- Línea base de seguridad (AGENTS.md regla 3; puerta de salida E1): falla la CI si existe una
-- tabla sin RLS, una tabla de negocio sin trigger de bitácora o permisos de escritura sobre audit_log.
begin;
select plan(4);

select is_empty(
  $$ select n.nspname || '.' || c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'p')
       and n.nspname in ('public', 'app_private')
       and not c.relrowsecurity $$,
  'toda tabla de public y app_private tiene RLS activado'
);

select is_empty(
  $$ select c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'p') and n.nspname = 'public'
       and c.relname <> 'audit_log'
       and not exists (
         select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
         where t.tgrelid = c.oid and not t.tgisinternal and p.proname = 'audit_row_change'
       ) $$,
  'toda tabla de public (salvo audit_log) tiene trigger de bitácora'
);

select is_empty(
  $$ select r.rolname || ':' || p.privilege_type
     from (values ('anon'), ('authenticated'), ('service_role')) r(rolname)
     cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p(privilege_type)
     where has_table_privilege(r.rolname, 'public.audit_log', p.privilege_type) $$,
  'ningún rol de la API puede escribir, modificar, borrar o vaciar audit_log'
);

select is_empty(
  $$ select table_name from public.signable_tables st
     where not exists (
       select 1 from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = st.table_name and c.column_name = 'locked_at'
     ) $$,
  'toda tabla firmable tiene columna locked_at'
);

select * from finish();
rollback;
