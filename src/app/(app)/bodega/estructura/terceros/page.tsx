import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { NewParty, QualifyParty } from "@/components/warehouse/party-actions";
import { formatDate } from "@/lib/format";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import { PARTY_KINDS } from "@/lib/warehouse/labels";
import { qualification, todayBogota } from "@/lib/warehouse/structure";

export const metadata: Metadata = { title: "Terceros · GRUFARCOL eBR" };

// Terceros (proveedores, maquiladores y almacenamiento externo) y su calificación (D-17, RF-25).
export default async function PartiesPage() {
  const a = await getWarehouseAccess();
  if (!a.structRead && !a.structEdit && !a.structApprove) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a los terceros" />
      </main>
    );
  }
  const { data: parties } = await a.supabase
    .from("external_parties")
    .select("*")
    .order("kind")
    .order("name");
  const today = todayBogota();
  const th = "border-b border-border px-3 py-2.5 text-label uppercase";
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Terceros y calificación"
        description="Proveedores de insumos, maquiladores y almacenamiento externo. La calificación la registra Aseguramiento de la calidad."
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Bodegas y ubicaciones", href: "/bodega/estructura" },
          { label: "Terceros" },
        ]}
        actions={a.structEdit || a.structApprove ? <NewParty /> : null}
      />
      {(parties ?? []).length === 0 ? (
        <EmptyState title="Aún no hay terceros" />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm" data-testid="parties">
            <caption className="sr-only">Terceros</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {["Tercero", "Tipo", "Calificación", "Referencia", ""].map((h) => (
                  <th key={h || "acciones"} scope="col" className={th}>
                    {h || <span className="sr-only">Acciones</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(parties ?? []).map((p) => {
                const q = qualification(p, today);
                const relevant = p.kind !== "proveedor" || p.qualified;
                return (
                  <tr
                    key={p.id}
                    data-name={p.name}
                    className="border-b border-divider last:border-0"
                  >
                    <td className="px-3 py-2.5">
                      <b className="font-semibold">{p.name}</b>
                      {p.contact ? (
                        <span className="block text-xs text-text-secondary">{p.contact}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">{PARTY_KINDS[p.kind] ?? p.kind}</td>
                    <td className="px-3 py-2.5">
                      {relevant ? (
                        <StatusBadge status={q.ok ? "vigente" : "vencido"} label={q.label} />
                      ) : (
                        <span className="text-text-secondary">No aplica</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {p.qualification_ref ?? "—"}
                      {p.qualified_at ? ` · ${formatDate(p.qualified_at)}` : ""}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {a.structApprove ? (
                        <QualifyParty
                          id={p.id}
                          name={p.name}
                          qualified={p.qualified}
                          expires={p.qualification_expires}
                          reference={p.qualification_ref}
                        />
                      ) : null}
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
