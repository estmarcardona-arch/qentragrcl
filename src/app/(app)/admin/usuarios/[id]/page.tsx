import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import type { AdminUser, AreaOption } from "@/components/admin/types";
import { UserDetail } from "@/components/admin/user-detail";
import { AuditTrailPanel } from "@/components/gxp/audit-trail-panel";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import type { AuditEntry } from "@/lib/gxp/actions";

export const metadata: Metadata = { title: "Usuario · GRUFARCOL eBR" };

export default async function UserPage({ params }: PageProps<"/admin/usuarios/[id]">) {
  const { id } = await params;
  const ctx = await requireSession();
  const supabase = await createClient();
  const [{ data: users }, { data: areas }, { data: audit }] = await Promise.all([
    supabase.rpc("admin_list_users"),
    supabase
      .from("organizational_areas")
      .select("id, name, process_code")
      .eq("active", true)
      .order("name"),
    supabase
      .from("audit_log")
      .select("id, at, actor_id, action, table_name, before, after, reason")
      .or(
        `and(table_name.eq.profiles,record_id.eq.${id}),and(table_name.eq.user_roles,after->>user_id.eq.${id}),and(table_name.eq.signature_registry,after->>user_id.eq.${id})`,
      )
      .order("at", { ascending: false })
      .limit(50),
  ]);
  const user = ((users ?? []) as unknown as AdminUser[]).find((u) => u.id === id);
  if (!user) notFound();

  const actorIds = [...new Set((audit ?? []).map((a) => a.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const entries: AuditEntry[] = (audit ?? []).map((a) => ({
    id: a.id,
    at: a.at,
    actorName: actors?.find((p) => p.id === a.actor_id)?.full_name ?? null,
    actorShortSignature: null,
    action: a.action,
    tableName: a.table_name,
    before: a.before as Record<string, unknown> | null,
    after: a.after as Record<string, unknown> | null,
    reason: a.reason,
  }));

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={user.full_name}
        description={user.job_title ?? undefined}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Usuarios y roles", href: "/admin/usuarios" },
          { label: user.full_name },
        ]}
      />
      <UserDetail
        user={user}
        areas={(areas ?? []) as AreaOption[]}
        isSelf={user.id === ctx.userId}
      />
      <div className="max-w-3xl">
        <AuditTrailPanel code={`Usuario · ${user.email}`} entries={entries} />
      </div>
    </main>
  );
}
