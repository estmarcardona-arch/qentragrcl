import type { ReactNode } from "react";
import { NoPermissionState } from "@/components/common/state-card";
import { DocumentsTabs } from "@/components/documents/documents-tabs";
import { getWarehouseAccess, warehouseTabs } from "@/lib/warehouse/access";

// Bodega (PRD F4; S-11, S-12, S-14, S-41, S-42).
export default async function WarehouseLayout({ children }: { children: ReactNode }) {
  const a = await getWarehouseAccess();
  const tabs = warehouseTabs(a);
  if (!tabs.length) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso a Bodega"
          text="Su rol no tiene permiso en los módulos de bodega (PRD 2.2)."
        />
      </main>
    );
  }
  return (
    <div className="grid content-start">
      <DocumentsTabs tabs={tabs} label="Secciones de Bodega" />
      {children}
    </div>
  );
}
