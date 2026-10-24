import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { WarehouseForm } from "@/components/warehouse/warehouse-form";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import { qualification, todayBogota } from "@/lib/warehouse/structure";

export const metadata: Metadata = { title: "Nueva bodega · GRUFARCOL eBR" };

// S-41b · Nueva bodega (RF-23).
export default async function NewWarehousePage() {
  const a = await getWarehouseAccess();
  if (!a.structEdit) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="Las bodegas las crean el jefe de bodega y el administrador"
          text="Su rol no tiene «C» en «Bodegas, estantes y ubicaciones» (PRD 2.2)."
        />
      </main>
    );
  }
  const { data: parties } = await a.supabase
    .from("external_parties")
    .select("id, name, qualified, qualification_expires")
    .in("kind", ["maquilador", "almacenamiento"])
    .eq("active", true)
    .order("name");
  const today = todayBogota();
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Nueva bodega"
        description="Código, función, material permitido y estructura"
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Bodegas y ubicaciones", href: "/bodega/estructura" },
          { label: "Nueva bodega" },
        ]}
      />
      <WarehouseForm
        parties={(parties ?? []).map((p) => {
          const q = qualification(p, today);
          return { id: p.id, name: p.name, qualified: q.ok, label: q.label };
        })}
      />
    </main>
  );
}
