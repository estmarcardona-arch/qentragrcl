import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { EquipmentForm } from "@/components/equipment/equipment-form";
import { getEquipmentAccess } from "@/lib/equipment/access";
import { EMPTY_EQUIPMENT, loadEquipmentOptions } from "@/lib/equipment/options";

export const metadata: Metadata = { title: "Nuevo equipo · GRUFARCOL eBR" };

// S-25 · Alta de un equipo (RF-50). Nace «Disponible» y no apto hasta cargar su hoja de vida.
export default async function NewEquipmentPage() {
  const a = await getEquipmentAccess();
  if (!a.create) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="Su rol no registra equipos"
          text="Puede consultar el inventario, pero no registrar equipos (PRD 2.2)."
        />
      </main>
    );
  }
  const { types, documents } = await loadEquipmentOptions(a);
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Nuevo equipo"
        description="Registre la ficha; luego cargue la instalación, la calibración con su certificado y la limpieza en la hoja de vida."
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Equipos", href: "/equipos" },
          { label: "Nuevo equipo" },
        ]}
      />
      <EquipmentForm
        id={null}
        initial={EMPTY_EQUIPMENT}
        types={types}
        documents={documents}
        editable
      />
    </main>
  );
}
