import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { getRdAccess } from "@/lib/rd/access";
import { BRIEF_STATUS, PROJECT_TYPE_LABELS } from "@/lib/rd/labels";

export const metadata: Metadata = { title: "Briefs · GRUFARCOL eBR" };

// S-05 · Listado de briefs (RF-10). Solo Comercial crea («Nuevo brief»).
export default async function BriefsPage() {
  const a = await getRdAccess();
  if (!a.briefRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso a los briefs"
          text="Su rol no tiene permiso en el módulo Brief (PRD 2.2)."
        />
      </main>
    );
  }
  const [{ data: briefs }, { data: people }, { data: products }] = await Promise.all([
    a.supabase
      .from("briefs")
      .select(
        "id, code, project_name, project_type, product_category, status, created_by, created_at, product_id",
      )
      .order("created_at", { ascending: false }),
    a.supabase.from("profiles").select("id, full_name"),
    a.supabase.from("products").select("id, code, name"),
  ]);
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Briefs"
        description="Solicitudes de producto de Comercial: borrador → enviado → aprobado por Dirección técnica."
        breadcrumbs={[{ label: "Inicio", href: "/inicio" }, { label: "I+D" }, { label: "Briefs" }]}
        actions={
          a.briefCreate ? (
            <Button asChild>
              <Link href="/idi/briefs/nuevo">
                <Plus aria-hidden />
                Nuevo brief
              </Link>
            </Button>
          ) : null
        }
      />
      {(briefs ?? []).length === 0 ? (
        <EmptyState
          title="No hay briefs"
          text={
            a.briefCreate
              ? "Cree el primero con «Nuevo brief»."
              : "Comercial aún no ha creado briefs."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm" data-testid="briefs">
            <caption className="sr-only">Briefs</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {[
                  "Código",
                  "Proyecto y producto",
                  "Tipo de proyecto",
                  "Solicitante",
                  "Fecha",
                  "Estado",
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="border-b border-border px-3 py-2.5 text-label uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(briefs ?? []).map((b) => {
                const p = products?.find((x) => x.id === b.product_id);
                const st = BRIEF_STATUS[b.status];
                return (
                  <tr
                    key={b.id}
                    className="border-b border-divider last:border-0"
                    data-code={b.code}
                  >
                    <td className="px-3 py-2.5 font-mono text-[13px] font-semibold">
                      <Link href={`/idi/briefs/${b.id}`}>{b.code}</Link>
                    </td>
                    <td className="px-3 py-2.5">
                      {b.project_name || "Sin nombre"}
                      {p ? (
                        <span className="block font-mono text-xs text-text-secondary">
                          {p.code} · {p.name}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      {b.project_type ? PROJECT_TYPE_LABELS[b.project_type] : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {people?.find((x) => x.id === b.created_by)?.full_name ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{formatDate(b.created_at)}</td>
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
