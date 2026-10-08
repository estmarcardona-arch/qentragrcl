// Ejecuta la CLI de Supabase con valores de .env.local (o del entorno de CI).
// Uso: tsx scripts/supabase-env.ts push | types
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const cli = "node_modules/.bin/supabase";
const action = process.argv[2];

function need(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta ${name} (ver .env.example).`);
    process.exit(1);
  }
  return value;
}

if (action === "push") {
  // Aplica solo migraciones nuevas; nunca reescribe las ya aplicadas.
  const extra = process.argv.includes("--dry-run") ? ["--dry-run"] : [];
  // En local la CLI pide confirmación; en CI se confirma de forma explícita.
  if (process.env.CI) extra.push("--yes");
  const r = spawnSync(cli, ["db", "push", "--db-url", need("SUPABASE_DB_URL"), ...extra], {
    stdio: "inherit",
  });
  process.exit(r.status ?? 1);
} else if (action === "types") {
  need("SUPABASE_ACCESS_TOKEN");
  const r = spawnSync(
    cli,
    // --project-id usa la API de gestión (requiere SUPABASE_ACCESS_TOKEN); no necesita Docker.
    [
      "gen",
      "types",
      "typescript",
      "--project-id",
      need("SUPABASE_PROJECT_REF"),
      "--schema",
      "public",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
  writeFileSync("src/lib/db/database.types.ts", r.stdout);
  console.log("Tipos escritos en src/lib/db/database.types.ts");
} else {
  console.error("Uso: tsx scripts/supabase-env.ts push [--dry-run] | types");
  process.exit(1);
}
