import type { ReactNode } from "react";
import { NoPermissionState } from "@/components/common/state-card";
import { DocumentsTabs } from "@/components/documents/documents-tabs";
import { docTabs, getDocAccess } from "@/lib/documents/access";

// Plantillas de proceso (S-43, PRD 2.4): las edita el usuario master en versiones en borrador; las leen
// los roles con permiso en «Plantillas de proceso» (matriz 2.2).
export default async function MasterLayout({ children }: { children: ReactNode }) {
  const access = await getDocAccess();
  if (!access.canSeeTemplates) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso a las plantillas de proceso"
          text="Su rol no tiene permiso en «Plantillas de proceso» (PRD 2.2)."
        />
      </main>
    );
  }
  return (
    <div className="grid content-start">
      {access.canRead ? <DocumentsTabs tabs={docTabs(access)} /> : null}
      {children}
    </div>
  );
}
