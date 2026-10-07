# Reporte de etapa E0 — Cimientos

**Fase del PRD:** F0 · **Rama:** `etapa/E0` · **Fecha:** 07/10/2026
**Estado:** construida y verificada en local. **No se puede cerrar todavía:** faltan tres verificaciones que dependen de credenciales y servicios externos (ver «Pendiente para cerrar»).

## Qué se construyó

| Área        | Entregable                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repositorio | git con `main` (documentos fuente) y `etapa/E0`; `docs/` reorganizado según PRD §5; exportaciones de diseño en `docs/diseno/`                                                                                |
| Reglas      | `AGENTS.md` (PRD §15 + 14 reglas del proyecto + bloque de Next.js 16), `CLAUDE.md`                                                                                                                           |
| App         | Next.js 16.4 (App Router, TS estricto, Turbopack), React 19.3, página base `/` en es-CO                                                                                                                      |
| Diseño      | Tailwind 4 + shadcn/ui (Radix) + lucide-react; tokens del Prompt 0 en `src/app/globals.css` (primario, superficies, semáforo, trámite, severidad, tipografía, foco); Inter + JetBrains Mono; solo tema claro |
| Formatos    | `src/lib/format.ts` (COP, números, %, DD/MM/AAAA, DD-MM-AAAA, 24 h, America/Bogota)                                                                                                                          |
| Supabase    | Clientes navegador/servidor con clave pública; `supabase/config.toml`; `.env.example`                                                                                                                        |
| Migraciones | `0001_extensions.sql` (pgcrypto, pgtap)                                                                                                                                                                      |
| RPC         | Ninguna (no corresponde a E0)                                                                                                                                                                                |
| Pantallas   | Ninguna del catálogo S-xx (empiezan en E1)                                                                                                                                                                   |
| Pruebas     | Vitest, Playwright + axe (1440 y 1024 px), pgTAP con ejecutor propio sin Docker                                                                                                                              |
| Calidad     | ESLint, Prettier (+ plugin Tailwind), husky + lint-staged, `tsc --noEmit` con `next typegen`                                                                                                                 |
| Validación  | Matriz requisito→prueba con los 96 RF/AC/RNF por etapa (`docs/VALIDACION/`); el CI falla si un requisito de una etapa alcanzada no tiene prueba                                                              |
| Versiones   | Todas exactas; `docs/VERSIONES.md` verificado en CI                                                                                                                                                          |
| CI          | `.github/workflows/ci.yml`: Calidad → E2E/axe y Base de datos (migraciones + pgTAP)                                                                                                                          |

## Resultados de pruebas

No hay AC del PRD asignados a F0. La salida verificable de F0 es «App vacía desplegada, CI en verde».

| Prueba                                               | Requisito        | Resultado (local, 07/10/2026)                    |
| ---------------------------------------------------- | ---------------- | ------------------------------------------------ |
| `npm run format:check`                               | AGENTS 12        | Aprobado                                         |
| `npm run lint` (0 advertencias)                      | AGENTS 12        | Aprobado                                         |
| `npm run typecheck`                                  | AGENTS 12        | Aprobado                                         |
| `src/lib/format.test.ts` (7 casos)                   | RNF-03           | Aprobado                                         |
| `src/lib/db/secrets.test.ts` (2 casos)               | AG-05            | Aprobado                                         |
| `e2e/inicio.spec.ts` (2 casos × escritorio y tablet) | RNF-01 (parcial) | Aprobado (4/4, sin violaciones axe WCAG 2.1 AA)  |
| `npm run traceability`                               | PRD §14          | Aprobado (3 requisitos de E0 cubiertos)          |
| `npm run versions`                                   | AGENTS 10        | Aprobado (36 dependencias exactas)               |
| `npm run build`                                      | F0               | Aprobado                                         |
| `npm run db:push` (0001)                             | F0               | **No ejecutado:** falta `.env.local`             |
| `supabase/tests/0001_extensions.test.sql` (3 casos)  | F0               | **No ejecutado:** falta `SUPABASE_DB_URL`        |
| CI en GitHub Actions                                 | F0               | **No ejecutado:** falta el remoto y los secretos |
| Despliegue en Vercel                                 | F0               | **Pendiente:** acordado para el final, con guía  |

## Pendiente para cerrar E0

1. Crear `.env.local` a partir de `.env.example` con el proyecto Supabase de desarrollo. Después: `npm run db:push` y `npm run test:db`.
2. Conectar el remoto de GitHub, subir `main` y `etapa/E0`, y crear el secreto `SUPABASE_DB_URL` en el repositorio (Settings → Secrets and variables → Actions).
3. CI en verde en GitHub, y luego aprobación para integrar `etapa/E0` → `main`.
4. Despliegue en Vercel (diferido por decisión del responsable).

## Deuda técnica y notas

- `npm run db:types` usa `--project-id` y necesita `SUPABASE_ACCESS_TOKEN`; con `--db-url` la CLI requeriría Docker. Hace falta desde E1.
- El job «Base de datos» aplica migraciones al proyecto de desarrollo en cada push a `etapa/**` o `main` (en PR solo simula). Si más adelante hay un proyecto de producción, tendrá su propio flujo con confirmación explícita (AGENTS 14).
- El parámetro de prueba que congela la fecha de referencia se implementa en la primera etapa que lo necesite (E1), junto con la bitácora, para cumplir la regla 3 de AGENTS.
- El componente `button.tsx` de shadcn conserva su estilo base; se ajustará a las variantes del Prompt 0 (primario, secundario, peligro, fantasma; motivo de deshabilitado) cuando se construyan las pantallas en E1.
- Next.js 16.4 es posterior al conocimiento del modelo: se siguió la documentación incluida en `node_modules/next/dist/docs/` (Turbopack por defecto, `proxy` en lugar de `middleware`, `cacheComponents`).

## Preguntas abiertas nuevas

D-27 (estado de fórmulas en `document_versions`), D-28 (prefijo `SD-` duplicado), D-29 (segundo factor: TOTP propuesto), D-30 (pgTAP en producción). Detalle en `docs/PREGUNTAS_ABIERTAS.md`. D-02 queda parcial y D-09 resuelta.

## Comandos para reproducir

```bash
nvm use && npm ci
npx playwright install chromium
npm run ci            # prettier, lint, tsc, vitest, matriz, versiones, build
npm run test:e2e      # Playwright + axe
cp .env.example .env.local   # y completar
npm run db:push       # aplica 0001_extensions.sql (pide confirmación)
npm run test:db       # pgTAP
```
