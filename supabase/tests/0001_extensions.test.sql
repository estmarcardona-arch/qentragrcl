-- E0 · Las extensiones base existen.
begin;
select plan(3);

select has_extension('pgcrypto', 'pgcrypto instalada');
select has_extension('pgtap', 'pgtap instalada');
select is(
  encode(extensions.digest('abc', 'sha256'), 'hex'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  'SHA-256 disponible (vector de prueba FIPS 180-2)'
);

select * from finish();
rollback;
