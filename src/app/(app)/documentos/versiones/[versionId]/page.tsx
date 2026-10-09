import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { DraftEditor } from "@/components/documents/draft-editor";
import { DocumentView } from "@/components/documents/document-view";
import { StatusBadge } from "@/components/gxp/status-badge";
import type { Observation } from "@/lib/documents/actions";
import { getDocAccess } from "@/lib/documents/access";
import { VERSION_BADGE, type VersionStatus } from "@/lib/documents/labels";

export const metadata: Metadata = { title: "Preliminar · GRUFARCOL eBR" };

// Preliminar de una solicitud de creación (aún sin código): el autor lo redacta sobre la plantilla
// editable y lo envía a estandarización (S-45a → S-49). Una versión ya codificada abre su documento.
export default async function DraftPage({
  params,
  searchParams,
}: PageProps<"/documentos/versiones/[versionId]">) {
  const { versionId } = await params;
  const sp = await searchParams;
  const a = await getDocAccess();
  const { supabase, ctx } = a;
  const { data: v } = await supabase
    .from("document_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (!v) notFound();
  if (v.document_id) redirect(`/documentos/${v.document_id}?v=${v.version_no}`);
  const [{ data: req }, { data: check }] = await Promise.all([
    supabase
      .from("document_requests")
      .select(
        "code, proposed_title, reason, type_id, document_types(id, name, type_code), organizational_areas!document_requests_process_id_fkey(name, process_code), profiles!document_requests_requested_by_fkey(full_name)",
      )
      .eq("id", v.request_id ?? "")
      .maybeSingle(),
    supabase
      .from("standardization_checks")
      .select("result, observations")
      .eq("version_id", versionId)
      .order("checked_at", { ascending: false })
      .limit(1),
  ]);
  const type = req?.document_types as unknown as {
    id: string;
    name: string;
    type_code: string;
  } | null;
  const area = req?.organizational_areas as unknown as {
    name: string;
    process_code: string;
  } | null;
  const requester = req?.profiles as unknown as { full_name: string } | null;
  const editable = v.author_id === ctx.userId && ["solicitado", "preliminar"].includes(v.status);
  const badge = VERSION_BADGE[v.status as VersionStatus];
  const last = check?.[0];

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={req?.proposed_title || "Preliminar sin título"}
        description={`Solicitud ${req?.code ?? ""} · ${type?.name ?? ""}${area ? ` · ${area.name} (${area.process_code})` : ""} · ${requester?.full_name ?? ""}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Documentos", href: "/documentos" },
          { label: req?.code ?? "Preliminar" },
        ]}
        meta={
          <>
            <StatusBadge status={badge.status} label={badge.label} />
            <span className="text-small text-text-secondary">
              Sin código: lo asigna Aseguramiento de la calidad al estandarizar.
            </span>
          </>
        }
      />
      {sp.nuevo ? (
        <p
          role="status"
          className="rounded-lg border border-tram-en-curso-bd bg-tram-en-curso-bg px-3.5 py-2.5 text-sm text-tram-en-curso-fg"
        >
          Solicitud {String(sp.nuevo)} registrada. Redacte el preliminar sobre la plantilla y
          envíelo a estandarización.
        </p>
      ) : null}
      {v.status === "en_estandarizacion" ? (
        <p
          role="status"
          className="rounded-lg border border-tram-revision-bd bg-tram-revision-bg px-3.5 py-2.5 text-sm text-tram-revision-fg"
        >
          En estandarización por Aseguramiento de la calidad.{" "}
          {a.isAqDoc ? (
            <Link href={`/documentos/estandarizacion?v=${v.id}`}>
              Abrir en la bandeja de estandarización
            </Link>
          ) : null}
        </p>
      ) : null}
      {editable && type ? (
        <DraftEditor
          versionId={v.id}
          typeId={type.id}
          content={v.content as Record<string, string>}
          isModification={false}
          changeDescription={v.change_description}
          technicalChange={v.technical_change}
          isSubdocument={false}
          returnedObservations={
            last?.result === "no_cumple" ? (last.observations as Observation[]) : undefined
          }
        />
      ) : (
        <DocumentView
          title={req?.proposed_title ?? ""}
          code="Sin código"
          versionNo={v.version_no}
          issueDate={null}
          reviewDate={null}
          statusLabel={badge.label}
          content={v.content as Record<string, string>}
          history={[]}
          signatures={[null, null, null]}
          copy="no_controlada"
        />
      )}
    </main>
  );
}
