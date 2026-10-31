import "server-only";

import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { callRpc } from "@/lib/rpc";

// Acceso a Equipos y hoja de vida según la matriz 2.2 (PRD 1.10): L lee, C registra equipos, F firma eventos y
// A (Aseguramiento de la calidad) aprueba la calificación y saca equipos de servicio.
export async function getEquipmentAccess() {
  const ctx = await requireSession();
  const supabase = await createClient();
  const perm = async (permission: string) =>
    Boolean(
      await callRpc(supabase, "has_module_permission", {
        p_module: "equipos_y_hoja_de_vida",
        p_permission: permission,
      }).catch(() => false),
    );
  const [read, create, sign, approve] = await Promise.all([
    perm("read"),
    perm("create"),
    perm("sign"),
    perm("approve"),
  ]);
  return {
    ctx,
    supabase,
    read,
    create,
    sign,
    approve,
    signer: `${ctx.fullName}${ctx.shortSignature ? ` (${ctx.shortSignature})` : ""}`,
  };
}

export type EquipmentAccess = Awaited<ReturnType<typeof getEquipmentAccess>>;

/** Días de alerta configurados (S-04) y hoy en Bogotá según la hora del servidor. */
export async function loadAlertSettings(a: EquipmentAccess) {
  const [{ data: settings }, now] = await Promise.all([
    a.supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["equipment_alert_days", "cleaning_due_soon_hours"]),
    callRpc(a.supabase, "reference_now").catch(() => new Date().toISOString()),
  ]);
  const value = (k: string) => settings?.find((s) => s.key === k)?.value;
  const days = Array.isArray(value("equipment_alert_days"))
    ? (value("equipment_alert_days") as number[])
    : [30, 15, 7];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(
    new Date(String(now)),
  );
  return {
    alertDays: days,
    maxAlert: Math.max(...days),
    cleaningHours: Number(value("cleaning_due_soon_hours") ?? 48),
    today,
    now: String(now),
  };
}
