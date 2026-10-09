# Registro de cambios

Formato: una entrada por etapa y por tarea terminada (AGENTS.md, DoD). Fechas en DD/MM/AAAA.

## [E2] Administración — 07/10/2026

### Agregado

- Migración 0008: áreas con sigla de proceso, árbol sin ciclos y área dueña del SGD (GCA); catálogos versionados con bitácora (unidades, tipos de material y de equipo, clasificación de desviaciones, motivos de corrección), líneas de producto, perfiles regulatorios (PRD §10) con foto por lote, reglas de retención (RNF-05) y marcas detrás del interruptor de maquila (D-01); `admin_save_catalog` con lista blanca y motivo.
- Migración 0009: gestión de usuarios (listado, datos, activación sin borrado, roles con vigencia, ampliación y revocación, firma corta), auditor con vencimiento obligatorio y AC-11, combinaciones de roles prohibidas (D-18, SOD-7, SOD-9), configuración del sistema validada y política de contraseñas (mínimo 12, historial, caducidad).
- Migración 0010: matriz de permisos del PRD 2.2 generada desde el Markdown y `has_module_permission`.
- Pantallas S-03 (usuarios y roles, alta por invitación con enlace de un solo uso, detalle con bitácora) y S-04 (áreas, líneas, perfiles lado a lado, catálogos, retención, marcas, matriz de solo lectura, configuración); crear y cambiar contraseña; restablecimiento por enlace.
- Pruebas: pgTAP de RLS por catálogo, usuarios, AC-11 y matriz; E2E de administración, alta y baja, AC-11 y comparación de la matriz de S-04 con el PRD.

### Agregado (solicitud del responsable, 08/10/2026)

- PRD 1.5: sección 2.6 «Roles configurables», RF-07, AC-36…38, D-39 y D-40.
- Migración 0012: los roles pasan de un tipo enumerado a la tabla `roles` (15 roles del sistema protegidos y roles adicionales); funciones reservadas (`reserved_permissions`); matriz editable solo para roles adicionales; `admin_create_role`, `admin_update_role`, `admin_set_role_permissions`, `admin_set_role_incompatibilities`, `admin_set_role_active` (retirar o reactivar); vencimiento obligatorio por rol; la lectura de la bitácora se deriva del permiso de «Trazabilidad / Auditoría».
- S-04: pestaña «Roles y permisos» con el panel de permisos y restricciones, creación de roles y configuración por rol (permisos por módulo, incompatibilidades, opciones, retiro); la matriz muestra también los roles adicionales; el menú de un rol adicional se arma con sus permisos.

### Agregado (decisiones D-39 y D-40, 08/10/2026)

- PRD 1.6: aprobación de cambios de rol (sección 2.6), bandeja S-04B, AC-39…41, D-41.
- Migración 0013: solicitudes de cambio de rol (`role_change_requests`, `role_change_approvals`, numeración `CR-AAAA-NNNN`); `admin_request_role_change` (valida el cambio completo sin aplicarlo), `decide_role_change` (aprobar o rechazar con contraseña; quien solicita no aprueba; dos personas distintas), `admin_cancel_role_change`, `get_role_change_requests`. Rol adicional: aprueba `aq_dir`; permisos de un rol del sistema: `aq_dir` y `dt`; funciones reservadas con candado (su dueño no las pierde). Línea base del PRD guardada por celda (`prd_cell_text`). Las RPC de cambio directo de 0012 se eliminan.
- Bandeja «Cambios de roles» (`/cambios-roles`) para administración, Calidad, Dirección técnica y auditor, con antes y después; solicitudes pendientes en «Roles y permisos» y en cada rol; S-04 marca con «*» las celdas ajustadas.

### Corregido

- Migración 0011: `sign_record` valida registro, rol, orden y SOD antes de la contraseña; un rechazo por regla ya no consume intentos ni revierte el reinicio del contador. `practice_reauth` para la prueba en vivo.
- Lectura de sesión y cliente de servidor marcados como de tiempo de solicitud (`connection()`), sin errores de prerender con Cache Components.

## [E1] Núcleo GxP — 07/10/2026

### Agregado

- Migraciones 0003–0007: bitácora de solo-agregar con triggers genéricos (DI-1), registro de tablas con metadatos, bloqueo tras firma (DI-3) y sin borrado (DI-10); roles del PRD 2.1, perfiles, roles con vigencia, firma corta (DI-11) y configuración; firmas con `sign_record` (reautenticación configurable, huella SHA-256, orden de firmas, estado y bloqueo en una transacción), `check_sod` con SOD-1…SOD-10, `can_sign` y `verify_signature_integrity`; correcciones sin borrado con contador y aviso (DI-12); numeración sin saltos; bloqueo de cuenta por hook de Supabase Auth; eventos de sesión y `get_audit_trail`; reloj de referencia congelable en pruebas.
- pgTAP: línea base de seguridad (ninguna tabla sin RLS ni sin bitácora), AC-01, AC-02, AC-08, cada regla SOD con caso prohibido y permitido, RLS por rol, correcciones (AC-35) y sesión. Ayudas pgTAP y modo `test:db:pending` (prueba migraciones nuevas en una transacción revertida).
- Interfaz: S-01 inicio de sesión (mensaje único que no revela si el usuario existe), S-02 panel por rol con tarjetas «Sin datos», menú por rol, proxy de rutas protegidas, guardas por rol en servidor, cierre por inactividad con aviso, cierre de sesión.
- Componentes GxP: `SignatureModal`, `AuditTrailPanel`, `CorrectionDialog`, `LockedBanner`, `SignatureStamp`, `CorrectedValue`; utilidad de huella idéntica a `record_hash()`.
- Semilla local con los 15 usuarios ficticios del Prompt 0B; E2E de inicio de sesión, inactividad, bloqueo y firma con contraseña errónea.

## [E0] Cimientos — 07/10/2026

### Cambiado

- El servidor de desarrollo usa el puerto 3020 (`npm run dev` → http://localhost:3020); `supabase/config.toml` (auth local) actualizado al mismo puerto.

### Agregado (alcance ampliado de E0)

- Componentes base: `StatusBadge` (tres familias de color, catálogo con ícono + texto), `PageHeader`, `DataTable` (TanStack Table 9: búsqueda, orden, paginación, estados), `EmptyState`, `ErrorState`, `NoPermissionState`, `LoadingSkeleton`, `FormField`, `SodNotice`, `ControlledDocumentHeader` y `CopyStamp`, `DisabledReason`; variantes de botón del Prompt 0.
- Página `/_design` (solo desarrollo o con `ENABLE_DESIGN_PAGE=true`).
- Migración `0002_utilities.sql`: `set_updated_at()` y `health_check()`, con prueba pgTAP.
- Tipos generados (`src/lib/db/database.types.ts`) y envoltorio tipado de RPC (`src/lib/rpc`).
- Observabilidad: errores centralizados (`src/lib/errors.ts`), registro estructurado en servidor (`src/lib/log.ts`), páginas 404/500 en español, `GET /api/health`.
- CI: Supabase local en el runner, migraciones, pgTAP, build y E2E (sin credenciales).
- Scripts de Supabase local (`db:start`, `db:reset`, `test:db:local`, `db:stop`), commitlint, licencia propietaria, `docs/ENTORNOS.md`, `docs/CONVENCIONES_BD.md`.

### Agregado

- Repositorio git con `main` y rama `etapa/E0`; documentos fuente renombrados según PRD §5 (`docs/PRD_GRUFARCOL.md`, `docs/DOCUMENTO_MAESTRO_GRUFARCOL.md`) y exportaciones de diseño movidas a `docs/diseno/`.
- `AGENTS.md` (PRD §15 + reglas del proyecto) y `CLAUDE.md` que lo importa.
- Next.js 16.4 (App Router, TypeScript estricto, Turbopack), Tailwind CSS 4, shadcn/ui (Radix) y lucide-react.
- Tokens del sistema de diseño (Prompt 0) en `src/app/globals.css`: azul acero #1E4E8C, superficies, semáforo de calidad y vigencia, trámite, severidad violeta, escala tipográfica; Inter y JetBrains Mono; foco visible; solo tema claro.
- `src/lib/format.ts`: formatos es-CO (COP, números, porcentajes, fecha DD/MM/AAAA, fecha de documento DD-MM-AAAA, hora de 24 h en America/Bogota) con pruebas (RNF-03).
- Clientes de Supabase para navegador y servidor con clave pública (`src/lib/db`); `.env.example` sin valores reales; prueba AG-05 que impide `service_role` en `src/`.
- Supabase CLI, `supabase/config.toml`, migración `0001_extensions.sql` (pgcrypto, pgtap) y prueba pgTAP `0001_extensions.test.sql`; ejecutor pgTAP sin Docker (`npm run test:db`).
- Pruebas: Vitest, Playwright (escritorio 1440 px y tablet 1024 px) con axe (RNF-01, parcial).
- Calidad: ESLint, Prettier, husky + lint-staged (pre-commit: lint, formato, tsc, Vitest).
- Matriz requisito→prueba (`docs/VALIDACION/`) con los RF/AC del PRD por etapa y verificación en CI.
- Verificación de versiones exactas (`docs/VERSIONES.md`, `npm run versions`).
- CI en GitHub Actions: calidad, E2E + accesibilidad, base de datos (migraciones + pgTAP).
- `docs/PREGUNTAS_ABIERTAS.md` con D-01…D-26 y nuevas D-27…D-30.
