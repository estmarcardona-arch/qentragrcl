# Registro de cambios

Formato: una entrada por etapa y por tarea terminada (AGENTS.md, DoD). Fechas en DD/MM/AAAA.

## [E0] Cimientos — 07/10/2026

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
