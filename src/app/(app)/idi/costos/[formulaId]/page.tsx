import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { CostSheetEditor } from "@/components/rd/cost-sheet-editor";
import { getRdAccess } from "@/lib/rd/access";
import { loadMasterVersion } from "@/lib/rd/masters";

export const metadata: Metadata = { title: "Hoja de costos · GRUFARCOL eBR" };

// S-37 · Hoja de costos de una fórmula (RF-17). Solo roles autorizados (AC-09).
export default async function CostSheetPage({ params }: PageProps<"/idi/costos/[formulaId]">) {
  const { formulaId } = await params;
  const a = await getRdAccess();
  if (!a.costRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="Los costos son confidenciales"
          text="Solo I+D, Dirección técnica y Gerencia ven las hojas de costos (RF-17)."
        />
      </main>
    );
  }
  const { data: f } = await a.supabase
    .from("formulas")
    .select(
      "id, product_id, batch_size, document_version_id, products(code, name), formula_items(material_id, pct, order_no, materials(code, name))",
    )
    .eq("id", formulaId)
    .maybeSingle();
  if (!f) notFound();
  const [v, { data: presentations }, { data: cs }] = await Promise.all([
    loadMasterVersion(a, f.document_version_id),
    a.supabase
      .from("product_presentations")
      .select("id, code, name, net_content")
      .eq("product_id", f.product_id)
      .eq("active", true)
      .order("net_content", { ascending: false }),
    a.supabase
      .from("cost_sheets")
      .select("*, cost_sheet_lines(*)")
      .eq("formula_id", formulaId)
      .maybeSingle(),
  ]);
  const lines = cs?.cost_sheet_lines ?? [];
  const units = (cs?.industrial_lot_units ?? {}) as Record<string, number>;
  const product = f.products as { code: string; name: string } | null;
  const items = [...(f.formula_items ?? [])].sort((x, y) => x.order_no - y.order_no);
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={`Hoja de costos · ${v?.code ?? "Fórmula"}`}
        description={
          product
            ? `${product.code} ${product.name}${cs ? ` · versión ${cs.version} de la hoja` : ""}`
            : undefined
        }
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Costos", href: "/idi/costos" },
          { label: v?.code ?? "Fórmula" },
        ]}
        meta={
          v ? (
            <Link href={`/idi/formulas/${v.versionId}`} className="text-small">
              Ver la fórmula
            </Link>
          ) : null
        }
      />
      <p
        role="note"
        className="rounded-lg border border-neutral-strong bg-surface-sunken px-3.5 py-2.5 text-sm"
      >
        Esta información es confidencial y no aparece en la verificación pública.
      </p>
      <CostSheetEditor
        formulaId={formulaId}
        editable={a.costCreate}
        exists={Boolean(cs)}
        initial={{
          batchSize: Number(cs?.batch_size ?? f.batch_size),
          density: Number(cs?.density ?? 1),
          ingredients: items.map((i) => {
            const m = i.materials as { code: string; name: string } | null;
            const l = lines.find(
              (x) => x.kind === "ingrediente" && x.material_id === i.material_id,
            );
            return {
              material_id: i.material_id,
              code: m?.code ?? "",
              name: m?.name ?? "",
              pct: Number(i.pct),
              unit_cost: Number(l?.unit_cost ?? 0),
            };
          }),
          presentations: (presentations ?? []).map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            net_content: Number(p.net_content),
            units: Number(units[p.id] ?? 0),
          })),
          packaging: lines
            .filter((x) => x.kind !== "ingrediente" && x.presentation_id)
            .map((x) => ({
              presentation_id: x.presentation_id!,
              kind: x.kind,
              description: x.description,
              unit_cost: Number(x.unit_cost),
              qty: Number(x.qty),
            })),
        }}
      />
    </main>
  );
}
