import type { ReactNode } from "react";
import { NoPermissionState } from "@/components/common/state-card";
import { DocumentsTabs } from "@/components/documents/documents-tabs";
import { getRdAccess, rdTabs } from "@/lib/rd/access";

// I+D y documentos maestros (PRD F3; S-05…S-09, S-36, S-37).
export default async function RdLayout({ children }: { children: ReactNode }) {
  const a = await getRdAccess();
  if (!a.canAny) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso a I+D"
          text="Su rol no tiene permiso en los módulos de I+D (PRD 2.2)."
        />
      </main>
    );
  }
  return (
    <div className="grid content-start">
      <DocumentsTabs tabs={rdTabs(a)} label="Secciones de I+D" />
      {children}
    </div>
  );
}
