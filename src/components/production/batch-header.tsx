import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/gxp/status-badge";
import { formatDate } from "@/lib/format";
import type { BatchData } from "@/lib/production/batch";
import { BATCH_STATUS, STAGE_LABELS } from "@/lib/production/labels";
import { ProcessLine } from "./process-line";

/** Encabezado común de las pantallas del lote: lote, producto, OP, sello del formato y avisos de capacitación. */
export function BatchHeader({
  data,
  title,
  current,
  stage,
  training,
}: {
  data: BatchData;
  title: string;
  current?: string;
  stage?: string;
  training?: { blocked: boolean; message: string } | null;
}) {
  const b = data.batch;
  const st = BATCH_STATUS[b.status] ?? BATCH_STATUS.creado;
  const doc = stage
    ? data.order.frozen_documents.find(
        (d) => d.kind === "plantilla" && d.stage === (stage === "despeje" ? "despeje" : stage),
      )
    : null;
  return (
    <div className="grid gap-3">
      <PageHeader
        title={`${b.batch_code} · ${title}`}
        description={`${data.product.code} ${data.product.name} · ${data.order.code} · ${Number(b.batch_size).toLocaleString("es-CO")} ${b.batch_unit} · vence ${b.expiry_date ? formatDate(b.expiry_date).slice(3) : "N.A."}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Producción", href: "/produccion/lotes" },
          { label: b.batch_code, href: `/produccion/lotes/${b.id}` },
          ...(current ? [{ label: STAGE_LABELS[current] ?? title }] : []),
        ]}
        meta={
          <>
            <StatusBadge status={st.status} label={st.label} />
            {doc ? (
              <span
                className="rounded-md border border-border bg-surface-sunken px-2 py-1 font-mono text-xs"
                data-testid="controlled-stamp"
              >
                {doc.code} · v{String(doc.version_no).padStart(2, "0")} · Vigente
              </span>
            ) : null}
          </>
        }
      />
      <ProcessLine batchId={b.id} stages={data.stages} current={current} />
      {training ? (
        <div
          role={training.blocked ? "alert" : "status"}
          className={
            training.blocked
              ? "flex flex-wrap items-center gap-2 rounded-lg border border-q-bad-bd bg-q-bad-bg px-3.5 py-2.5 text-sm text-q-bad-fg"
              : "flex flex-wrap items-center gap-2 rounded-lg border border-q-warn-bd bg-q-warn-bg px-3.5 py-2.5 text-sm text-q-warn-fg"
          }
          data-testid="training-notice"
        >
          <TriangleAlert aria-hidden className="size-4" />
          {training.message}
          <Link href="/documentos/capacitacion" className="font-semibold">
            Ir a confirmar
          </Link>
        </div>
      ) : null}
    </div>
  );
}
