# Convenciones de base de datos

Aplican a toda migración desde E0 (AGENTS.md reglas 2–4). Fuente: PRD §6.1.

## Migraciones

- Archivo `supabase/migrations/NNNN_descripcion.sql` (cuatro dígitos, consecutivo, snake_case en inglés). Ej.: `0003_core_identity.sql`.
- Una migración aplicada **nunca** se edita: todo cambio es una migración nueva.
- Cada migración empieza con un comentario: número, etapa y propósito.
- Cada migración nueva trae su prueba `supabase/tests/NNNN_descripcion.test.sql` (pgTAP, `begin … rollback`).

## Nombres

| Objeto             | Convención                                                                              | Ejemplo                                  |
| ------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------- |
| Tabla              | plural, snake_case, inglés                                                              | `material_lots`, `stage_orders`          |
| Columna            | snake_case; FK `<entidad>_id`; tiempos `*_at` (`timestamptz`); fechas `*_date` (`date`) | `batch_id`, `signed_at`, `expiry_date`   |
| Clave primaria     | `id uuid default gen_random_uuid()`                                                     |                                          |
| Código legible     | columna aparte, `UNIQUE`                                                                | `batch_code` = `L-2609-041`              |
| Enum               | singular, snake_case; valores del PRD en español                                        | `lot_status`: `cuarentena`, `aprobado`   |
| Función RPC        | verbo_objeto                                                                            | `sign_record`, `release_batch`           |
| Función de trigger | `set_*` / `tg_*`                                                                        | `set_updated_at`                         |
| Trigger            | `<tabla>_<momento>_<acción>`                                                            | `material_lots_before_update_updated_at` |
| Política RLS       | `<rol o grupo>_<acción>_<tabla>` en texto descriptivo                                   | `"cc_jefe can update material_lots"`     |
| Índice             | `<tabla>_<columnas>_idx`                                                                | `material_lots_material_id_idx`          |
| Vista de lectura   | prefijo `v_`                                                                            | `v_master_list`                          |

## Columnas comunes (PRD §6.1)

- Todas las tablas: `id`, `created_at`, `created_by`, `updated_at`, `updated_by`.
- Tablas firmables: además `status` y `locked_at`.
- `updated_at` lo fija el trigger `set_updated_at()` (0002); `created_at` usa `default now()`. El cliente nunca escribe la hora.
- Cantidades `numeric(14,4)` + `unit`; dinero `numeric(14,2)` (COP).
- Nada se borra: `deleted_at` solo en catálogos; en registros de lote el borrado se bloquea por trigger.

## Seguridad

- RLS activado en la misma migración que crea la tabla, con políticas por rol.
- Toda función: `set search_path = ''` y nombres calificados (`public.tabla`).
- Funciones que mutan datos críticos: `security definer`, validan rol, estado y SOD, y escriben bitácora en la misma transacción.
- Se revoca `execute` a `public` y se concede solo a los roles necesarios.
- Errores de negocio: `raise exception 'CODIGO: detalle'` con los códigos del PRD (`src/lib/errors.ts` los traduce).

## Extensiones

`pgcrypto` y `pgtap` (0001). `gen_random_uuid()` es nativo de Postgres; no se usa `uuid-ossp`. `pg_cron` no se instala en E0: se evaluará cuando una etapa requiera tareas programadas (p. ej. alertas de vencimiento).
