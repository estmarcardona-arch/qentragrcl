import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { ProductForm } from "@/components/warehouse/item-forms";
import { getWarehouseAccess } from "@/lib/warehouse/access";

export const metadata: Metadata = { title: "Nuevo producto terminado · GRUFARCOL eBR" };

// S-50 · Nuevo producto terminado (RF-26).
export default async function NewProductPage() {
  const a = await getWarehouseAccess();
  if (!a.itemEdit) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="El maestro lo mantienen I+D, el jefe de bodega y Aseguramiento de la calidad" />
      </main>
    );
  }
  const { data: lines } = await a.supabase
    .from("product_lines")
    .select("id, code, name")
    .eq("active", true)
    .order("code");
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Nuevo producto terminado"
        description="Después agregue sus presentaciones (p. ej. 200 mL y 400 mL)"
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Materiales y productos", href: "/bodega/maestros?tipo=pt" },
          { label: "Nuevo producto" },
        ]}
      />
      <ProductForm
        id={null}
        lines={(lines ?? []).map((l) => ({ id: l.id, label: `${l.code} · ${l.name}` }))}
        editable
        initial={{
          code: "PRD-",
          name: "",
          line_id: "",
          titular: "GRUFARCOL S.A.S.",
          sanitary_registration: "",
          sanitary_registration_expires: "",
          shelf_life_months: null,
          storage_conditions: "",
          active: true,
        }}
      />
    </main>
  );
}
