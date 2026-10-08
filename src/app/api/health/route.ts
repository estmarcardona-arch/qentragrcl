import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import type { Database } from "@/lib/db/database.types";
import { getPublicSupabaseEnv } from "@/lib/db/env";
import { log } from "@/lib/log";
import { callRpc } from "@/lib/rpc";

// GET /api/health · valida la conexión a la base con la RPC health_check (sin datos de negocio).
// 200 si la base responde; 503 si no. Sin sesión de usuario: usa la clave pública.
export async function GET() {
  await connection(); // siempre en tiempo de solicitud, nunca prerenderizada
  const started = performance.now();
  try {
    const { url, key } = getPublicSupabaseEnv();
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = (await callRpc(client, "health_check")) as { db_time?: string } | null;
    const latencyMs = Math.round(performance.now() - started);
    log.info("health.ok", { latencyMs });
    return Response.json(
      { status: "ok", database: "ok", dbTime: result?.db_time ?? null, latencyMs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const latencyMs = Math.round(performance.now() - started);
    log.error("health.fail", { latencyMs, error });
    return Response.json(
      { status: "error", database: "unreachable", latencyMs },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
