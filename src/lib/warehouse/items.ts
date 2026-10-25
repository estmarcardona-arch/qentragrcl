import "server-only";

import type { MaterialInput } from "./actions";
import type { WarehouseAccess } from "./access";

const INVENTORY_UNITS = ["kg", "g", "mg", "L", "mL", "und"];

export async function loadUnits(a: WarehouseAccess) {
  const { data } = await a.supabase
    .from("catalog_items")
    .select("code, name")
    .eq("catalog", "unidades")
    .eq("active", true)
    .order("order_no");
  // Unidades de almacenamiento e inventario (masa, volumen y unidades).
  return (data ?? []).filter((u) => INVENTORY_UNITS.includes(u.code));
}

export const EMPTY_MATERIAL = (type: MaterialInput["type"]): MaterialInput => ({
  code: type === "mp" ? "MP-" : type === "envase" ? "EN-" : "EM-",
  name: "",
  type,
  unit: type === "mp" ? "kg" : "und",
  inci_name: "",
  default_function: "",
  requires_coa: type === "mp",
  storage_conditions: "",
  shelf_life_months: null,
  shelf_life_kind: "vencimiento",
  default_package_type: "",
  default_package_qty: null,
  active: true,
});
