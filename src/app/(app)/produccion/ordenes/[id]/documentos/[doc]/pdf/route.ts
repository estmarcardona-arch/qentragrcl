import { connection } from "next/server";
import { createClient } from "@/lib/db/server";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { getProductionAccess } from "@/lib/production/access";
import {
  REQUEST_LABELS,
  STAGE_LABELS,
  type FrozenDocument,
  type Presentation,
} from "@/lib/production/labels";
import { renderOrderPdf, type PdfDoc } from "@/lib/production/order-pdf";
import { log } from "@/lib/log";

type Line = {
  order_no: number;
  required_qty: number;
  unit: string;
  pct: number | null;
  label_text: string;
  presentation_id: string | null;
  materials: { code: string; name: string } | null;
};

// GET /produccion/ordenes/[id]/documentos/[doc]/pdf · Documento generado por la OP en PDF (RF-38): SD, SE, SA, CO,
// «rotulos» y las órdenes de etapa OF, OE y OA con los pasos de la versión congelada.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/produccion/ordenes/[id]/documentos/[doc]/pdf">,
) {
  await connection();
  const { id, doc } = await ctx.params;
  const a = await getProductionAccess();
  if (!a.read) return new Response("Sin acceso a Producción", { status: 403 });
  const sb = await createClient();
  const { data: o } = await sb
    .from("production_orders")
    .select("*, products(code, name), batches!batches_order_id_fkey(id, batch_code, expiry_date)")
    .eq("id", id)
    .maybeSingle();
  if (!o || o.status === "borrador")
    return new Response("Orden no encontrada o sin aprobar", { status: 404 });
  const bb = o.batches as unknown as
    | { id: string; batch_code: string; expiry_date: string | null }[]
    | { id: string; batch_code: string; expiry_date: string | null };
  const b = Array.isArray(bb) ? bb[0] : bb;
  const product = o.products as unknown as { code: string; name: string };
  const pres = (o.presentations as unknown as Presentation[]) ?? [];
  const meta: [string, string][] = [
    ["Producto", `${product.code} ${product.name}`],
    ["Orden", o.code],
    ["Lote", b.batch_code],
    ["Tamaño", `${formatNumber(Number(o.batch_size), 1)} ${o.batch_unit}`],
    ["Vence", b.expiry_date ? formatDate(b.expiry_date).slice(3) : "N.A."],
  ];
  const base = { generatedBy: a.signer, generatedAt: formatDateTime(new Date()) };
  const { data: requests } = await sb
    .from("material_requests")
    .select("*, material_request_lines(*, materials(code, name))")
    .eq("order_id", id);
  let pdf: PdfDoc | null = null;
  const req = (requests ?? []).find((r) => r.code === doc);
  if (req) {
    const lines = ((req.material_request_lines as Line[] | null) ?? []).sort(
      (x, y) => x.order_no - y.order_no,
    );
    pdf = {
      ...base,
      title: REQUEST_LABELS[req.type],
      code: req.code,
      meta,
      columns: [
        { key: "code", label: "Código", width: "16%" },
        { key: "name", label: "Material", width: "34%" },
        { key: "pres", label: req.type === "dispensacion" ? "%" : "Presentación", width: "14%" },
        { key: "qty", label: "Cantidad", width: "18%" },
        {
          key: "check",
          label: req.type === "acondicionamiento" ? "Devuelto" : "Entregado",
          width: "18%",
        },
      ],
      rows: lines.map((l) => ({
        code: l.materials?.code ?? "",
        name: l.materials?.name ?? "",
        pres:
          req.type === "dispensacion"
            ? formatNumber(Number(l.pct), 2)
            : (pres.find((p) => p.presentation_id === l.presentation_id)?.name ?? ""),
        qty: `${formatNumber(Number(l.required_qty), req.type === "dispensacion" ? 2 : 0)} ${l.unit}`,
        check: "",
      })),
      note:
        req.type === "dispensacion"
          ? "Cantidad = porcentaje de la fórmula × tamaño del lote."
          : undefined,
    };
  } else if (doc === "rotulos") {
    pdf = {
      ...base,
      title: "Rótulos de materias primas y materiales",
      code: `Rótulos · ${o.code}`,
      meta,
      labels: (requests ?? []).flatMap((r) =>
        ((r.material_request_lines as Line[] | null) ?? []).map((l) => ({
          title: `${l.materials?.name ?? ""} · ${l.materials?.code ?? ""}`,
          qty: `${formatNumber(Number(l.required_qty), r.type === "dispensacion" ? 2 : 0)} ${l.unit}`,
          lines: [
            `${o.code} · Lote ${b.batch_code}`,
            `${REQUEST_LABELS[r.type]} ${r.code}`,
            "Pesó: ________  Verificó: ________",
          ],
        })),
      ),
    };
  } else if (doc.startsWith("CO-")) {
    const { data: c } = await sb
      .from("coding_orders")
      .select("*")
      .eq("batch_id", b.id)
      .maybeSingle();
    if (c) {
      pdf = {
        ...base,
        title: "Orden de codificado",
        code: c.code,
        meta,
        columns: [{ key: "k", label: "Texto que se imprime", width: "100%" }],
        rows: [
          { k: c.batch_code_text },
          { k: c.expiry_text },
          ...pres.map((p) => ({ k: `Presentación ${p.name}` })),
        ],
      };
    }
  } else {
    const { data: so } = await sb
      .from("stage_orders")
      .select("*")
      .eq("batch_id", b.id)
      .eq("code", doc)
      .maybeSingle();
    if (so) {
      const { data: steps } = await sb.rpc("production_stage_steps", { p_stage_order: so.id });
      const frozen = ((o.frozen_documents as unknown as FrozenDocument[]) ?? []).find(
        (d) => d.version_id === so.governing_version_id,
      );
      pdf = {
        ...base,
        title: `Orden y registro de ${STAGE_LABELS[so.stage].toLowerCase()}`,
        code: so.code,
        meta: [
          ...meta,
          [
            "Formato",
            frozen ? `${frozen.code} v${String(frozen.version_no).padStart(2, "0")}` : "N.A.",
          ],
        ],
        columns: [
          { key: "n", label: "Paso", width: "8%" },
          { key: "t", label: "Instrucción", width: "44%" },
          { key: "p", label: "Parámetros", width: "24%" },
          { key: "e", label: "Equipo", width: "10%" },
          { key: "f", label: "Ejecutó / Verificó", width: "14%" },
        ],
        rows: (steps ?? []).map((st) => ({
          n: st.label,
          t: st.text,
          p: (
            (st.params as {
              name: string;
              min?: number | null;
              max?: number | null;
              unit?: string;
            }[]) ?? []
          )
            .map((p) =>
              `${p.name}${p.min != null ? ` ${p.min}–${p.max}` : ""} ${p.unit ?? ""}`.trim(),
            )
            .join("; "),
          e: st.requires_equipment ?? "",
          f: "",
        })),
      };
    }
  }
  if (!pdf) return new Response("Documento no encontrado", { status: 404 });
  const buffer = await renderOrderPdf(pdf);
  log.info("production.pdf", { doc });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${pdf.code.replace(/[^\w.-]+/g, "_")}.pdf"`,
    },
  });
}
