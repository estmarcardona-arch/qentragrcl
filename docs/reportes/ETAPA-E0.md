# Reporte de etapa E0 — Cimientos

**Fase del PRD:** F0 · **Rama:** `etapa/E0` · **Fecha:** 07/10/2026
**Estado:** construida; puertas 1, 2, 3 y 5 cumplidas. **Pendiente:** puerta 4 (revisión de `/_design` por el responsable).

## Puerta de salida

| #   | Condición                                                     | Estado        | Evidencia                                                                                                                                                                                    |
| --- | ------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Clon limpio + 5 comandos = app corriendo en local             | Cumplida      | Clon de `etapa/E0` en carpeta temporal → `npm ci` → `.env.local` → `npm run dev`: `/` 200, `/_design` 200, `/api/health` 200 (`database: ok`), `/no-existe` 404                              |
| 2   | CI en verde                                                   | Cumplida      | [Ejecución 37708683176](https://github.com/estmarcardona-arch/qentragrcl/actions/runs/37708683176), commit `8ad236c`: Calidad ✅ (48 s) · Integración ✅ (154 s)                             |
| 3   | App vacía en el entorno de pruebas con `/api/health` en verde | Cumplida      | Vercel, vista previa de `etapa/E0` (commit `0f836e0`): `/` 200, `/_design` 200, `/api/health` 200 (`database: ok`), `/no-existe` 404. Protegida con Vercel Authentication (sin secreto: 302) |
| 4   | Página `/_design` revisada por el responsable                 | **Pendiente** | Disponible en local (`http://localhost:3020/_design`) y en la vista previa de Vercel                                                                                                         |
| 5   | Reporte ETAPA-E0.md                                           | Cumplida      | Este documento                                                                                                                                                                               |

## Qué se construyó

| Punto del encargo    | Entregable                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Repositorio       | Estructura PRD §5 (`/supabase`, `/src`, `/docs`, `/e2e`, `AGENTS.md`); `.gitignore` con `.env*` excepto `.env.example`; `LICENSE` propietaria «Todos los derechos reservados»; README con arranque en 5 comandos                                                                                                                                                                                                                 |
| 2. Aplicación        | Next.js 16.4 (App Router, Turbopack) + TS estricto + Tailwind 4 + shadcn/ui + lucide-react, versiones exactas; alias `@/`; ESLint, Prettier, husky (pre-commit: lint-staged + tsc + Vitest; commit-msg: commitlint)                                                                                                                                                                                                              |
| 3. Sistema de diseño | Tokens del Prompt 0 en `src/app/globals.css` (colores, tres familias, tipografía Inter + JetBrains Mono, foco, objetivos táctiles de 44 px en tablet). Componentes: `StatusBadge`, `PageHeader`, `DataTable` (TanStack Table 9), `EmptyState`, `ErrorState`, `NoPermissionState`, `LoadingSkeleton`, `FormField`, `SodNotice`, `ControlledDocumentHeader` + `CopyStamp`, `DisabledReason`, variantes de botón. Página `/_design` |
| 4. Supabase          | `supabase/config.toml`; migraciones `0001_extensions.sql` (pgcrypto, pgtap) y `0002_utilities.sql` (`set_updated_at`, `health_check`); `seed.sql`; convenciones en `docs/CONVENCIONES_BD.md`; scripts `db:start`, `db:reset`, `db:stop`, `db:types`, `db:types:local`, `db:push`, `test:db`, `test:db:local`                                                                                                                     |
| 5. Cliente           | `src/lib/db` (navegador y servidor por separado, tipados con `Database`), tipos generados, `src/lib/rpc` (envoltorio tipado), `src/lib/format.ts` con pruebas                                                                                                                                                                                                                                                                    |
| 6. Observabilidad    | `src/lib/errors.ts` (códigos del PRD → regla + qué hacer), `src/lib/log.ts` (JSON por línea, oculta secretos), `not-found.tsx`, `error.tsx`, `global-error.tsx` en español, `GET /api/health`                                                                                                                                                                                                                                    |
| 7. CI                | GitHub Actions en cada push y PR: instalar, prettier, lint, tsc, Vitest, matriz requisito→prueba, versiones → Supabase local en el runner, migraciones, pgTAP, build, E2E + axe                                                                                                                                                                                                                                                  |
| 8. Entornos          | `docs/ENTORNOS.md`: local, pruebas y producción; variables por entorno; promoción de migraciones                                                                                                                                                                                                                                                                                                                                 |
| 9. Documentos        | `docs/VERSIONES.md` (generado y verificado en CI), `docs/CHANGELOG.md`, `docs/PREGUNTAS_ABIERTAS.md`                                                                                                                                                                                                                                                                                                                             |

**Migraciones aplicadas al proyecto Supabase de desarrollo/pruebas:** 0001 y 0002 (con confirmación de la CLI). **RPC:** `health_check()`. **Pantallas del catálogo S-xx:** ninguna (empiezan en E1).

## Resultados de pruebas

No hay AC del PRD asignados a F0.

| Prueba                                                                                                           | Requisito             | Local                                | CI                            |
| ---------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------ | ----------------------------- |
| Prettier, lint (0 advertencias), `tsc --noEmit`                                                                  | AGENTS 12             | Aprobado                             | Aprobado                      |
| Vitest: 7 archivos, 25 casos (formatos, catálogo de estados, errores, registro, RPC, `/_design`, AG-05)          | RNF-03, RNF-01, AG-05 | Aprobado                             | Aprobado                      |
| Matriz requisito→prueba (3 requisitos de E0 cubiertos)                                                           | PRD §14               | Aprobado                             | Aprobado                      |
| Versiones exactas (38 dependencias)                                                                              | AGENTS 10             | Aprobado                             | Aprobado                      |
| pgTAP `0001_extensions` (3) y `0002_utilities` (7)                                                               | E0                    | Aprobado 10/10 (proyecto en la nube) | Aprobado (base local efímera) |
| Build de producción                                                                                              | F0                    | Aprobado                             | Aprobado                      |
| E2E escritorio 1440 + tablet 1024: inicio, `/_design` (estados, búsqueda, orden, axe AA), `/api/health` 200, 404 | RNF-01                | Aprobado 14/14                       | Aprobado                      |

## Decisiones tomadas en esta etapa

- **CI con Supabase local en el runner**, como pide el encargo: no usa credenciales ni toca la nube. El secreto `SUPABASE_DB_URL` en GitHub **ya no es necesario**.
- **En el equipo local no hay Docker** (decisión del 07/10/2026: Supabase en la nube vía `.env.local`). Los scripts de base local existen y son los que usa el CI; en el equipo se usan `db:push` y `test:db` contra el proyecto en la nube.
- `gen_random_uuid()` es nativo: no se instala `uuid-ossp`. `pg_cron` no aplica en E0.
- Íconos: el diseño usa trazos propios equivalentes a lucide; se usa lucide-react (PRD §4) con el equivalente más cercano (p. ej. severidad «Crítica» → `OctagonAlert`).
- `/_design` está en `src/app/%5Fdesign` (en Next.js una carpeta con `_` es privada). Solo responde en desarrollo o con `ENABLE_DESIGN_PAGE=true`.

- **Vercel:** el proyecto se importó cuando `main` solo tenía documentos y el primer despliegue de `etapa/E0` falló (preset distinto de Next.js, causa probable). Se agregó `vercel.json` con `"framework": "nextjs"` y `engines.node = 24.x`; el siguiente despliegue salió bien. D-02 confirmada para pruebas: Supabase en la nube + Vercel.

## Deuda técnica y notas

- El parámetro de prueba que congela la fecha de referencia se implementa en E1, junto con la bitácora.
- `DataTable` filtra y pagina en el cliente; las listas de 10.000 filas (PRD §1) requerirán paginación en servidor en la etapa que las use.
- Next.js 16.4 y TanStack Table 9 son posteriores al conocimiento del modelo: se siguió la documentación incluida en sus paquetes.
- El paquete opcional `fsevents` (solo macOS) queda sin aprobar en `allowScripts`; no afecta.

## Preguntas abiertas nuevas

D-31 (proyecto Supabase de pruebas separado). D-02 actualizada: nube + Vercel solo para pruebas; producción pendiente. Detalle en `docs/PREGUNTAS_ABIERTAS.md`.

## Comandos para reproducir

```bash
git clone https://github.com/estmarcardona-arch/qentragrcl.git grufarcol-ebr && cd grufarcol-ebr
git checkout etapa/E0
npm ci
cp .env.example .env.local      # completar
npm run dev                     # /, /_design, /api/health
npm run ci                      # prettier, lint, tsc, vitest, matriz, versiones, build
npx playwright install chromium && npm run test:e2e
npm run test:db                 # pgTAP contra el proyecto de .env.local
```
