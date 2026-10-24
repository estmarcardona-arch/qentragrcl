import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { BriefForm } from "@/components/rd/brief-form";
import { getRdAccess } from "@/lib/rd/access";
import { EMPTY_BRIEF, EMPTY_COMPETITORS } from "@/lib/rd/brief-data";

export const metadata: Metadata = { title: "Nuevo brief · GRUFARCOL eBR" };

// S-06 · Formulario de brief (nuevo). Solo Comercial.
export default async function NewBriefPage() {
  const a = await getRdAccess();
  if (!a.briefCreate) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="Solo Comercial crea briefs"
          text="El brief lo elabora Comercial (PRD 2.2)."
        />
      </main>
    );
  }
  const { data: products } = await a.supabase
    .from("products")
    .select("id, code, name")
    .eq("active", true)
    .order("code");
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Nuevo brief"
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Briefs", href: "/idi/briefs" },
          { label: "Nuevo" },
        ]}
      />
      <BriefForm
        id={null}
        code={null}
        initial={EMPTY_BRIEF}
        initialCompetitors={EMPTY_COMPETITORS}
        products={(products ?? []).map((p) => ({ id: p.id, label: `${p.code} · ${p.name}` }))}
        editable
        canSubmit
        canDecide={false}
        signer={a.ctx.fullName}
        status={null}
      />
    </main>
  );
}
