import "server-only";

import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { callRpc } from "@/lib/rpc";
import type { DocTab } from "@/components/documents/documents-tabs";

// Acceso a Bodega y a la liberación de insumos según la matriz 2.2: Recepción / Inventario; Liberación de
// insumos; Bodegas, estantes y ubicaciones; Traslados y envíos a bodegas externas.
export async function getWarehouseAccess() {
  const ctx = await requireSession();
  const supabase = await createClient();
  const perm = async (module: string, permission: string) =>
    Boolean(
      await callRpc(supabase, "has_module_permission", {
        p_module: module,
        p_permission: permission,
      }).catch(() => false),
    );
  const [
    invRead,
    receive,
    adjust,
    releaseRead,
    recordResults,
    release,
    structRead,
    structEdit,
    structApprove,
    trRead,
    trCreate,
    trApprove,
  ] = await Promise.all([
    perm("recepcion_inventario", "read"),
    perm("recepcion_inventario", "create"),
    perm("recepcion_inventario", "approve"),
    perm("liberacion_de_insumos", "read"),
    perm("liberacion_de_insumos", "create"),
    perm("liberacion_de_insumos", "approve"),
    perm("bodegas_estantes_y_ubicaciones", "read"),
    perm("bodegas_estantes_y_ubicaciones", "create"),
    perm("bodegas_estantes_y_ubicaciones", "approve"),
    perm("traslados_y_envios_a_bodegas_externas", "read"),
    perm("traslados_y_envios_a_bodegas_externas", "create"),
    perm("traslados_y_envios_a_bodegas_externas", "approve"),
  ]);
  return {
    ctx,
    supabase,
    invRead,
    receive,
    adjust,
    releaseRead,
    recordResults,
    release,
    structRead,
    structEdit,
    structApprove,
    trRead,
    trCreate,
    trApprove,
    relocate: receive || trCreate,
    signer: `${ctx.fullName}${ctx.shortSignature ? ` (${ctx.shortSignature})` : ""}`,
  };
}

export type WarehouseAccess = Awaited<ReturnType<typeof getWarehouseAccess>>;

export function warehouseTabs(a: WarehouseAccess): DocTab[] {
  const t: DocTab[] = [];
  if (a.invRead)
    t.push({ href: "/bodega/inventario", label: "Inventario", match: ["/bodega/inventario"] });
  if (a.receive)
    t.push({
      href: "/bodega/recepcion",
      label: "Recepción",
      match: ["/bodega/recepcion", "/bodega/rotulos"],
    });
  if (a.trRead)
    t.push({ href: "/bodega/traslados", label: "Traslados", match: ["/bodega/traslados"] });
  if (a.structRead || a.structEdit || a.structApprove)
    t.push({
      href: "/bodega/estructura",
      label: "Bodegas y ubicaciones",
      match: ["/bodega/estructura"],
    });
  return t;
}
