# Registro de cambios

Formato: una entrada por etapa y por tarea terminada (AGENTS.md, DoD). Fechas en DD/MM/AAAA.

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
