import type { Metadata } from "next";
import { Download, FileText, Tag } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { ApproveOrderButton } from "@/components/production/order-actions";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getProductionAccess } from "@/lib/production/access";
import {
  ORDER_STATUS,
  REQUEST_LABELS,
  type FrozenDocument,
  type Presentation,
} from "@/lib/production/labels";

export const metadata: Metadata = { title: "Documentos de la orden · GRUFARCOL eBR" };

type Line = {
  id: string;
  order_no: number;
  required_qty: number;
  unit: string;
  pct: number | null;
  label_text: string;
  presentation_id: string | null;
  materials: { code: string; name: string } | null;
};

// S-38 · Solicitudes y documentos de la orden (RF-38, AC-14): al aprobar la OP se generan solos las órdenes de etapa,
// las solicitudes SD/SE/SA, la orden de codificado, los rótulos y los registros; todos descargables en PDF.
export default async function OrderDocumentsPage({
  params,
  searchParams,
}: PageProps<"/produccion/ordenes/[id]/documentos">) {
  const { id } = await params;
  const sp = await searchParams;
  const a = await getProductionAccess();
  if (!a.read) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a Producción" />
      </main>
    );
  }
  const { data: o } = await a.supabase
    .from("production_orders")
    .select(
      "*, products(code, name), batches!batches_order_id_fkey(id, batch_code, expiry_date, manufacture_order_no, packaging_order_no, conditioning_order_no)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();
  const batch = o.batches as unknown as
    | {
        id: string;
        batch_code: string;
        manufacture_order_no: string | null;
        packaging_order_no: string | null;
        conditioning_order_no: string | null;
      }[]
    | { id: string; batch_code: string };
  const b = Array.isArray(batch)
    ? batch[0]
    : (batch as {
        id: string;
        batch_code: string;
        manufacture_order_no: string | null;
        packaging_order_no: string | null;
        conditioning_order_no: string | null;
      });
  const [
    { data: requests },
    { data: coding },
    { data: returns },
    { data: signatures },
    { data: creator },
  ] = await Promise.all([
    a.supabase
      .from("material_requests")
      .select("*, material_request_lines(*, materials(code, name))")
      .eq("order_id", id)
      .order("type"),
    a.supabase.from("coding_orders").select("*").eq("batch_id", b.id).maybeSingle(),
    a.supabase.from("material_returns").select("*"),
    a.supabase
      .from("signatures")
      .select("signer_name, meaning, signed_at")
      .eq("record_table", "production_orders")
      .eq("record_id", id),
    a.supabase.from("profiles").select("full_name").eq("id", String(o.created_by)).maybeSingle(),
  ]);
  const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.borrador;
  const pres = (o.presentations as unknown as Presentation[]) ?? [];
  const product = o.products as unknown as { code: string; name: string };
  const docs = (o.frozen_documents as unknown as FrozenDocument[]) ?? [];
  const approval = (signatures ?? []).find((s) => s.meaning === "aprobo");
  const reqByType = (t: string) => (requests ?? []).find((r) => r.type === t);
  const pdf = (doc: string) => `/produccion/ordenes/${id}/documentos/${doc}/pdf`;
  const generated =
    o.status === "borrador"
      ? []
      : [
          ...(requests ?? []).map((r) => ({
            key: r.code,
            name: REQUEST_LABELS[r.type],
            code: r.code,
            icon: FileText,
          })),
          ...(coding
            ? [{ key: coding.code, name: "Orden de codificado", code: coding.code, icon: FileText }]
            : []),
          {
            key: "rotulos",
            name: "Rótulos de materias primas y materiales",
            code: `${(requests ?? []).reduce((n, r) => n + ((r.material_request_lines as Line[] | null)?.length ?? 0), 0)} rótulos`,
            icon: Tag,
          },
          {
            key: b.manufacture_order_no ?? "OF",
            name: "Orden y registro de fabricación",
            code: b.manufacture_order_no ?? "—",
            icon: FileText,
          },
          {
            key: b.packaging_order_no ?? "OE",
            name: "Orden y registro de envase",
            code: b.packaging_order_no ?? "—",
            icon: FileText,
          },
          {
            key: b.conditioning_order_no ?? "OA",
            name: "Orden y registro de acondicionamiento (con codificación)",
            code: b.conditioning_order_no ?? "—",
            icon: FileText,
          },
        ];
  const sd = reqByType("dispensacion");
  const sa = reqByType("acondicionamiento");
  const th = "px-3 py-2 text-label uppercase";
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={`${o.code} · ${product.code} ${product.name}`}
        description={`Lote ${b.batch_code} · ${formatNumber(Number(o.batch_size), 1)} ${o.batch_unit} · ${pres.map((p) => `${p.name}: ${formatNumber(p.bulk_qty, 1)} kg / ${formatNumber(p.units, 0)} und`).join(" · ")}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Producción", href: "/produccion/lotes" },
          { label: o.code },
        ]}
        meta={
          <>
            <StatusBadge status={st.status} label={st.label} />
            {approval ? (
              <span className="text-sm text-text-secondary" data-testid="approved-line">
                Aprobada el {formatDateTime(approval.signed_at)} por {approval.signer_name}
              </span>
            ) : null}
          </>
        }
        actions={
          <Link href={`/produccion/lotes/${b.id}`} className="text-sm font-semibold">
            Ir al lote {b.batch_code}
          </Link>
        }
      />
      {sp.nueva ? (
        <p
          role="status"
          className="rounded-lg border border-tram-en-curso-bd bg-tram-en-curso-bg px-3.5 py-2.5 text-sm text-tram-en-curso-fg"
        >
          Se creó {String(sp.nueva).replace(" · ", " y el lote ")}. Queda en borrador hasta que la
          apruebe el Director técnico.
        </p>
      ) : null}
      {o.status === "borrador" ? (
        <section className="grid gap-3 rounded-[10px] border border-border bg-surface p-5">
          <h2 className="text-card-title">Orden en borrador</h2>
          <p className="text-sm text-text-secondary">
            Creada por {creator?.full_name ?? "—"}. Al aprobarla se generan automáticamente las
            órdenes de etapa, las tres solicitudes de materiales, la orden de codificado, los
            rótulos y los tres registros.
          </p>
          {a.approveOrder ? (
            o.created_by === a.ctx.userId ? (
              <p
                role="alert"
                className="rounded-md border border-q-bad-bd bg-q-bad-bg px-3 py-2 text-sm text-q-bad-fg"
              >
                Quien creó la orden no puede aprobarla (segregación de funciones). Solicite la
                aprobación a otra persona.
              </p>
            ) : (
              <div>
                <ApproveOrderButton
                  orderId={id}
                  code={o.code}
                  batchCode={b.batch_code}
                  signer={a.signer}
                />
              </div>
            )
          ) : (
            <p className="text-sm text-text-secondary">La aprueba el Director técnico (D-12).</p>
          )}
        </section>
      ) : null}

      <section
        aria-labelledby="congeladas"
        className="grid gap-2 rounded-[10px] border border-border bg-surface p-5"
      >
        <h2 id="congeladas" className="text-card-title">
          Versiones congeladas en el lote
        </h2>
        <ul className="flex flex-wrap gap-2">
          {docs.map((d) => (
            <li
              key={d.version_id}
              className="rounded-md border border-border bg-surface-sunken px-2 py-1 font-mono text-xs"
            >
              {d.code} · v{String(d.version_no).padStart(2, "0")}
            </li>
          ))}
        </ul>
        {((o.document_warnings as unknown as { message: string }[]) ?? []).map((w) => (
          <p key={w.message} className="text-sm text-q-warn-fg">
            {w.message}
          </p>
        ))}
      </section>

      {generated.length ? (
        <section
          aria-labelledby="generados"
          className="grid gap-2 rounded-[10px] border border-border bg-surface p-5"
        >
          <h2 id="generados" className="text-card-title">
            Documentos generados
          </h2>
          <ul className="grid gap-1.5" data-testid="generated-docs">
            {generated.map((g) => (
              <li
                key={g.key}
                className="flex flex-wrap items-center gap-3 border-b border-divider py-2 last:border-0"
              >
                <g.icon aria-hidden className="size-4 text-text-secondary" />
                <span className="min-w-72 text-sm font-medium">{g.name}</span>
                <span className="font-mono text-xs">{g.code}</span>
                <a
                  href={pdf(g.key)}
                  className="ml-auto inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold"
                  download
                >
                  <Download aria-hidden className="size-4" /> Descargar PDF
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sd ? (
        <section
          aria-labelledby="sd"
          className="grid gap-2 rounded-[10px] border border-border bg-surface p-5"
        >
          <h2 id="sd" className="text-card-title">
            {sd.code} · {REQUEST_LABELS.dispensacion}
          </h2>
          <p className="text-sm text-text-secondary">
            Cantidad = porcentaje de la fórmula × tamaño del lote.
          </p>
          <table className="w-full text-left text-sm" data-testid="dispensing-request">
            <thead className="bg-surface-sunken">
              <tr>
                {["Código", "Materia prima", "%", "Cantidad", "Rótulo"].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {((sd.material_request_lines as Line[] | null) ?? [])
                .sort((x, y) => x.order_no - y.order_no)
                .map((l) => (
                  <tr key={l.id} className="border-t border-divider" data-code={l.materials?.code}>
                    <td className="px-3 py-2 font-mono text-xs">{l.materials?.code}</td>
                    <td className="px-3 py-2">{l.materials?.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {formatNumber(Number(l.pct), 2)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs font-semibold">
                      {formatNumber(Number(l.required_qty), 2)} {l.unit}
                    </td>
                    <td className="px-3 py-2 text-xs">{l.label_text}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {sa ? (
        <section
          aria-labelledby="sa"
          className="grid gap-2 rounded-[10px] border border-border bg-surface p-5"
        >
          <h2 id="sa" className="text-card-title">
            {sa.code} · {REQUEST_LABELS.acondicionamiento} y devolución
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-sunken">
              <tr>
                {[
                  "Material",
                  "Presentación",
                  "Solicitadas",
                  "Usadas",
                  "Dañadas",
                  "Devueltas",
                  "Cuadre",
                ].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {((sa.material_request_lines as Line[] | null) ?? []).map((l) => {
                const r = (returns ?? []).find((x) => x.request_line_id === l.id);
                return (
                  <tr key={l.id} className="border-t border-divider">
                    <td className="px-3 py-2">{l.materials?.name}</td>
                    <td className="px-3 py-2 text-xs">
                      {pres.find((p) => p.presentation_id === l.presentation_id)?.name}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {formatNumber(Number(l.required_qty), 0)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r ? formatNumber(Number(r.used), 0) : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r ? formatNumber(Number(r.damaged), 0) : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r ? formatNumber(Number(r.returned), 0) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r
                        ? `Cuadra: ${formatNumber(Number(r.used), 0)} + ${formatNumber(Number(r.damaged), 0)} + ${formatNumber(Number(r.returned), 0)} = ${formatNumber(Number(r.delivered), 0)}`
                        : "Se registra al cerrar el acondicionamiento"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {coding ? (
        <section
          aria-labelledby="co"
          className="grid gap-2 rounded-[10px] border border-border bg-surface p-5"
        >
          <h2 id="co" className="text-card-title">
            {coding.code} · Orden de codificado
          </h2>
          <div
            className="w-fit rounded-md border-2 border-dashed border-border-control bg-white px-5 py-3 font-mono text-lg"
            data-testid="coding-preview"
          >
            <div>{coding.batch_code_text}</div>
            <div>{coding.expiry_text}</div>
          </div>
          <p className="text-sm text-text-secondary">
            {coding.status === "verificada"
              ? "Codificación verificada en el acondicionamiento."
              : "Se verifica en la línea de acondicionamiento."}
          </p>
        </section>
      ) : null}
    </main>
  );
}
