import { connection } from "next/server";
import { createClient } from "@/lib/db/server";
import { renderCertificatePdf } from "@/lib/documents/pdf";
import { formatDate } from "@/lib/format";

// GET /documentos/capacitacion/constancia/[attemptId] · constancia («diploma») de una capacitación aprobada (RF-97).
export async function GET(
  _req: Request,
  ctx: RouteContext<"/documentos/capacitacion/constancia/[attemptId]">,
) {
  await connection();
  const { attemptId } = await ctx.params;
  const supabase = await createClient();
  const { data: at } = await supabase
    .from("training_attempts")
    .select(
      "*, document_trainings(pass_score, trainer_id, document_versions(version_no, controlled_documents!document_versions_document_id_fkey(code, title)))",
    )
    .eq("id", attemptId)
    .eq("passed", true)
    .maybeSingle();
  if (!at) return new Response("Constancia no encontrada", { status: 404 });
  const t = at.document_trainings as unknown as {
    pass_score: number;
    trainer_id: string;
    document_versions: {
      version_no: number;
      controlled_documents: { code: string; title: string };
    };
  };
  const { data: people } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", [at.user_id, t.trainer_id]);
  const buffer = await renderCertificatePdf({
    person: people?.find((p) => p.id === at.user_id)?.full_name ?? "",
    code: t.document_versions.controlled_documents.code,
    versionNo: t.document_versions.version_no,
    title: t.document_versions.controlled_documents.title,
    score: at.score != null ? Math.round(Number(at.score)) : null,
    passScore: Number(t.pass_score),
    date: formatDate(at.attempted_at),
    certificate: at.certificate_code ?? "",
    trainer: people?.find((p) => p.id === t.trainer_id)?.full_name ?? "",
  });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="constancia-${at.certificate_code}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
