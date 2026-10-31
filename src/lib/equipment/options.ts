import "server-only";

import type { EquipmentInput } from "./actions";
import type { EquipmentAccess } from "./access";

/** Tipos de equipo (catálogo tipos_equipo) y documentos del listado maestro que pueden regir un equipo. */
export async function loadEquipmentOptions(a: EquipmentAccess) {
  const [{ data: types }, { data: docs }] = await Promise.all([
    a.supabase
      .from("catalog_items")
      .select("code, name")
      .eq("catalog", "tipos_equipo")
      .eq("active", true)
      .order("order_no"),
    a.supabase
      .from("controlled_documents")
      .select("id, code, title, status")
      .in("status", ["vigente", "en_elaboracion"])
      .order("code"),
  ]);
  return {
    types: types ?? [],
    documents: (docs ?? []).map((d) => ({ id: d.id, label: `${d.code} · ${d.title}` })),
  };
}

export const EMPTY_EQUIPMENT: EquipmentInput = {
  code: "",
  name: "",
  equipment_type: "",
  plant_area: "fabricacion",
  critical: false,
  governing_document_id: "",
  manufacturer: "",
  model: "",
  serial_number: "",
  capacity: "",
  installed_on: "",
  requires_calibration: true,
  requires_qualification: false,
  requires_cleaning: true,
  active: true,
};
