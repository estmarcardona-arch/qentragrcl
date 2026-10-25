import type { Metadata } from "next";
import {
  CircleCheck,
  CircleX,
  Clock,
  Download,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { cn } from "cn";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { PrintLabelButton } from "@/components/warehouse/print-label-button";
import { formatDate, formatNumber } from "@/lib/format";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import { KIND, loadLabel } from "@/lib/warehouse/label";
import { LOT_STATUS } from "@/lib/warehouse/labels";

export const metadata: Metadata = { title: "Rótulo · GRUFARCOL eBR" };

const BAND: Record<string, { text: string; icon: LucideIcon; cls: string; note: string }> = {
  cuarentena: {
    text: "CUARENTENA",
    icon: TriangleAlert,
    cls: "bg-q-warn-bg text-q-warn-fg border-q-warn-fg",
    note: "No dispensar hasta liberación de Calidad",
  },
  aprobado: {
    text: "APROBADO",
    icon: CircleCheck,
    cls: "bg-q-ok-bg text-q-ok-fg border-q-ok-fg",
    note: "Liberado por Control de calidad",
  },
  rechazado: {
    text: "RECHAZADO",
    icon: CircleX,
    cls: "bg-q-bad-bg text-q-bad-fg border-q-bad-fg",
    note: "No usar · bodega de rechazo",
  },
  vencido: {
    text: "VENCIDO",
    icon: Clock,
    cls: "bg-q-bad-bg text-q-bad-fg border-q-bad-fg",
    note: "No usar · vencido",
  },
};

// S-14 · Rótulo del lote (RF-20): código interno, UBICACIÓN asignada en grande, estado legible a un metro,
// QR con el código interno y fecha de recepción. Vista de impresión del navegador, 10 × 7 cm (D-10).
export default async function LabelPage({
  params,
  searchParams,
}: PageProps<"/bodega/rotulos/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const a = await getWarehouseAccess();
  if (!a.invRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a los rótulos" />
      </main>
    );
  }
  const data = await loadLabel(a.supabase, id);
  if (!data) notFound();
  const { lot, state, locations } = data;
  const band = BAND[state] ?? BAND.cuarentena;
  const Icon = band.icon;
  const qr = await QRCode.toString(String(lot.internal_code), {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
  });
  const st = LOT_STATUS[String(lot.effective_status)] ?? LOT_STATUS.cuarentena;

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={`Rótulo ${lot.internal_code}`}
        description={`${lot.material_name} · lote ${lot.supplier_lot} · recepción ${formatDate(String(lot.received_at))}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Bodega" },
          { label: `Rótulo ${lot.internal_code}` },
        ]}
        meta={<StatusBadge status={st.status} label={st.label} />}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={`/bodega/inventario/${id}`}>Ver kardex</Link>
            </Button>
            <Button asChild variant="secondary">
              <a href={`/bodega/rotulos/${id}/pdf`} download>
                <Download aria-hidden /> Descargar PDF
              </a>
            </Button>
            <PrintLabelButton lotId={id} />
          </>
        }
      />
      {sp.nuevo ? (
        <p
          role="status"
          className="rounded-lg border border-q-warn-bd bg-q-warn-bg px-3.5 py-2.5 text-sm text-q-warn-fg"
        >
          Lote {lot.internal_code} recibido en CUARENTENA en {locations.join(", ")}. Imprima el
          rótulo y péguelo en el envase.
        </p>
      ) : null}
      <p className="text-sm text-text-secondary">
        Vista de impresión · rótulo 10 × 7 cm · impresora de etiquetas o de oficina (D-10).
      </p>

      <article
        aria-label={`Rótulo del lote ${lot.internal_code}`}
        data-testid="label"
        className="print-label border-text text-text grid w-[600px] gap-3 rounded-lg border-2 bg-white p-4"
      >
        <header className="flex items-center justify-between text-xs font-semibold tracking-wide">
          <span>GRUFARCOL · {KIND[String(lot.material_type)] ?? "INSUMO"}</span>
          <span>Recibido {formatDate(String(lot.received_at))}</span>
        </header>
        <div
          className={cn(
            "flex items-center justify-center gap-3 rounded-md border-2 py-3",
            band.cls,
          )}
          data-testid="label-status"
        >
          <Icon aria-hidden className="size-10" />
          <span className="text-5xl leading-none font-bold tracking-wide">{band.text}</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-4">
          <dl className="grid gap-2">
            <div>
              <dt className="text-[11px] font-semibold text-text-secondary uppercase">Ubicación</dt>
              <dd className="font-mono text-3xl font-bold" data-testid="label-location">
                {locations.join(" · ") || "Sin ubicación"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-text-secondary uppercase">
                Código interno
              </dt>
              <dd className="font-mono text-xl font-semibold">{lot.internal_code}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-text-secondary uppercase">Material</dt>
              <dd className="text-base font-semibold">
                {lot.material_name} · {lot.material_code}
              </dd>
            </div>
            <div className="flex gap-6 text-sm">
              <span>
                Lote proveedor <b className="font-mono">{lot.supplier_lot}</b>
              </span>
              <span>
                {data.expiryLabel}{" "}
                <b className="font-mono">{formatDate(String(lot.expiry_date))}</b>
              </span>
              <span>
                Cantidad{" "}
                <b className="font-mono">
                  {formatNumber(Number(lot.qty_received), 2)} {lot.unit}
                </b>
              </span>
            </div>
            {data.packages || data.purchaseOrder ? (
              <div className="flex gap-6 text-sm">
                {data.packages ? (
                  <span>
                    Empaques <b className="font-mono">{data.packages}</b>
                  </span>
                ) : null}
                {data.purchaseOrder ? (
                  <span>
                    OC <b className="font-mono">{data.purchaseOrder}</b>
                  </span>
                ) : null}
              </div>
            ) : null}
            {data.storage ? (
              <div className="text-sm" data-testid="label-storage">
                Almacenamiento: <b>{data.storage}</b>
              </div>
            ) : null}
          </dl>
          <figure className="grid content-start justify-items-center gap-1">
            <span
              className="block size-[120px]"
              role="img"
              aria-label={`Código QR ${lot.internal_code}`}
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <figcaption className="font-mono text-[11px]">{lot.internal_code}</figcaption>
          </figure>
        </div>
        <footer className="flex justify-between border-t border-divider pt-2 text-xs">
          <span className="font-semibold">{band.note}</span>
          <span>{lot.supplier_name}</span>
        </footer>
      </article>
    </main>
  );
}
