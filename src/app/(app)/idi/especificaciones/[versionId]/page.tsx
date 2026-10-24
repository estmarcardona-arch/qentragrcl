import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoPermissionState } from "@/components/common/state-card";
import { SpecificationEditor } from "@/components/rd/master-editors";
import { MasterHeader } from "@/components/rd/master-list";
import { getRdAccess } from "@/lib/rd/access";
import { loadMasterVersion } from "@/lib/rd/masters";

export const metadata: Metadata = { title: "Especificación · GRUFARCOL eBR" };

// S-08 · Especificación en una versión del SGD (RF-12).
export default async function SpecificationPage({
  params,
}: PageProps<"/idi/especificaciones/[versionId]">) {
  const { versionId } = await params;
  const a = await getRdAccess();
  if (!a.masterRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a las especificaciones" />
      </main>
    );
  }
  const v = await loadMasterVersion(a, versionId);
  if (!v) notFound();
  const [{ data: s }, { data: products }, { data: materials }] = await Promise.all([
    a.supabase
      .from("specifications")
      .select("*, spec_parameters(name, method, min_value, max_value, unit, text_limit, order_no)")
      .eq("document_version_id", versionId)
      .maybeSingle(),
    a.supabase.from("products").select("id, code, name").eq("active", true).order("code"),
    a.supabase.from("materials").select("id, code, name, type").eq("active", true).order("code"),
  ]);
  const params_ = [...(s?.spec_parameters ?? [])].sort((x, y) => x.order_no - y.order_no);
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <MasterHeader v={v} section="Especificaciones" basePath="/idi/especificaciones" />
      <SpecificationEditor
        versionId={versionId}
        editable={v.editable}
        products={products ?? []}
        materials={materials ?? []}
        initial={{
          scope: (s?.scope ?? "pt") as "mp" | "envase" | "granel" | "pt",
          productId: s?.product_id ?? "",
          materialId: s?.material_id ?? "",
          params: params_.length
            ? params_.map((p) => ({
                name: p.name,
                method: p.method,
                min_value: p.min_value == null ? null : Number(p.min_value),
                max_value: p.max_value == null ? null : Number(p.max_value),
                unit: p.unit ?? "",
                text_limit: p.text_limit ?? "",
              }))
            : [
                {
                  name: "",
                  method: "",
                  min_value: null,
                  max_value: null,
                  unit: "",
                  text_limit: "",
                },
              ],
        }}
      />
    </main>
  );
}
