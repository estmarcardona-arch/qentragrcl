import { connection } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { formatDateTime, formatNumber } from "@/lib/format";
import { log } from "@/lib/log";
import { TRANSFER_STATUS } from "@/lib/warehouse/labels";
import { renderRemissionPdf } from "@/lib/warehouse/remission-pdf";
import { loadTransfer } from "@/lib/warehouse/transfer";

// GET /bodega/traslados/[id]/remision · Remisión del traslado en PDF (RF-25).
export async function GET(_request: Request, ctx: RouteContext<"/bodega/traslados/[id]/remision">) {
  await connection();
  const { id } = await ctx.params;
  const session = await requireSession();
  const supabase = await createClient();
  const v = await loadTransfer(supabase, id);
  if (!v) return new Response("Traslado no encontrado", { status: 404 });
  const { t } = v;
  const date = (m: string) => {
    const g = v.sig(m);
    return g ? formatDateTime(g.signed_at) : "";
  };
  const buffer = await renderRemissionPdf({
    code: t.code,
    status: TRANSFER_STATUS[t.status]?.label ?? t.status,
    from: `${t.from?.code} · ${t.from?.name}`,
    to: `${t.to?.code} · ${t.to?.name}`,
    party: t.to?.external_parties?.name ?? null,
    address: t.to?.address ?? null,
    reason: t.reason,
    lines: v.lines.map((l) => ({
      lot: String(l.lot?.internal_code),
      supplierLot: String(l.lot?.supplier_lot),
      material: String(l.lot?.materials?.name),
      qty: `${formatNumber(l.qty, 2)} ${l.lot?.unit ?? ""}`,
      from: l.fromCode,
      to: l.toCode ?? "Por asignar",
    })),
    signatures: [
      { label: "Preparó", name: v.preparedBy, date: formatDateTime(t.created_at) },
      { label: "Despachó", name: v.sig("ejecuto")?.signer_name ?? "", date: date("ejecuto") },
      { label: "Aprobó", name: v.sig("aprobo")?.signer_name ?? "", date: date("aprobo") },
      { label: "Recibió", name: v.sig("verifico")?.signer_name ?? "", date: date("verifico") },
    ],
    receptionRef: t.reception_ref,
    generatedBy: session.fullName,
    generatedAt: formatDateTime(new Date()),
  });
  log.info("warehouse.remission_pdf", { code: t.code });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="remision-${t.code}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
