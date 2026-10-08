import type { ReactNode } from "react";
import { Suspense } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { IdleTimer } from "@/components/shell/idle-timer";
import { LoadingSkeleton } from "@/components/common/state-card";
import { navForRoles } from "@/lib/auth/navigation";
import { initials, ROLE_LABELS } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";

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
  const roleLabel = ctx.roles.map((r) => ROLE_LABELS[r]).join(" · ");
  return (
    <div className="flex min-h-screen">
      <Sidebar items={navForRoles(ctx.roles)} roleLabel={roleLabel} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          fullName={ctx.fullName}
          roleLabel={ctx.jobTitle ?? roleLabel}
          initials={initials(ctx.fullName)}
          shortSignature={ctx.shortSignature}
        />
        <div className="flex-1">{children}</div>
      </div>
      <IdleTimer minutes={ctx.sessionIdleMinutes} />
    </div>
  );
}
