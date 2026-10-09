import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { RequestForm } from "@/components/documents/request-form";
import { roleLabel } from "@/lib/auth/roles";
import { getDocAccess } from "@/lib/documents/access";

export const metadata: Metadata = { title: "Solicitar documento · GRUFARCOL eBR" };

// S-45a · Solicitar crear, modificar o anular un documento (RF-93). Cualquier autor solicita; la anulación,
// un jefe de área (PRD 2.5.6). El código lo asigna aq_doc en la estandarización (S-49).
export default async function NewRequestPage({ searchParams }: PageProps<"/documentos/nuevo">) {
  const a = await getDocAccess();
  if (!a.canAuthor) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No puede solicitar documentos"
          text="Su acceso al sistema de gestión documental es de solo lectura."
        />
      </main>
    );
  }
  const sp = await searchParams;
  const { supabase } = a;
  const [{ data: areas }, { data: types }, { data: docs }, { data: heads }] = await Promise.all([
    supabase
      .from("organizational_areas")
      .select("id, name, process_code")
      .eq("active", true)
      .order("name"),
    supabase
      .from("document_types")
      .select("id, type_code, name, requires_scope, is_subdocument")
      .eq("active", true)
      .order("level"),
    supabase
      .from("controlled_documents")
      .select("id, code, title, type_id, status")
      .eq("status", "vigente")
      .order("code"),
    supabase.from("organizational_areas").select("id").eq("head_user_id", a.ctx.userId),
  ]);
  const prType = types?.find((t) => t.type_code === "PR")?.id;
  const canAnnul =
    (heads?.length ?? 0) > 0 ||
    a.ctx.roles.some((r) =>
      ["bodega_jefe", "prod_coord", "cc_jefe", "aq_dir", "dt", "gerencia"].includes(r),
    );
  const kind = (["creacion", "modificacion", "anulacion"] as const).find((k) => k === sp.tipo);

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Solicitar documento"
        description="Crear, modificar o anular un documento controlado"
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Documentos", href: "/documentos" },
          { label: "Nueva solicitud" },
        ]}
      />
      <RequestForm
        areas={(areas ?? []).map((x) => ({ id: x.id, label: x.name, processCode: x.process_code }))}
        types={(types ?? []).map((t) => ({
          id: t.id,
          label: t.name,
          code: t.type_code,
          name: t.name,
          requiresScope: t.requires_scope,
          isSub: t.is_subdocument,
        }))}
        documents={(docs ?? []).map((d) => ({
          id: d.id,
          label: `${d.code} · ${d.title}`,
          code: d.code,
        }))}
        parents={(docs ?? [])
          .filter((d) => d.type_id === prType)
          .map((d) => ({ id: d.id, label: `${d.code} · ${d.title}` }))}
        authorLabel={`${a.ctx.fullName} · ${a.ctx.jobTitle ?? roleLabel(a.ctx.roles[0] ?? "")}`}
        canAnnul={canAnnul}
        initial={{ kind, documentId: typeof sp.documento === "string" ? sp.documento : undefined }}
      />
    </main>
  );
}
