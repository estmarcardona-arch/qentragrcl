// Ejecuta las pruebas pgTAP de supabase/tests contra SUPABASE_DB_URL sin Docker.
// Cada archivo maneja su propia transacción (begin … rollback), así no deja datos.
// Falla (código 1) si hay un «not ok», si el plan no coincide o si un archivo da error.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("Falta SUPABASE_DB_URL (ver .env.example).");
  process.exit(1);
}

const testsDir = join("supabase", "tests");
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

  const results: Result[] = [];
  for (const file of files) {
    const sql = readFileSync(join(testsDir, file), "utf8");
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
      await client.query("rollback").catch(() => undefined);
    }
    results.push(result);
  }
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
