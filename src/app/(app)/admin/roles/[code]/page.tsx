import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { RoleChangeList } from "@/components/admin/role-change-list";
import { RoleEditor, type ModuleRow } from "@/components/admin/role-editor";
import { loadRoleChanges } from "@/lib/admin/role-changes-server";
import type { RoleInfo } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "Rol · GRUFARCOL eBR" };

// Configuración de un rol (PRD 2.6, RF-07). Guarda de administrador en el layout de /admin.
export default async function RolePage({ params }: PageProps<"/admin/roles/[code]">) {
  const { code } = await params;
  const ctx = await requireSession();
  const supabase = await createClient();
  const [
    { data: role },
    { data: modules },
    { data: perms },
    { data: reserved },
    { data: roles },
    { data: incompat },
    { data: users },
  ] = await Promise.all([
    supabase.from("roles").select("*").eq("code", code).maybeSingle(),
    supabase.from("permission_modules").select("code, name, order_no").order("order_no"),
    supabase
      .from("module_permissions")
      .select("module_code, can_read, can_create, can_sign, can_approve")
      .eq("role", code),
    supabase.from("reserved_permissions").select("module_code, permission, owner_role, reason"),
    supabase.from("roles").select("*").neq("code", code).eq("active", true).order("name"),
    supabase
      .from("role_incompatibilities")
      .select("role_a, role_b, active")
      .or(`role_a.eq.${code},role_b.eq.${code}`),
    supabase.rpc("admin_list_users"),
  ]);
  if (!role) notFound();
  const changes = await loadRoleChanges(supabase, { status: "pendiente", role: code });
  const pending = changes.requests[0] ?? null;

  const rows: ModuleRow[] = (modules ?? []).map((m) => {
    const p = perms?.find((x) => x.module_code === m.code);
    return {
      module: m.code,
      name: m.name,
      read: Boolean(p?.can_read),
      create: Boolean(p?.can_create),
      sign: Boolean(p?.can_sign),
      approve: Boolean(p?.can_approve),
    };
  });
  const holders = (
    (users ?? []) as unknown as { active: boolean; roles: { role: string; active: boolean }[] }[]
  ).filter((u) => u.active && u.roles.some((r) => r.role === code && r.active)).length;
  const reservedRows = (reserved ?? []).map((r) => ({
    ...r,
    module_name: modules?.find((m) => m.code === r.module_code)?.name ?? r.module_code,
  }));

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={role.name}
        description={role.description || undefined}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Catálogos y configuración", href: "/admin/catalogos?tab=roles" },
          { label: role.name },
        ]}
        meta={
          <span className="font-mono text-xs text-text-secondary">
            {role.code} · v{role.version}
          </span>
        }
      />
      <RoleEditor
        role={role as RoleInfo}
        modules={rows}
        reserved={reservedRows}
        otherRoles={(roles ?? []) as RoleInfo[]}
        incompatible={(incompat ?? [])
          .filter((i) => i.active)
          .map((i) => (i.role_a === code ? i.role_b : i.role_a))}
        holders={holders}
        pendingNumber={pending?.request_number ?? null}
        pendingPanel={
          pending ? (
            <RoleChangeList
              requests={[pending]}
              userId={ctx.userId}
              roles={ctx.roles}
              moduleNames={changes.moduleNames}
              roleNames={changes.roleNames}
            />
          ) : null
        }
      />
    </main>
  );
}
