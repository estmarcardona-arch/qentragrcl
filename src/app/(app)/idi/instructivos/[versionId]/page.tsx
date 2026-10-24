import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoPermissionState } from "@/components/common/state-card";
import { InstructionEditor } from "@/components/rd/master-editors";
import { MasterHeader } from "@/components/rd/master-list";
import { getRdAccess } from "@/lib/rd/access";
import { loadMasterVersion } from "@/lib/rd/masters";

export const metadata: Metadata = { title: "Instructivo · GRUFARCOL eBR" };

type StepParam = {
  name: string;
  unit: string;
  min: number | null;
  max: number | null;
  frequency: string;
};

// S-09 · Instructivo de manufactura en una versión del SGD (RF-13).
export default async function InstructionPage({
  params,
}: PageProps<"/idi/instructivos/[versionId]">) {
  const { versionId } = await params;
  const a = await getRdAccess();
  if (!a.masterRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a los instructivos" />
      </main>
    );
  }
  const v = await loadMasterVersion(a, versionId);
  if (!v) notFound();
  const [{ data: ins }, { data: products }, { data: presentations }] = await Promise.all([
    a.supabase
      .from("instructions")
      .select(
        "*, instruction_steps(label, text, requires_equipment, requires_verification, params, order_no)",
      )
      .eq("document_version_id", versionId)
      .maybeSingle(),
    a.supabase.from("products").select("id, code, name").eq("active", true).order("code"),
    a.supabase
      .from("product_presentations")
      .select("id, code, name, product_id")
      .eq("active", true)
      .order("code"),
  ]);
  const steps = [...(ins?.instruction_steps ?? [])].sort((x, y) => x.order_no - y.order_no);
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <MasterHeader v={v} section="Instructivos" basePath="/idi/instructivos" />
      <InstructionEditor
        versionId={versionId}
        editable={v.editable}
        products={products ?? []}
        presentations={presentations ?? []}
        initial={{
          productId: ins?.product_id ?? "",
          stage: (ins?.stage ?? "fabricacion") as "fabricacion" | "envase" | "acondicionamiento",
          presentationId: ins?.presentation_id ?? "",
          steps: steps.length
            ? steps.map((s) => ({
                label: s.label,
                text: s.text,
                requires_equipment: s.requires_equipment ?? "",
                requires_verification: s.requires_verification,
                params: (s.params as StepParam[] | null) ?? [],
              }))
            : [
                {
                  label: "1",
                  text: "",
                  requires_equipment: "",
                  requires_verification: false,
                  params: [],
                },
              ],
        }}
      />
    </main>
  );
}
