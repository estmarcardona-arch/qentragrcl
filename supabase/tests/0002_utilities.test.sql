-- E0 · Funciones utilitarias: set_updated_at y health_check.
begin;
select plan(7);

select has_function('public', 'set_updated_at', 'existe set_updated_at()');
select has_function('public', 'health_check', 'existe health_check()');

-- set_updated_at fija updated_at con la hora del servidor aunque el cliente envíe otra.
create temporary table _t (id int primary key, v text, updated_at timestamptz);
create trigger _t_updated before update on _t
  for each row execute function public.set_updated_at();
insert into _t values (1, 'a', '2000-01-01T00:00:00Z');
update _t set v = 'b', updated_at = '1999-01-01T00:00:00Z' where id = 1;
select is((select updated_at from _t where id = 1), now(), 'updated_at = now() del servidor');

select is((public.health_check() ->> 'ok')::boolean, true, 'health_check devuelve ok');

-- Permisos: anon puede consultar la salud; nadie invoca el trigger por API.
select ok(has_function_privilege('anon', 'public.health_check()', 'execute'),
  'anon puede ejecutar health_check');
select ok(not has_function_privilege('anon', 'public.set_updated_at()', 'execute'),
  'anon no puede ejecutar set_updated_at');
select ok(not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'),
  'authenticated no puede ejecutar set_updated_at');

select * from finish();
rollback;
