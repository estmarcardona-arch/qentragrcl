import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { ITEM_TYPES, MaterialForm } from "@/components/warehouse/item-forms";
import type { MaterialInput } from "@/lib/warehouse/actions";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import { EMPTY_MATERIAL, loadUnits } from "@/lib/warehouse/items";

export const metadata: Metadata = { title: "Nuevo ítem · GRUFARCOL eBR" };

// S-50 · Nuevo ítem del maestro (RF-26).
export default async function NewItemPage({ searchParams }: PageProps<"/bodega/maestros/nuevo">) {
  const a = await getWarehouseAccess();
  if (!a.itemEdit) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="El maestro lo mantienen I+D, el jefe de bodega y Aseguramiento de la calidad"
          text="Su rol puede consultar el maestro, pero no crear ítems (PRD 2.2, RF-26)."
        />
      </main>
    );
  }
  const sp = await searchParams;
  const type = (ITEM_TYPES.find(([t]) => t === sp.tipo)?.[0] ?? "mp") as MaterialInput["type"];
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Nuevo ítem del maestro"
        description="Código, unidad de almacenamiento, condiciones de almacenamiento y vida útil"
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Materiales y productos", href: `/bodega/maestros?tipo=${type}` },
          { label: "Nuevo ítem" },
        ]}
      />
      <MaterialForm
        id={null}
        initial={EMPTY_MATERIAL(type)}
        units={await loadUnits(a)}
        editable
        locked={false}
      />
    </main>
  );
}
