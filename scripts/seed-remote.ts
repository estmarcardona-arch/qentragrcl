// Carga supabase/seed.sql (usuarios ficticios del Prompt 0B) en el proyecto de SUPABASE_DB_URL.
// Solo para el proyecto de desarrollo/pruebas y con autorización del responsable (AGENTS.md 9 y 14).
// Es idempotente: no duplica usuarios ni roles. Exige --confirmar para ejecutarse.
import { existsSync, readFileSync } from "node:fs";
import { Client } from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Falta SUPABASE_DB_URL (ver .env.example).");
  process.exit(1);
}
if (!process.argv.includes("--confirmar")) {
  console.error("No se ejecutó: agregue --confirmar (requiere autorización del responsable).");
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();
await client.query("begin");
await client.query(readFileSync("supabase/seed.sql", "utf8"));
const { rows } = await client.query<{ n: string }>(
  "select count(*) as n from public.profiles where email like '%@grufarcol.test'",
);
await client.query("commit");
await client.end();
console.log(`Semilla aplicada: ${rows[0].n} usuarios ficticios en el proyecto.`);
