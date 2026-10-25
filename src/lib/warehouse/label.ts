import "server-only";

import type { DbClient } from "@/lib/rpc";

// Datos del rótulo de un lote (S-14, RF-20 v1.9): página e impresión PDF.
export async function loadLabel(supabase: DbClient, id: string) {
  const [{ data: lot }, { data: extra }, { data: stock }] = await Promise.all([
    supabase.from("v_lot_stock").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("material_lots")
      .select(
        "purchase_order, package_type, package_count, qty_per_package, materials(storage_conditions, shelf_life_kind)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("stock_by_location")
      .select("qty, storage_locations(code)")
      .eq("lot_id", id)
      .gt("qty", 0),
  ]);
  if (!lot) return null;
  const mat = extra?.materials as {
    storage_conditions: string | null;
    shelf_life_kind: string;
  } | null;
  const state = lot.effective_status === "agotado" ? "aprobado" : String(lot.effective_status);
  return {
    lot,
    state,
    locations: (stock ?? [])
      .map((s) => (s.storage_locations as { code: string } | null)?.code)
      .filter((c): c is string => Boolean(c)),
    storage: mat?.storage_conditions ?? null,
    expiryLabel: mat?.shelf_life_kind === "reanalisis" ? "Reanálisis" : "Vence",
    purchaseOrder: extra?.purchase_order ?? null,
    packages:
      extra?.package_count != null && extra.qty_per_package != null
        ? `${Number(extra.package_count)} ${extra.package_type ?? "empaques"} × ${Number(extra.qty_per_package)} ${lot.unit}`
        : null,
  };
}

export type LabelData = NonNullable<Awaited<ReturnType<typeof loadLabel>>>;

export const KIND: Record<string, string> = {
  mp: "MATERIA PRIMA",
  envase: "MATERIAL DE ENVASE",
  empaque: "MATERIAL DE EMPAQUE",
};

export const BAND_TEXT: Record<string, { text: string; note: string }> = {
  cuarentena: { text: "CUARENTENA", note: "No dispensar hasta liberación de Calidad" },
  aprobado: { text: "APROBADO", note: "Liberado por Control de calidad" },
  rechazado: { text: "RECHAZADO", note: "No usar · bodega de rechazo" },
  vencido: { text: "VENCIDO", note: "No usar · vencido" },
};
