import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { PrototypeEditor } from "@/components/rd/prototype-editor";
import { getRdAccess } from "@/lib/rd/access";

export const metadata: Metadata = { title: "Nuevo prototipo · GRUFARCOL eBR" };

export default async function NewPrototypePage({
  searchParams,
}: PageProps<"/idi/prototipos/nuevo">) {
  const a = await getRdAccess();
  if (!a.isIdi) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="Los prototipos los crea I+D"
          text="El químico formulador elabora los prototipos (PRD 2.2)."
        />
      </main>
    );
  }
  const sp = await searchParams;
  const { data: brief } = await a.supabase
    .from("briefs")
    .select("id, code, project_name")
    .eq("id", String(sp.brief ?? ""))
    .maybeSingle();
  if (!brief) notFound();
  const { data: materials } = await a.supabase
    .from("materials")
    .select("id, code, name, default_function")
    .eq("type", "mp")
    .eq("active", true)
    .order("code");
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Nuevo prototipo"
        description={`Brief ${brief.code} · ${brief.project_name}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Prototipos", href: `/idi/prototipos?brief=${brief.id}` },
          { label: "Nuevo" },
        ]}
      />
      <PrototypeEditor
        id={null}
        briefId={brief.id}
        editable
        initial={{
          product_type: "",
          target_description: "",
          benefit: "",
          concept: "",
          draft_instruction: "",
        }}
        initialItems={[{ material_id: "", pct: 0 }]}
        materials={(materials ?? []).map((m) => ({
          id: m.id,
          code: m.code,
          name: m.name,
          function: m.default_function,
        }))}
      />
    </main>
  );
}
