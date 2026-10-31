import type { ReactNode } from "react";
import { Suspense } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { IdleTimer } from "@/components/shell/idle-timer";
import { LoadingSkeleton } from "@/components/common/state-card";
import { navForRoles } from "@/lib/auth/navigation";
import { initials, roleLabel } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";

// Marco de las pantallas con sesión. Lee la sesión dentro de <Suspense> (Cache Components).
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <LoadingSkeleton label="Cargando su sesión…" />
        </div>
      }
    >
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: ReactNode }) {
  const ctx = await requireSession();
  const supabase = await createClient();
  const [{ data: catalog }, { data: notifications }] = await Promise.all([
    supabase.from("roles").select("code, name").in("code", ctx.roles),
    // Avisos sin leer de la campana (RF-51); RLS deja ver solo los propios.
    supabase
      .from("notifications")
      .select("id, title, body, link, created_at")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const roleNames = ctx.roles.map((r) => roleLabel(r, catalog ?? [])).join(" · ");
  return (
    <div className="flex min-h-screen">
      <Sidebar items={navForRoles(ctx.roles, ctx.customModules)} roleLabel={roleNames} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          fullName={ctx.fullName}
          roleLabel={ctx.jobTitle ?? roleNames}
          initials={initials(ctx.fullName)}
          shortSignature={ctx.shortSignature}
          notifications={notifications ?? []}
        />
        <div className="flex-1">{children}</div>
      </div>
      <IdleTimer minutes={ctx.sessionIdleMinutes} />
    </div>
  );
}
