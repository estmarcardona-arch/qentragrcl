# Versiones

Todas las dependencias se fijan con versión exacta (`.npmrc`: `save-exact=true`). La tabla de paquetes se genera con `npm run versions:write`; el CI falla si no coincide con `package.json` (`npm run versions`).

## Entorno

| Herramienta | Versión | Notas |
|---|---|---|
| Node.js | 24.21.0 | Fijada en `.nvmrc`; mínimo declarado en `package.json` (`engines`) |
| npm | 11.19.0 | |
| Supabase CLI | 2.120.0 | Paquete `supabase` (devDependency); no requiere Docker para `db push` |
| Postgres (Supabase) | 17 | `supabase/config.toml` → `major_version` |
| Chromium (Playwright) | Headless Shell 156.0.8078.4 | `npx playwright install chromium` |
| shadcn/ui (CLI) | 4.21.4 | Estilo `radix-nova`, base Radix; colores reemplazados por los tokens del Prompt 0 |
| GitHub Actions | checkout@v5 · setup-node@v5 · upload-artifact@v4 | `.github/workflows/ci.yml` |

## Paquetes npm

<!-- deps:start -->
| Paquete | Versión | Tipo |
|---|---|---|
| `@axe-core/playwright` | 4.13.0 | desarrollo |
| `@playwright/test` | 1.64.0 | desarrollo |
| `@supabase/ssr` | 0.12.7 | producción |
| `@supabase/supabase-js` | 2.117.3 | producción |
| `@tailwindcss/turbopack` | 4.3.3 | desarrollo |
| `@testing-library/dom` | 10.4.2 | desarrollo |
| `@testing-library/react` | 16.3.3 | desarrollo |
| `@types/node` | 24.19.1 | desarrollo |
| `@types/pg` | 8.23.1 | desarrollo |
| `@types/react` | 19.3.0 | desarrollo |
| `@types/react-dom` | 19.3.0 | desarrollo |
| `@vitejs/plugin-react` | 6.1.2 | desarrollo |
| `class-variance-authority` | 0.7.1 | producción |
| `cn` | 0.4.0 | producción |
| `eslint` | 9.39.5 | desarrollo |
| `eslint-config-next` | 16.4.0 | desarrollo |
| `husky` | 9.1.7 | desarrollo |
| `jsdom` | 30.1.2 | desarrollo |
| `lint-staged` | 17.6.0 | desarrollo |
| `lucide-react` | 1.52.0 | producción |
| `next` | 16.4.0 | producción |
| `pg` | 8.23.1 | desarrollo |
| `prettier` | 3.9.9 | desarrollo |
| `prettier-plugin-tailwindcss` | 0.8.1 | desarrollo |
| `radix-ui` | 1.7.0 | producción |
| `react` | 19.3.0 | producción |
| `react-dom` | 19.3.0 | producción |
| `server-only` | 0.0.1 | producción |
| `shadcn` | 4.21.4 | producción |
| `supabase` | 2.120.0 | desarrollo |
| `tailwindcss` | 4.3.3 | desarrollo |
| `tsx` | 4.23.15 | desarrollo |
| `tw-animate-css` | 1.4.0 | producción |
| `typescript` | 5.9.3 | desarrollo |
| `vite-tsconfig-paths` | 6.1.1 | desarrollo |
| `vitest` | 5.0.3 | desarrollo |
<!-- deps:end -->
