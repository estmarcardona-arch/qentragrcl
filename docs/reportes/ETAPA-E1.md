# Reporte de etapa E1 — Núcleo GxP

**Fase del PRD:** F1 · **Rama:** `etapa/E1` · **Fecha:** 07/10/2026
**Estado:** construida; AC-01, AC-02 y AC-08 aprobados; CI en verde. **Pendiente:** revisión de S-01 y S-02 por el responsable. Usuarios de prueba cargados en la nube con autorización (07/10/2026); E2E con usuarios contra la nube: 28 aprobadas, 2 omitidas (bloqueo por hook, D-32 opción A).

## Puerta de salida

| #   | Condición                                           | Estado        | Evidencia                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | AC-01, AC-02 y AC-08 aprobados                      | Cumplida      | pgTAP `0005_signatures_sod` (AC-01, AC-02) y `0003_audit_log` (AC-08), en la nube y en la CI                                                                                                                                                               |
| 2   | Ninguna tabla sin RLS; verificación que falla la CI | Cumplida      | `supabase/tests/0000_security_baseline.test.sql`: toda tabla de `public` y `app_private` con RLS, toda tabla de negocio con trigger de bitácora, ningún rol de la API con escritura sobre `audit_log`, toda tabla firmable con `locked_at`. Corre en la CI |
| 3   | S-01 y S-02 revisadas por el responsable            | **Pendiente** | Ver «Pendiente para cerrar»                                                                                                                                                                                                                                |
| 4   | Reporte ETAPA-E1.md                                 | Cumplida      | Este documento                                                                                                                                                                                                                                             |

CI: [ejecución 37717500440](https://github.com/estmarcardona-arch/qentragrcl/actions/runs/37717500440), commit `d025c10`: Calidad ✅ · Integración (Supabase local, migraciones, semilla, pgTAP, build, E2E) ✅.

## Qué se construyó

### Migraciones (aplicadas al proyecto de desarrollo/pruebas)

| Migración                        | Contenido                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0003_audit_log.sql`             | `audit_log` de solo-agregar: sin UPDATE/DELETE/TRUNCATE/INSERT para `anon`, `authenticated` y `service_role`, y trigger que bloquea incluso al dueño. Trigger genérico `audit_row_change` (quién, qué, antes/después, hora del servidor, motivo, IP). `set_row_metadata`, `enforce_record_lock` (RECORD_LOCKED), `prevent_delete`, `prevent_update`, `app_private.register_table`. Reloj de referencia `reference_now()` congelable solo en pruebas. `server_now()` |
| `0004_identity.sql`              | Enum `app_role` (15 roles del PRD 2.1), `profiles` (vinculada a `auth.users`), `user_roles` con vigencia y revocación, funciones de rol, `signature_registry` con firma corta automática (DI-11), `app_settings` (inactividad 15 min, 5 intentos y 15 min de bloqueo, método de reautenticación, umbral de correcciones), RLS por rol, `get_my_context()`                                                                                                           |
| `0005_signatures_sod.sql`        | `signable_tables`, `sign_permissions` (rol, firma previa exigida, estado resultante), `sod_cross_rules`, `signatures` (solo-agregar), `sign_attempts`. `record_hash` (SHA-256 del jsonb canónico), `check_sod` (SOD-1…SOD-10), `can_sign`, `sign_record` (reautenticación, rol, orden, SOD, huella, firma, bloqueo, estado y bitácora en una transacción), `verify_signature_integrity`                                                                             |
| `0006_corrections_numbering.sql` | `corrections` (solo-agregar) y `record_correction` (valor anterior, nuevo, motivo, firma corta, hora; contador y aviso al superar el umbral), vista `v_record_corrections`; `numbering_sequences`, `format_sequence_code`, `next_number` (sin saltos, reinicio anual)                                                                                                                                                                                               |
| `0007_auth_session.sql`          | `login_attempts` y hook `hook_password_verification_attempt` (bloqueo tras 5 intentos durante 15 minutos, también si se llama la API de Auth directamente), `log_session_event` (inicio, cierre, inactividad), `get_audit_trail`                                                                                                                                                                                                                                    |

### RPC expuestas a la aplicación

`sign_record`, `can_sign`, `verify_signature_integrity`, `record_correction`, `get_my_context`, `get_audit_trail`, `log_session_event`, `server_now`, `reference_now`, `has_role`, `has_any_role`, `current_user_roles`, `health_check`. `next_number` y `check_sod` son internas (sin permiso para la API).

### Interfaz

| Pieza           | Detalle                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S-01 `/login`   | Correo y contraseña; mensaje único que no revela si el usuario existe ni si está bloqueado; avisos de cierre por inactividad y de cierre de sesión; sin rol activo no entra (cubre el auditor vencido)                                     |
| S-02 `/inicio`  | Saludo, fecha, semana ISO y cargo; tarjetas por rol del diseño en estado «Sin datos» con la etapa en que se habilitan; menú lateral por rol (las secciones futuras, deshabilitadas); barra superior y menú de usuario con cierre de sesión |
| Proxy y guardas | `src/proxy.ts`: refresca la sesión, protege las rutas privadas y cierra la sesión por inactividad; `requireSession` y `checkRoles` en servidor                                                                                             |
| Inactividad     | 15 min (configurable en `app_settings`), aviso 60 s antes, registro en bitácora                                                                                                                                                            |
| Componentes GxP | `SignatureModal`, `AuditTrailPanel`, `CorrectionDialog`, `SodNotice` (E0), `LockedBanner`, `SignatureStamp`, `CorrectedValue`; prueba en vivo en `/_design`                                                                                |
| Huella          | `src/lib/gxp/hash.ts`, idéntica a `record_hash()` (vector verificado contra la base)                                                                                                                                                       |

### Semilla

`supabase/seed.sql`: los 15 usuarios ficticios del Prompt 0B, uno por rol, con correo `@grufarcol.test` y contraseña de desarrollo `Grufarcol.Dev.2026`. Solo se carga en local y en la CI (`supabase start`); `db push` no la aplica a la nube.

## Resultados de pruebas

| Prueba                                                | Requisito                                        | Resultado                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| pgTAP `0000_security_baseline` (4)                    | Puerta de salida                                 | Aprobado                                                                                                     |
| pgTAP `0003_audit_log` (14)                           | **AC-08**, DI-1                                  | Aprobado: UPDATE, DELETE, TRUNCATE e INSERT dan 42501 para `authenticated`; el dueño también queda bloqueado |
| pgTAP `0004_identity` (19)                            | RLS por rol, DI-11                               | Aprobado                                                                                                     |
| pgTAP `0005_signatures_sod` (43)                      | **AC-01**, **AC-02**, SOD-1…10, DI-2, DI-3, DI-7 | Aprobado                                                                                                     |
| pgTAP `0006_corrections_numbering` (14)               | DI-4, DI-12, AC-35, DI-9                         | Aprobado                                                                                                     |
| pgTAP `0007_auth_session` (11)                        | RF-01                                            | Aprobado                                                                                                     |
| pgTAP total                                           |                                                  | **115/115** en la nube y en la CI                                                                            |
| Vitest (44 casos en 12 archivos)                      | RF-01, RF-02, RNF-01, RNF-03, AG-05, DI-7        | Aprobado                                                                                                     |
| Playwright + axe (30 casos: 15 × escritorio y tablet) | RF-01, RF-02, RNF-01, DI-2                       | Aprobado en la CI                                                                                            |
| Matriz requisito→prueba (8 requisitos hasta E1)       | PRD §14                                          | Aprobado                                                                                                     |

### Reglas SOD: caso prohibido y caso permitido

| Regla         | Prohibido (código)                                                    | Permitido                                        |
| ------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| SOD-1 (AC-01) | Ejecutor verifica su paso → `SOD_VIOLATION`                           | Otra persona verifica                            |
| SOD-2         | Verificador aprueba → `SOD_VIOLATION`                                 | El director técnico aprueba                      |
| SOD-3         | Autor aprueba su versión → `SOD_VIOLATION`                            | El revisor aprueba                               |
| SOD-4         | Quien dispensó verifica la dispensación → `SOD_VIOLATION`             | La coordinadora verifica                         |
| SOD-5         | Quien analizó aprueba el certificado del mismo lote → `SOD_VIOLATION` | Aprueba el de otro lote                          |
| SOD-6         | Quien ejecutó pasos libera el lote → `SOD_VIOLATION`                  | Libera un director técnico que no ejecutó        |
| SOD-7         | Admin (con rol de calidad) firma calidad → `FORBIDDEN_ROLE`           | Jefe de calidad sin rol admin                    |
| SOD-8         | Autor revisa su versión → `SOD_VIOLATION`                             | Otra persona revisa; el revisor sí puede aprobar |
| SOD-9         | Master o analista documental firman ejecución → `FORBIDDEN_ROLE`      | Auxiliar de producción                           |
| SOD-10        | Editar versión aprobada → `RECORD_LOCKED`                             | Editar versión en borrador                       |

### E2E (CI)

Inicio de sesión correcto (S-02 del rol, sin violaciones AA); correo inexistente y contraseña errónea con el mismo mensaje; ruta privada sin sesión lleva a `/login`; cierre de sesión; **expiración por inactividad**; **bloqueo tras 5 intentos fallidos** (la contraseña correcta se rechaza mientras dura el bloqueo); **firma con contraseña errónea** («Le quedan 2 intentos») y, con la correcta, la reautenticación pasa.

## Decisiones tomadas

- **Reautenticación:** contraseña por defecto, como pide el encargo de E1; el método es configurable (`reauth_method` = `password` o `password_mfa`, que exige sesión AAL2). El TOTP queda para definir (D-29).
- **Significados de firma:** `ejecuto`, `verifico`, `reviso`, `aprobo`, `libero` (PRD §6.3) y `actualizo` («Actualizado por» del SGD). El encargo dice «elaboró»; en el PRD corresponde a `actualizo`.
- **Firma corta:** según PRD DI-11, «inicial del primer nombre, punto y primer apellido» (p. ej. «L. Barrera»). El sello agrega fecha y hora («L. Barrera · 05/10/2026 14:32»).
- **SOD-7 y SOD-9** se aplican si el usuario tiene el rol (admin; master o aq_doc), aunque tenga además otro rol que permita firmar.
- **Bloqueo de cuenta** con hook de Supabase Auth, para que no se pueda saltar llamando la API de Auth directamente.
- **Un fallo de contraseña al firmar no lanza excepción**: devuelve `{ok:false}` para que el intento quede registrado (con excepción se revertiría).
- **Modo `test:db:pending`**: aplica las migraciones nuevas y corre pgTAP en una transacción que se revierte, contra la nube y sin Docker; así se probaron 0003–0007 antes de aplicarlas.
- La pantalla no muestra «Cuenta bloqueada» ni «Le quedan N intentos» en el inicio de sesión, aunque el diseño los muestra: hacerlo revelaría que el usuario existe, contra el encargo. Usa un mensaje único que explica la regla del bloqueo.
- «¿Olvidó su contraseña?» remite a Administración (no hay flujo de restablecimiento todavía, D-34).

## Deuda técnica y notas

- **Hook en la nube (D-32):** hay que activarlo en el panel de Supabase; mientras tanto, el bloqueo tras intentos solo funciona en local y en la CI.
- **Registro público en la nube:** desactivarlo en el panel (en local ya está desactivado).
- La contraseña de la firma viaja a la RPC por HTTPS; conviene revisar que el registro de sentencias de Postgres no guarde parámetros en producción.
- Las tarjetas de S-02 no tienen datos (no existen los módulos); se conectan en cada etapa.
- Primer intento de la CI: el inicio de sesión fallaba porque `[auth.email] enable_signup = false` apaga el proveedor de correo; corregido (el registro público se desactiva con `[auth] enable_signup = false`).

## Preguntas abiertas nuevas

D-32 (hook en el plan de la nube), D-33 (intentos de firma: 3 por defecto), D-34 (restablecimiento de contraseña), D-35 (política de contraseñas). D-29 actualizada.

## Pendiente para cerrar E1

1. ~~Usuarios de prueba en la nube~~: cargados con autorización del responsable (`npm run seed:remote -- --confirmar`).
2. **Revisión de S-01 y S-02** por el responsable.
3. Desactivar el registro público en el panel de Supabase. El hook no está disponible en el plan actual: se sigue sin él en pruebas (D-32, opción A).
4. Aprobación para integrar `etapa/E1` a `main`.

## Comandos para reproducir

```bash
git checkout etapa/E1 && npm ci
npm run ci                     # prettier, lint, tsc, vitest, matriz, versiones, build
npm run test:db                # pgTAP contra el proyecto de .env.local (115 pruebas)
npm run test:db:pending        # prueba migraciones nuevas sin aplicarlas (transacción revertida)
npm run test:e2e               # E2E sin usuarios; con la semilla: E2E_SEED_USERS=1 (y E2E_AUTH_HOOK=1)
# Con Docker: npm run db:start && npm run test:db:local && E2E_SEED_USERS=1 E2E_AUTH_HOOK=1 npm run test:e2e
```
