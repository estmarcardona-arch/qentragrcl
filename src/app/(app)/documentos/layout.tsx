import type { ReactNode } from "react";
import { NoPermissionState } from "@/components/common/state-card";
import { DocumentsTabs } from "@/components/documents/documents-tabs";
import { docTabs, getDocAccess } from "@/lib/documents/access";

// Sistema de gestión documental (PRD 2.5; S-44…S-49). El administrador del sistema no tiene acceso (matriz 2.2).
export default async function DocumentsLayout({ children }: { children: ReactNode }) {
  const access = await getDocAccess();
  if (!access.canRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso a los documentos controlados"
          text="Su rol no tiene permiso en el sistema de gestión documental (PRD 2.2). Si lo necesita, solicítelo a Aseguramiento de la calidad."
        />
      </main>
    );
  }
  return (
    <div className="grid content-start">
      <DocumentsTabs tabs={docTabs(access)} />
      {children}
    </div>
  );
}
