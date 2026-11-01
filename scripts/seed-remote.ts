// Carga supabase/seed.sql (usuarios ficticios del Prompt 0B) en el proyecto de SUPABASE_DB_URL; con
// --catalogos carga solo supabase/seed_catalogos.sql (materiales, productos y protocolo de estabilidad) y, desde E6, los
// equipos de ejemplo del 0B (bloque E6 de seed.sql). Son ficticios: en la entrega se reemplazan por los equipos reales de
// la empresa (D-63).
// --produccion carga la demostración de Producción (supabase/seed_demo_produccion.sql y el bloque E7 de seed.sql):
// documentos vigentes de ClariPlus, lotes de insumo, BAL-015 y OP-2026-0042 / OP-2026-0043. Ficticio (D-63, D-70).
// --ensayo ejecuta todo en una transacción que se revierte (para validar antes de cargar).
// Solo para el proyecto de desarrollo/pruebas y con autorización del responsable (AGENTS.md 9 y 14).
// Es idempotente: no duplica lo que ya existe. Exige --confirmar para ejecutarse.
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

const catalogs = process.argv.includes("--catalogos");
const production = process.argv.includes("--produccion");
const dryRun = process.argv.includes("--ensayo");
// El bloque de producción va después del de equipos en seed.sql.
const PRODUCTION_BLOCK =
  "-- =====================================================================================\n-- E7 · Producción";
// El bloque de equipos es el último de seed.sql (idempotente: no se carga si TQ-101 ya existe).
const EQUIPMENT_BLOCK =
  "-- =====================================================================================\n-- E6 · Equipos";

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("begin");
  if (production) {
    const seed = readFileSync("supabase/seed.sql", "utf8");
    const e7 = seed.indexOf(PRODUCTION_BLOCK);
    if (e7 < 0) throw new Error("No se encontró el bloque de producción en seed.sql");
    await client.query(readFileSync("supabase/seed_demo_produccion.sql", "utf8"));
    await client.query(seed.slice(e7));
    const { rows } = await client.query<{
      code: string;
      status: string;
      batch_code: string;
      stage: string | null;
    }>(
      `select o.code, o.status, b.batch_code,
              (select so.stage || ' ' || so.status from public.stage_orders so where so.batch_id = b.id and so.status <> 'completada'
               order by so.order_no limit 1) as stage
       from public.production_orders o join public.batches b on b.order_id = o.id order by o.code`,
    );
    await client.query(dryRun ? "rollback" : "commit");
    await client.end();
    console.log(`${dryRun ? "Ensayo (revertido)" : "Demostración de producción aplicada"}:`);
    for (const r of rows)
      console.log(`  ${r.code} · ${r.batch_code} · ${r.status}${r.stage ? ` · ${r.stage}` : ""}`);
    return;
  }
  if (catalogs) {
    await client.query(readFileSync("supabase/seed_catalogos.sql", "utf8"));
    const seed = readFileSync("supabase/seed.sql", "utf8");
    const e6 = seed.indexOf(EQUIPMENT_BLOCK);
    if (e6 < 0) throw new Error("No se encontró el bloque de equipos en seed.sql");
    const e7 = seed.indexOf(PRODUCTION_BLOCK);
    await client.query(seed.slice(e6, e7 > e6 ? e7 : undefined));
    const { rows } = await client.query<{ m: string; p: string; d: string; e: string }>(
      `select (select count(*) from public.materials) as m, (select count(*) from public.products) as p,
              (select status from public.controlled_documents where code = 'CC-PC-001') as d,
              (select count(*) from public.equipment) as e`,
    );
    await client.query("commit");
    await client.end();
    console.log(
      `Catálogos aplicados: ${rows[0].m} materiales, ${rows[0].p} productos, CC-PC-001 ${rows[0].d}, ${rows[0].e} equipos.`,
    );
    return;
  }
  await client.query(readFileSync("supabase/seed.sql", "utf8"));
  const { rows } = await client.query<{ n: string }>(
    "select count(*) as n from public.profiles where email like '%@grufarcol.test'",
  );
  await client.query("commit");
  await client.end();
  console.log(`Semilla aplicada: ${rows[0].n} usuarios ficticios en el proyecto.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
