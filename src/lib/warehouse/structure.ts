import "server-only";

import type { WarehouseAccess } from "./access";

// Carga de bodegas con estructura, ocupación y tercero (S-41).
export async function loadWarehouses(a: WarehouseAccess) {
  const [{ data: whs }, { data: racks }, { data: locs }, { data: allowed }, { data: parties }] =
    await Promise.all([
      a.supabase.from("warehouses").select("*").order("code"),
      a.supabase
        .from("racks")
        .select("id, warehouse_id, code, zone, levels_count, positions_per_level")
        .order("code"),
      a.supabase.from("v_location_status").select("warehouse_id, status"),
      a.supabase.from("warehouse_allowed_types").select("warehouse_id, material_class"),
      a.supabase.from("external_parties").select("*"),
    ]);
  return (whs ?? []).map((w) => {
    const rs = (racks ?? []).filter((r) => r.warehouse_id === w.id);
    const ls = (locs ?? []).filter((l) => l.warehouse_id === w.id);
    const shapes = [...new Set(rs.map((r) => `${r.levels_count} × ${r.positions_per_level}`))];
    const party = (parties ?? []).find((p) => p.id === w.external_party_id) ?? null;
    return {
      ...w,
      racks: rs,
      total: ls.length,
      occupied: ls.filter((l) => l.status === "ocupada").length,
      blocked: ls.filter((l) => l.status === "bloqueada").length,
      structure:
        rs.length === 0
          ? "Sin estructura"
          : shapes.length === 1
            ? `${rs.length} × ${shapes[0]} = ${ls.length} ubicaciones`
            : `${rs.length} estantes = ${ls.length} ubicaciones`,
      quarantineRacks: rs.filter((r) => r.zone === "cuarentena").map((r) => r.code),
      allowed: (allowed ?? []).filter((t) => t.warehouse_id === w.id).map((t) => t.material_class),
      party,
    };
  });
}

export type WarehouseView = Awaited<ReturnType<typeof loadWarehouses>>[number];

/** Calificación del tercero a la fecha (texto y si está vigente). */
export function qualification(
  party: { qualified: boolean; qualification_expires: string | null } | null,
  today: string,
): { ok: boolean; label: string } {
  if (!party) return { ok: false, label: "" };
  if (!party.qualified || !party.qualification_expires)
    return { ok: false, label: "Sin calificación" };
  const [y, m, d] = party.qualification_expires.split("-");
  return party.qualification_expires >= today
    ? { ok: true, label: `Calificado hasta ${d}/${m}/${y}` }
    : { ok: false, label: `Calificación vencida el ${d}/${m}/${y}` };
}

/** Fecha de hoy en Bogotá (AAAA-MM-DD) para comparar vencimientos en pantalla. */
export function todayBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}
