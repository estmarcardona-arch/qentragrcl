import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { RoleChangeList } from "@/components/admin/role-change-list";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState, NoPermissionState } from "@/components/common/state-card";
import { loadRoleChanges } from "@/lib/admin/role-changes-server";
import type { RoleChangeStatus } from "@/lib/admin/role-changes";
import { checkRoles } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "Cambios de roles · GRUFARCOL eBR" };

const FILTERS: [RoleChangeStatus | "todas", string][] = [
  ["pendiente", "Pendientes"],
  ["aprobada", "Aprobadas"],
  ["rechazada", "Rechazadas"],
  ["anulada", "Anuladas"],
  ["todas", "Todas"],
];

// Bandeja de solicitudes de cambio de rol (PRD 2.6; D-39, D-40). Aprueban Aseguramiento de calidad
// y, para los roles del sistema, también Dirección técnica; el administrador solicita y anula.
export default async function RoleChangesPage({ searchParams }: PageProps<"/cambios-roles">) {
  const { ctx, allowed } = await checkRoles(["admin", "aq_dir", "dt", "auditor"]);
  if (!allowed) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso a los cambios de roles"
          text="Esta bandeja es para Administración, Aseguramiento de calidad, Dirección técnica y el auditor."
        />
      </main>
    );
  }
  const sp = await searchParams;
  const filter = (FILTERS.find(([f]) => f === sp.estado)?.[0] ?? "pendiente") as
    RoleChangeStatus | "todas";
  const supabase = await createClient();

  let data: Awaited<ReturnType<typeof loadRoleChanges>> | null = null;
  try {
    data = await loadRoleChanges(supabase, filter === "todas" ? {} : { status: filter });
  } catch {
    data = null;
  }

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Cambios de roles"
        description="Ningún cambio de rol lo hace una sola persona: Administración solicita y Aseguramiento de calidad aprueba; los permisos de un rol del sistema exigen además la aprobación de Dirección técnica."
        breadcrumbs={[{ label: "Inicio", href: "/inicio" }, { label: "Cambios de roles" }]}
      />
      <nav aria-label="Estado" className="flex flex-wrap gap-2">
        {FILTERS.map(([f, label]) => (
          <Link
            key={f}
            href={`/cambios-roles?estado=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm no-underline",
              f === filter
                ? "border-primary bg-primary text-white"
                : "border-border-control bg-white text-text-strong",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {data ? (
        <RoleChangeList
          requests={data.requests}
          userId={ctx.userId}
          roles={ctx.roles}
          moduleNames={data.moduleNames}
          roleNames={data.roleNames}
          emptyText={
            filter === "pendiente"
              ? "No hay solicitudes pendientes de aprobación."
              : "No hay solicitudes con este estado."
          }
        />
      ) : (
        <ErrorState
          title="No se pudieron cargar las solicitudes"
          text="Intente de nuevo en unos segundos. Si el problema continúa, avise a Administración."
        />
      )}
    </main>
  );
}
