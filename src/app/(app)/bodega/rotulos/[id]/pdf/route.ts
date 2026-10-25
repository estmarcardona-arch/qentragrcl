import { connection } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/db/server";
import { formatDate, formatNumber } from "@/lib/format";
import { log } from "@/lib/log";
import { callRpc } from "@/lib/rpc";
import { BAND_TEXT, KIND, loadLabel } from "@/lib/warehouse/label";
import { renderLabelPdf } from "@/lib/warehouse/label-pdf";

// GET /bodega/rotulos/[id]/pdf · Rótulo del lote descargable en PDF de 10 × 7 cm (RF-20 v1.9). Registra quién lo
// genera, igual que la impresión (labels).
export async function GET(_request: Request, ctx: RouteContext<"/bodega/rotulos/[id]/pdf">) {
  await connection();
  const { id } = await ctx.params;
  const supabase = await createClient();
  const d = await loadLabel(supabase, id);
  if (!d) return new Response("Lote no encontrado", { status: 404 });
  try {
    await callRpc(supabase, "log_label_print", { p_lot: id });
  } catch {
    return new Response("Sin acceso a los rótulos", { status: 403 });
  }
  const { lot } = d;
  const band = BAND_TEXT[d.state] ?? BAND_TEXT.cuarentena;
  const buffer = await renderLabelPdf({
    kind: KIND[String(lot.material_type)] ?? "INSUMO",
    received: formatDate(String(lot.received_at)),
    state: d.state,
    band: band.text,
    note: band.note,
    location: d.locations.join(" · ") || "Sin ubicación",
    code: String(lot.internal_code),
    material: `${lot.material_name} · ${lot.material_code}`,
    supplierLot: String(lot.supplier_lot),
    expiryLabel: d.expiryLabel,
    expiry: formatDate(String(lot.expiry_date)),
    qty: `${formatNumber(Number(lot.qty_received), 2)} ${lot.unit}`,
    packages: d.packages,
    purchaseOrder: d.purchaseOrder,
    storage: d.storage,
    supplier: String(lot.supplier_name ?? ""),
    qrDataUrl: await QRCode.toDataURL(String(lot.internal_code), {
      margin: 0,
      errorCorrectionLevel: "M",
      width: 240,
    }),
  });
  log.info("warehouse.label_pdf", { code: lot.internal_code });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rotulo-${lot.internal_code}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
