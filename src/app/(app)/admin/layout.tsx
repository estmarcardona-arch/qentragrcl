import type { ReactNode } from "react";
import { NoPermissionState } from "@/components/common/state-card";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { checkRoles } from "@/lib/auth/session";

// Administración: visible solo para el administrador del sistema (PRD 2.2, S-03 y S-04).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { allowed } = await checkRoles(["admin"]);
  if (!allowed) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso a Administración"
          text="Esta sección es solo para el administrador del sistema. Si necesita un cambio de usuario o de catálogo, solicítelo a Administración."
        />
      </main>
    );
  }
  return (
    <div className="grid content-start">
      <AdminTabs />
      {children}
    </div>
  );
}
