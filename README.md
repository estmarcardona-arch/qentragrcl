# GRUFARCOL eBR

Plataforma web de registro electrónico de lote (eBR), trazabilidad, liberación y gestión documental. Nombre de trabajo. © 2026 GRUFARCOL. Todos los derechos reservados (ver [LICENSE](LICENSE)).

- Especificación: [`docs/PRD_GRUFARCOL.md`](docs/PRD_GRUFARCOL.md)
- Reglas del agente de desarrollo: [`AGENTS.md`](AGENTS.md)
- Entornos: [`docs/ENTORNOS.md`](docs/ENTORNOS.md) · Reportes por etapa: [`docs/reportes/`](docs/reportes/)

## Arranque en 5 comandos

Requisitos: Node 24 (ver `.nvmrc`) y git.

```bash
git clone https://github.com/estmarcardona-arch/qentragrcl.git grufarcol-ebr
cd grufarcol-ebr
npm ci
cp .env.example .env.local   # complete las variables (ver tabla en docs/ENTORNOS.md)
npm run dev                  # http://localhost:3000 · componentes: /_design · salud: /api/health
```

## Otros comandos

| Comando                                                       | Qué hace                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `npm run ci`                                                  | Prettier, lint, tsc, Vitest, matriz requisito→prueba, versiones y build |
| `npm run test:e2e`                                            | Playwright + axe (escritorio 1440 px y tablet 1024 px)                  |
| `npm run db:push` / `npm run test:db`                         | Migraciones y pgTAP contra el proyecto de `SUPABASE_DB_URL`             |
| `npm run db:start` / `db:reset` / `test:db:local` / `db:stop` | Supabase local (requiere Docker)                                        |
| `npm run db:types`                                            | Tipos TypeScript desde el proyecto Supabase                             |
