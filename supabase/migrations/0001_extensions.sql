-- 0001_extensions.sql · Etapa E0 (cimientos)
-- Extensiones base. No crea tablas de negocio.
--   pgcrypto: hash SHA-256 de registros firmados (DI-7) y verificación de contraseña en la firma (DI-2, E1).
--   pgtap:    pruebas de base de datos (PRD §14).
-- En Supabase las extensiones viven en el esquema «extensions».

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgtap with schema extensions;
