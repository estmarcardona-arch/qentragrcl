import "server-only";

import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { callRpc } from "@/lib/rpc";

// Acceso a Producción según la matriz 2.2: Orden de producción (C: coordinación), Solicitudes y documentos de la OP
// (A: Dirección técnica, D-12) y Dispensación / Fabricación / Envase / Acond. (C F: auxiliar; F: coordinación verifica).
export async function getProductionAccess() {
  const ctx = await requireSession();
  const supabase = await createClient();
  const perm = async (module: string, permission: string) =>
    Boolean(
      await callRpc(supabase, "has_module_permission", {
        p_module: module,
        p_permission: permission,
      }).catch(() => false),
    );
  const [read, createOrder, approveOrder, execute, sign] = await Promise.all([
    callRpc(supabase, "can_read_production").catch(() => false),
    perm("orden_de_produccion", "create"),
    perm("solicitudes_y_documentos_de_la_op", "approve"),
    perm("dispensacion_fabricacion_envase_acond", "create"),
    perm("dispensacion_fabricacion_envase_acond", "sign"),
  ]);
  return {
    ctx,
    supabase,
    read: Boolean(read),
    createOrder,
    approveOrder,
    execute,
    /** Firma verificaciones de dispensación y pasos (cualquier firmante distinto de quien ejecutó). */
    sign,
    /** Coordinación o supervisión: verifica despeje y limpieza y firma la inspección (D-46, D-47). */
    verify: sign && !execute,
    signer: `${ctx.fullName}${ctx.shortSignature ? ` (${ctx.shortSignature})` : ""}`,
  };
}

export type ProductionAccess = Awaited<ReturnType<typeof getProductionAccess>>;
