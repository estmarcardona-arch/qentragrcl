<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — GRUFARCOL eBR

Reglas permanentes del agente de desarrollo. Se leen antes de cada tarea y se respetan siempre.

## Fuente de verdad

1. `docs/PRD_GRUFARCOL.md`: especificación técnica. Si algo contradice a otro documento, **el PRD manda**.
2. `docs/DOCUMENTO_MAESTRO_GRUFARCOL.md`: contexto de negocio y alcance.
3. `docs/PROMPTS_CLAUDE_DESIGN_GRUFARCOL.md`: diseño de cada pantalla (Prompt 0 = sistema de diseño; Prompt 0B = datos ficticios).
4. `docs/diseno/`: exportaciones de Claude Design. Se reproducen fielmente; no se rediseña.
5. `docs/PREGUNTAS_ABIERTAS.md`: decisiones abiertas (D-xx) y valores por defecto adoptados.

Idioma: español en toda la interfaz y los textos de usuario, con trato de «usted». Código, tablas y funciones en inglés (snake_case en base de datos), salvo los códigos de documento y de error definidos en el PRD.

## Reglas del PRD (sección 15)

1. Leer el PRD completo antes de escribir código; trabajar **una fase a la vez** (sección 16).
2. Un cambio de esquema = una migración SQL numerada. Nunca editar migraciones ya aplicadas.
3. Toda tabla nueva: RLS activado, trigger de bitácora, políticas por rol y prueba pgTAP.
4. Reglas críticas en SQL/RPC; el cliente solo llama RPC tipadas.
5. No usar `service_role` en el cliente. No poner secretos en el repositorio.
6. No inventar reglas regulatorias: si falta información, registrar una pregunta abierta.
7. Definición de terminado por tarea: compila, lint limpio, pruebas relevantes en verde, RF vinculado en la matriz, sin datos reales en `seed.sql` y nota en `docs/CHANGELOG.md`.
8. Antes de cerrar cada fase: ejecutar todo el set de AC aplicable y reportar resultados.
9. Usar solo datos ficticios del Prompt 0B para semillas y pruebas.

## Reglas adicionales del proyecto

1. **Una etapa a la vez.** No adelantar trabajo de etapas futuras. Etapas E0…E11 = fases F0…F11 del PRD (F2B = E2B).
2. **Un cambio de esquema = una migración SQL numerada nueva** en `supabase/migrations` (`NNNN_descripcion.sql`). Jamás editar una migración ya aplicada.
3. **Toda tabla nueva:** RLS activado, trigger de bitácora (`audit_log`), políticas por rol, prueba pgTAP.
4. **Las reglas críticas viven en SQL:** funciones RPC `SECURITY DEFINER` con validación de rol, estado y SOD, escritura y bitácora en una sola transacción. El cliente solo llama RPC tipadas (`src/lib/rpc`).
5. **Nunca usar la clave `service_role` en el navegador; nunca poner secretos en el repositorio.** Solo variables de entorno; `.env.example` sin valores reales. (Prueba AG-05.)
6. **La hora la pone el servidor** (`now()`); se guarda en UTC y se muestra en America/Bogota. Formatos es-CO: fecha DD/MM/AAAA, 24 h, moneda COP con punto de miles y coma decimal (`src/lib/format.ts`). Las pruebas congelan la fecha de referencia con un parámetro de prueba que no afecta a producción.
7. **Los registros firmados quedan bloqueados** (`RECORD_LOCKED`). Las correcciones no borran: tachan con motivo, usuario y hora.
8. **No inventar reglas regulatorias ni valores de negocio.** Si falta información, registrar la pregunta en `docs/PREGUNTAS_ABIERTAS.md` (ID D-27 en adelante), usar el valor por defecto del PRD y avisar.
9. **Datos de semilla y de pruebas:** solo los ficticios del Prompt 0B. Nada de datos reales en el repositorio.
10. **Versiones exactas de dependencias** (sin `^` ni `~`; `.npmrc` con `save-exact=true`), registradas en `docs/VERSIONES.md`.
11. **Accesibilidad y diseño:** tokens y componentes del Prompt 0 (`src/app/globals.css`): tema claro, tablet 1024 px, tres familias de color (semáforo solo para calidad y vigencia; trámite en neutro/azul; violeta para severidad), azul acero #1E4E8C, códigos en monoespaciada (JetBrains Mono), Inter. Estados obligatorios en cada pantalla: cargando, vacío, error, sin permiso (y bloqueo por regla GMP).
12. **Definición de terminado (DoD) por tarea:** compila (`npm run typecheck`), lint y prettier limpios, pruebas relevantes en verde, matriz requisito→prueba actualizada (`docs/VALIDACION/matriz-trazabilidad.json`), nota en `docs/CHANGELOG.md`, sin datos reales.
13. **Commits pequeños y descriptivos** en español: `tipo(alcance): resumen`. Una rama por etapa (`etapa/E0`, `etapa/E1`…); se integra a `main` solo con CI verde y aprobación del responsable.
14. **Antes de algo destructivo o irreversible** (borrar datos, reiniciar la base, rotar claves, desplegar a producción) pedir confirmación explícita.

## Reporte de etapa

Al cerrar cada etapa: `docs/reportes/ETAPA-Ex.md` con lo construido (migraciones, RPC, pantallas), resultado de cada AC y prueba (aprobado/fallido), deuda técnica, preguntas abiertas nuevas y comandos para reproducir. Nunca declarar terminada una etapa con pruebas en rojo.

## Comandos

| Comando                                                       | Qué hace                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run dev`                                                 | Servidor de desarrollo (`/_design` y `/api/health` disponibles)                             |
| `npm run ci`                                                  | Prettier, lint, tsc, Vitest, matriz, versiones y build (job «Calidad» del CI + build)       |
| `npm run test` / `npm run test:e2e`                           | Vitest / Playwright + axe                                                                   |
| `npm run db:push`                                             | Aplica migraciones nuevas al proyecto de `SUPABASE_DB_URL` (pide confirmación)              |
| `npm run test:db`                                             | pgTAP contra `SUPABASE_DB_URL` (sin Docker)                                                 |
| `npm run test:db:pending`                                     | Prueba migraciones aún no aplicadas en una transacción que se revierte (antes de `db:push`) |
| `npm run db:start` · `db:reset` · `test:db:local` · `db:stop` | Supabase local (requiere Docker; es lo que usa el CI)                                       |
| `npm run db:types`                                            | Genera `src/lib/db/database.types.ts` (requiere `SUPABASE_ACCESS_TOKEN`)                    |
| `npm run traceability:write` · `versions:write`               | Regeneran `docs/VALIDACION/MATRIZ.md` y `docs/VERSIONES.md`                                 |

## Dónde va cada cosa

- Componentes shadcn: `src/components/ui` · componentes GxP: `src/components/gxp` · comunes: `src/components/common`.
- RPC tipadas: `src/lib/rpc` · clientes Supabase: `src/lib/db` · errores: `src/lib/errors.ts` · registro: `src/lib/log.ts`.
- Convenciones de base de datos: `docs/CONVENCIONES_BD.md` · entornos: `docs/ENTORNOS.md`.
