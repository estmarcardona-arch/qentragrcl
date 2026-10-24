import { redirect } from "next/navigation";
import { getWarehouseAccess, warehouseTabs } from "@/lib/warehouse/access";

// Entrada del menú «Bodega»: lleva a la primera sección que el rol puede ver.
export default async function WarehouseHome() {
  const tabs = warehouseTabs(await getWarehouseAccess());
  redirect(tabs[0]?.href ?? "/inicio");
}
