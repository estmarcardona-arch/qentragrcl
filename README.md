# GRUFARCOL eBR

Plataforma web de registro electrónico de lote (eBR), trazabilidad, liberación y gestión documental. Nombre de trabajo.

- Especificación: [`docs/PRD_GRUFARCOL.md`](docs/PRD_GRUFARCOL.md)
- Reglas del agente de desarrollo: [`AGENTS.md`](AGENTS.md)
- Reportes por etapa: [`docs/reportes/`](docs/reportes/)

## Puesta en marcha

```bash
nvm use                 # Node de .nvmrc
npm ci
cp .env.example .env.local   # complete los valores del proyecto Supabase de desarrollo
npm run dev
```

Verificación local equivalente al CI: `npm run ci`, `npm run test:e2e`, `npm run db:push` y `npm run test:db`.
