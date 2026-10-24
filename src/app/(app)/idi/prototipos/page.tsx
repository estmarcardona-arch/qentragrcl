import type { Metadata } from "next";
import { CornerDownRight, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { getRdAccess } from "@/lib/rd/access";
import { PROTOTYPE_STATUS } from "@/lib/rd/labels";

export const metadata: Metadata = { title: "Prototipos · GRUFARCOL eBR" };

// S-36a · Prototipos de fórmula en árbol (RF-15): la mejora cuelga de su prototipo y hereda su número.
export default async function PrototypesPage({ searchParams }: PageProps<"/idi/prototipos">) {
  const a = await getRdAccess();
  if (!a.protoRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso a los prototipos"
          text="Su rol no tiene permiso en «Prototipos, estabilidad y costos» (PRD 2.2)."
        />
      </main>
    );
  }
  const sp = await searchParams;
  const { data: briefs } = await a.supabase
    .from("briefs")
    .select("id, code, project_name, status")
    .eq("status", "aprobado")
    .order("created_at", { ascending: false });
  const brief = (briefs ?? []).find((b) => b.id === sp.brief) ?? (briefs ?? [])[0];
  const { data: protos } = brief
    ? await a.supabase
        .from("formula_prototypes")
        .select(
          "id, code, parent_prototype_id, product_type, target_description, benefit, concept, status, status_reason",
        )
        .eq("brief_id", brief.id)
        .order("code")
    : { data: [] };
  const roots = (protos ?? []).filter((p) => !p.parent_prototype_id);
  const ordered = roots.flatMap((r) => [
    { ...r, child: false },
    ...(protos ?? [])
      .filter((c) => c.parent_prototype_id === r.id)
      .map((c) => ({ ...c, child: true })),
  ]);
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Prototipos de fórmula"
        description={
          brief
            ? `Brief de origen ${brief.code} · ${brief.project_name}`
            : "Los prototipos parten de un brief aprobado."
        }
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "I+D" },
          { label: "Prototipos" },
        ]}
        actions={
          a.isIdi && brief ? (
            <Button asChild>
              <Link href={`/idi/prototipos/nuevo?brief=${brief.id}`}>
                <Plus aria-hidden />
                Nuevo prototipo
              </Link>
            </Button>
          ) : null
        }
      />
      {(briefs ?? []).length > 1 ? (
        <nav aria-label="Brief" className="flex flex-wrap gap-2">
          {(briefs ?? []).map((b) => (
            <Link
              key={b.id}
              href={`/idi/prototipos?brief=${b.id}`}
              aria-current={b.id === brief?.id ? "page" : undefined}
              className={`rounded-full border px-3 py-1 font-mono text-xs no-underline ${b.id === brief?.id ? "border-primary bg-primary text-white" : "border-border-control bg-white text-text-strong"}`}
            >
              {b.code}
            </Link>
          ))}
        </nav>
      ) : null}
      {roots.length < 2 && brief ? (
        <p
          role="note"
          className="rounded-lg border border-tram-revision-bd bg-tram-revision-bg px-3.5 py-2.5 text-sm text-tram-revision-fg"
        >
          Se requieren al menos 2 prototipos para elegir (hay {roots.length}).
        </p>
      ) : null}
      {!brief ? (
        <EmptyState
          title="No hay briefs aprobados"
          text="Cuando Dirección técnica apruebe un brief, I+D podrá crear sus prototipos."
        />
      ) : ordered.length === 0 ? (
        <EmptyState title="Este brief aún no tiene prototipos" />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm" data-testid="prototypes">
            <caption className="sr-only">Prototipos del brief</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {["Código", "Tipo de producto", "Público y beneficio", "Concepto", "Estado"].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="border-b border-border px-3 py-2.5 text-label uppercase"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {ordered.map((p) => {
                const st = PROTOTYPE_STATUS[p.status];
                return (
                  <tr
                    key={p.id}
                    data-code={p.code}
                    className={`border-b border-divider last:border-0 ${p.child ? "bg-tram-revision-bg/40" : ""}`}
                  >
                    <td className="px-3 py-2.5 font-mono text-[13px] font-semibold">
                      <span className={p.child ? "inline-flex items-center gap-1 pl-5" : ""}>
                        {p.child ? (
                          <CornerDownRight aria-hidden className="size-3.5 text-text-muted" />
                        ) : null}
                        <Link href={`/idi/prototipos/${p.id}`}>{p.code}</Link>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{p.product_type || "—"}</td>
                    <td className="px-3 py-2.5">
                      {p.target_description}
                      {p.benefit ? `. ${p.benefit}` : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      {p.concept}
                      {p.status_reason ? (
                        <span className="block text-xs text-text-secondary">{p.status_reason}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={st.status} label={st.label} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
