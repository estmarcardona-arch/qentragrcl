import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoPermissionState } from "@/components/common/state-card";
import { FormulaEditor } from "@/components/rd/master-editors";
import { MasterHeader } from "@/components/rd/master-list";
import { getRdAccess } from "@/lib/rd/access";
import { loadMasterVersion } from "@/lib/rd/masters";

export const metadata: Metadata = { title: "Fórmula maestra · GRUFARCOL eBR" };

// S-07 · Fórmula maestra en una versión del SGD. La aprobación exige estabilidad completa y conforme (AC-13).
export default async function FormulaPage({ params }: PageProps<"/idi/formulas/[versionId]">) {
  const { versionId } = await params;
  const a = await getRdAccess();
  if (!a.masterRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a las fórmulas" />
      </main>
    );
  }
  const v = await loadMasterVersion(a, versionId);
  if (!v) notFound();
  const [{ data: f }, { data: products }, { data: materials }, { data: protos }] =
    await Promise.all([
      a.supabase
        .from("formulas")
        .select("*, formula_items(material_id, pct, phase, function, order_no)")
        .eq("document_version_id", versionId)
        .maybeSingle(),
      a.supabase.from("products").select("id, code, name").eq("active", true).order("code"),
      a.supabase
        .from("materials")
        .select("id, code, name, default_function")
        .eq("type", "mp")
        .order("code"),
      a.supabase.from("formula_prototypes").select("id, code, concept, status").order("code"),
    ]);
  const proto = (protos ?? []).find((p) => p.id === f?.prototype_id);
  const notice = ["vigente", "obsoleto"].includes(v.status)
    ? null
    : !proto
      ? "La aprobación queda bloqueada hasta ligar la fórmula a un prototipo con estabilidad completa y conforme (AC-13)."
      : proto.status !== "aprobado"
        ? `La aprobación queda bloqueada: el prototipo ${proto.code} aún no tiene estabilidad conforme ni aprobación como fórmula (AC-13).`
        : null;
  const items = [...(f?.formula_items ?? [])].sort((x, y) => x.order_no - y.order_no);
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <MasterHeader v={v} section="Fórmulas maestras" basePath="/idi/formulas" notice={notice} />
      {proto ? (
        <p className="text-small text-text-secondary">
          Prototipo de origen:{" "}
          <Link href={`/idi/prototipos/${proto.id}`} className="font-mono">
            {proto.code}
          </Link>
          {f ? (
            <>
              {" "}
              · <Link href={`/idi/costos/${f.id}`}>Hoja de costos</Link>
            </>
          ) : null}
        </p>
      ) : null}
      <FormulaEditor
        versionId={versionId}
        editable={v.editable}
        products={products ?? []}
        prototypes={(protos ?? [])
          .filter((p) => p.status === "aprobado" || p.id === f?.prototype_id)
          .map((p) => ({ id: p.id, code: p.code, name: p.concept.slice(0, 60) }))}
        materials={(materials ?? []).map((m) => ({
          id: m.id,
          code: m.code,
          name: m.name,
          function: m.default_function,
        }))}
        initial={{
          productId: f?.product_id ?? "",
          batchSize: f ? Number(f.batch_size) : 2000,
          prototypeId: f?.prototype_id ?? null,
          items: items.length
            ? items.map((i) => ({
                material_id: i.material_id,
                pct: Number(i.pct),
                phase: i.phase ?? "",
                function: i.function ?? "",
              }))
            : [{ material_id: "", pct: 0 }],
        }}
      />
    </main>
  );
}
