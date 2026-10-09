import { connection, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { loadDocument } from "@/lib/documents/detail";
import { VERSION_BADGE, type VersionStatus } from "@/lib/documents/labels";
import { renderDocumentPdf } from "@/lib/documents/pdf";
import { formatDateTime, formatDocumentDate } from "@/lib/format";
import { log } from "@/lib/log";
import { callRpc } from "@/lib/rpc";

// GET /documentos/[id]/pdf?v=N&copia=no_controlada · PDF con la marca de la copia (RF-103). La base decide
// la marca (un obsoleto o anulado siempre sale «OBSOLETO») y registra usuario y fecha de la descarga.
export async function GET(request: NextRequest, ctx: RouteContext<"/documentos/[id]/pdf">) {
  await connection();
  const { id } = await ctx.params;
  const supabase = await createClient();
  const d = await loadDocument(supabase, id);
  if (!d) return new Response("Documento no encontrado", { status: 404 });
  const v = request.nextUrl.searchParams.get("v");
  const sel =
    d.versions.find((x) => String(x.version_no) === v) ??
    d.versions.find((x) => x.id === d.doc.current_version_id) ??
    d.versions[0];
  if (!sel) return new Response("El documento no tiene versiones", { status: 404 });
  let mark: {
    copy_type: "controlada" | "no_controlada" | "obsoleto";
    downloaded_at: string;
    user_name: string;
  };
  try {
    mark = (await callRpc(supabase, "log_document_download", {
      p_version: sel.id,
      p_copy_type:
        request.nextUrl.searchParams.get("copia") === "no_controlada"
          ? "no_controlada"
          : "controlada",
    })) as typeof mark;
  } catch {
    return new Response("Sin acceso al documento", { status: 403 });
  }
  const labels = {
    actualizo: "Actualizado por",
    reviso: "Revisado por",
    aprobo: "Aprobado por",
  } as const;
  const box = d.signatureBox(sel.id);
  const buffer = await renderDocumentPdf({
    title: d.doc.title,
    code: d.doc.code,
    versionNo: sel.version_no,
    issueDate: sel.issue_date,
    reviewDate: sel.review_due_date,
    status:
      d.doc.status === "anulado" ? "Anulado" : VERSION_BADGE[sel.status as VersionStatus].label,
    content: sel.content as Record<string, string>,
    history: d.versions
      .filter((x) => x.issue_date)
      .map((x) => ({
        version_no: x.version_no,
        issue_date: x.issue_date,
        change_description: x.change_description,
      })),
    signatures: (["actualizo", "reviso", "aprobo"] as const).map((m, i) => ({
      label: labels[m],
      name: box[i]?.name ?? "",
      jobTitle: box[i]?.jobTitle ?? "",
      short: box[i]?.shortSignature ?? "",
      date: box[i] ? formatDocumentDate(box[i]!.signedAt) : "",
    })),
    copy: mark.copy_type,
    showSignatures: mark.copy_type !== "controlada" || d.type?.stamp_required !== false,
    downloadedBy: mark.user_name,
    downloadedAt: formatDateTime(mark.downloaded_at),
  });
  log.info("documents.pdf", { code: d.doc.code, version: sel.version_no, copy: mark.copy_type });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${d.doc.code}-v${String(sel.version_no).padStart(2, "0")}-${mark.copy_type}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
