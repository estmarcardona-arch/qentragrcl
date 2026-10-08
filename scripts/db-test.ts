// Ejecuta las pruebas pgTAP de supabase/tests contra SUPABASE_DB_URL sin Docker.
// Cada archivo maneja su propia transacción (begin … rollback), así no deja datos.
// Falla (código 1) si hay un «not ok», si el plan no coincide o si un archivo da error.
//
// --pending: prueba migraciones AÚN NO APLICADAS sin dejar rastro. Abre una transacción, aplica
// las migraciones pendientes, corre cada prueba en un savepoint y al final revierte todo.
// --seed (con --pending): carga además supabase/seed.sql dentro de la misma transacción.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

// --local: base de `supabase start` (Docker). Sin la bandera: SUPABASE_DB_URL (.env.local o CI).
const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const useLocal = process.argv.includes("--local");
if (!useLocal && existsSync(".env.local")) process.loadEnvFile(".env.local");

const dbUrl = useLocal ? LOCAL_DB_URL : process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("Falta SUPABASE_DB_URL (ver .env.example).");
  process.exit(1);
}

const testsDir = join("supabase", "tests");
const helpers = readFileSync(join(testsDir, "helpers", "helpers.sql"), "utf8");

// Inserta las ayudas (pg_temp) justo después del primer «begin;» del archivo de prueba.
function withHelpers(sql: string): string {
  const match = /^\s*begin\s*;/im.exec(sql);
  if (!match) return sql;
  const end = match.index + match[0].length;
  return `${sql.slice(0, end)}\n${helpers}\n${sql.slice(end)}`;
}
const usePending = process.argv.includes("--pending");
const migrationsDir = join("supabase", "migrations");

// En modo --pending cada archivo usa un savepoint dentro de la transacción general.
function asSavepoint(sql: string): string {
  return sql
    .replace(/^\s*begin\s*;/im, "savepoint test_file;")
    .replace(/rollback\s*;\s*$/i, "rollback to savepoint test_file;");
}

const files = readdirSync(testsDir)
  .filter((f) => f.endsWith(".test.sql"))
  .sort();

type Result = { file: string; passed: number; failed: number; planned: number; error?: string };

function tapLines(results: unknown): string[] {
  const list = Array.isArray(results) ? results : [results];
  const lines: string[] = [];
  for (const r of list as { rows?: Record<string, unknown>[] }[]) {
    for (const row of r.rows ?? []) {
      for (const value of Object.values(row)) {
        if (typeof value === "string") lines.push(...value.split("\n"));
      }
    }
  }
  return lines;
}

async function run() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  await client.query("set search_path = public, extensions");

  if (usePending) {
    await client.query("begin");
    const applied = new Set(
      (
        await client.query<{ version: string }>(
          "select version from supabase_migrations.schema_migrations",
        )
      ).rows.map((r) => r.version),
    );
    const pending = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql") && !applied.has(f.split("_")[0]))
      .sort();
    for (const m of pending) {
      try {
        await client.query(readFileSync(join(migrationsDir, m), "utf8"));
        console.log(`(transacción) aplicada ${m}`);
      } catch (e) {
        console.error(`FALLIDO  migración ${m}: ${e instanceof Error ? e.message : String(e)}`);
        await client.query("rollback").catch(() => undefined);
        await client.end();
        process.exit(1);
      }
    }
    if (process.argv.includes("--seed")) {
      await client.query(readFileSync(join("supabase", "seed.sql"), "utf8"));
      const { rows } = await client.query<{ n: string }>(
        "select count(*) as n from public.profiles p join public.signature_registry s on s.user_id = p.id " +
          "where p.email like '%@grufarcol.test' and cardinality(public.user_active_roles(p.id)) > 0",
      );
      console.log(
        `(transacción) semilla cargada: ${rows[0].n} usuarios ficticios con rol y firma corta`,
      );
    }
    await client.query("set search_path = public, extensions");
  }

  const results: Result[] = [];
  for (const file of files) {
    const raw = withHelpers(readFileSync(join(testsDir, file), "utf8"));
    const sql = usePending ? asSavepoint(raw) : raw;
    const result: Result = { file, passed: 0, failed: 0, planned: 0 };
    try {
      const lines = tapLines(await client.query(sql));
      for (const line of lines) {
        const plan = /^1\.\.(\d+)/.exec(line);
        if (plan) result.planned = Number(plan[1]);
        else if (/^ok \d+/.test(line)) result.passed++;
        else if (/^not ok \d+/.test(line)) result.failed++;
        if (line.startsWith("not ok") || line.startsWith("#")) console.log(`  ${file}: ${line}`);
      }
      if (result.planned !== result.passed + result.failed) {
        result.error = `plan ${result.planned}, ejecutadas ${result.passed + result.failed}`;
      }
    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e);
      await client
        .query(usePending ? "rollback to savepoint test_file" : "rollback")
        .catch(() => undefined);
    }
    results.push(result);
  }
  if (usePending) await client.query("rollback");
  await client.end();

  let ok = true;
  for (const r of results) {
    const status = r.failed === 0 && !r.error ? "APROBADO" : "FALLIDO";
    if (status === "FALLIDO") ok = false;
    console.log(
      `${status}  ${r.file}  (${r.passed}/${r.planned} ok${r.error ? ` · ${r.error}` : ""})`,
    );
  }
  if (results.length === 0) {
    console.error("No hay pruebas pgTAP en supabase/tests.");
    ok = false;
  }
  process.exit(ok ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
