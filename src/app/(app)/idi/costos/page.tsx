import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, NoPermissionState } from "@/components/common/state-card";
import { formatCOP } from "@/lib/format";
import { getRdAccess } from "@/lib/rd/access";
import { loadMasterVersions } from "@/lib/rd/masters";

export const metadata: Metadata = { title: "Costos · GRUFARCOL eBR" };

// S-37 · Costos por fórmula (RF-17). Confidenciales: solo roles autorizados (AC-09).
export default async function CostsPage() {
  const a = await getRdAccess();
  if (!a.protoRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="Los costos son confidenciales"
          text="Solo los roles autorizados ven las hojas de costos (RF-17)."
        />
      </main>
    );
  }
  const versions = await loadMasterVersions(a, "FM");
  const [{ data: formulas }, { data: sheets }, { data: totals }] = await Promise.all([
    versions.length
      ? a.supabase
          .from("formulas")
          .select("id, document_version_id, products(code, name)")
          .in(
            "document_version_id",
            versions.map((v) => v.versionId),
          )
      : Promise.resolve({ data: [] as never[] }),
    a.supabase.from("cost_sheets").select("id, formula_id, version, updated_at"),
    a.supabase.from("v_cost_sheet_totals").select("*"),
  ]);
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Costos"
        description="Costo del granel, de la unidad terminada por presentación y del lote industrial. Esta información es confidencial y no aparece en la verificación pública."
        breadcrumbs={[{ label: "Inicio", href: "/inicio" }, { label: "I+D" }, { label: "Costos" }]}
      />
      {(formulas ?? []).length === 0 ? (
        <EmptyState
          title="No hay fórmulas con contenido"
          text="La hoja de costos se elabora sobre una fórmula maestra."
        />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm" data-testid="costs">
            <caption className="sr-only">Hojas de costos</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {["Fórmula", "Producto", "Granel", "Unidad terminada", "Lote industrial"].map(
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
              {(formulas ?? []).map((f) => {
                const v = versions.find((x) => x.versionId === f.document_version_id)!;
                const s = (sheets ?? []).find((x) => x.formula_id === f.id);
                const t = (totals ?? []).find((x) => x.cost_sheet_id === s?.id);
                const p = f.products as { code: string; name: string } | null;
                const pres = (t?.presentations ?? []) as { code: string; finished: number }[];
                return (
                  <tr
                    key={f.id}
                    data-code={v.code}
                    className="border-b border-divider last:border-0"
                  >
                    <td className="px-3 py-2.5 font-mono text-[13px] font-semibold">
                      <Link href={`/idi/costos/${f.id}`}>{v.code}</Link>{" "}
                      <span className="text-xs font-normal">
                        v{String(v.versionNo).padStart(2, "0")}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{p ? `${p.code} ${p.name}` : "—"}</td>
                    <td className="px-3 py-2.5 font-mono">
                      {t ? (
                        formatCOP(Number(t.bulk_cost))
                      ) : (
                        <span className="font-sans text-text-secondary">Sin hoja</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono">
                      {pres.map((x) => `${x.code} ${formatCOP(Number(x.finished))}`).join(" · ") ||
                        "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono">
                      {t ? formatCOP(Number(t.industrial_lot_cost)) : "—"}
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
