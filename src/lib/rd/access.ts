import "server-only";

import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { callRpc } from "@/lib/rpc";
import type { DocTab } from "@/components/documents/documents-tabs";

// Acceso a I+D según la matriz 2.2: Brief; Fórmula / Especificación / Instructivo; Prototipos y estabilidad;
// Costos de fórmula (PRD 1.8).
export async function getRdAccess() {
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
    briefRead,
    briefCreate,
    briefApprove,
    protoRead,
    protoCreate,
    masterRead,
    masterCreate,
    costRead,
    costCreate,
  ] = await Promise.all([
    perm("brief", "read"),
    perm("brief", "create"),
    perm("brief", "approve"),
    perm("prototipos_estabilidad_y_costos", "read"),
    perm("prototipos_estabilidad_y_costos", "create"),
    perm("formula_especificacion_instructivo", "read"),
    perm("formula_especificacion_instructivo", "create"),
    // Costos confidenciales: fila «Costos de fórmula» (PRD 1.8, RF-17).
    perm("costos_de_formula", "read"),
    perm("costos_de_formula", "create"),
  ]);
  const roles = ctx.roles;
  return {
    ctx,
    supabase,
    briefRead,
    briefCreate,
    briefApprove,
    protoRead,
    protoCreate,
    masterRead,
    masterCreate,
    costRead,
    costCreate,
    canAny: briefRead || protoRead || masterRead || costRead,
    isIdi: roles.includes("idi"),
    canRecord: roles.some((r) => ["lab_aux", "idi", "cc_jefe"].includes(r)),
    canClose: roles.some((r) => ["cc_jefe", "idi"].includes(r)),
    canCriteria: roles.some((r) => ["cc_jefe", "idi", "aq_dir"].includes(r)),
    approverRoles: roles.filter((r) => ["gerencia", "dt"].includes(r)),
  };
}

export type RdAccess = Awaited<ReturnType<typeof getRdAccess>>;

export function rdTabs(a: RdAccess): DocTab[] {
  const t: DocTab[] = [];
  if (a.briefRead) t.push({ href: "/idi/briefs", label: "Briefs", match: ["/idi/briefs"] });
  if (a.protoRead)
    t.push({
      href: "/idi/prototipos",
      label: "Prototipos y estabilidad",
      match: ["/idi/prototipos"],
    });
  if (a.masterRead) {
    t.push({ href: "/idi/formulas", label: "Fórmulas", match: ["/idi/formulas"] });
    t.push({
      href: "/idi/especificaciones",
      label: "Especificaciones",
      match: ["/idi/especificaciones"],
    });
    t.push({ href: "/idi/instructivos", label: "Instructivos", match: ["/idi/instructivos"] });
  }
  if (a.costRead) t.push({ href: "/idi/costos", label: "Costos", match: ["/idi/costos"] });
  return t;
}
