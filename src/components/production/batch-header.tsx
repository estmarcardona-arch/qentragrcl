import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/gxp/status-badge";
import type { BatchData } from "@/lib/production/batch";
import { BATCH_STATUS, STAGE_LABELS, STAGE_STATUS } from "@/lib/production/labels";
import { buildTrack } from "@/lib/production/track";
import { CodeChip, ProcessTrack } from "./ui";

/**
 * Encabezado de las pantallas del lote (diseños S-17…S-21): migas, título con el código del lote y el estado, orden y
 * etapa, quién ejecuta y quién verifica, sello del formato congelado, aviso de capacitación y la línea de proceso.
 */
export function BatchHeader({
  data,
  title,
  current,
  stage,
  training,
  subtitle,
}: {
  data: BatchData;
  title: string;
  current?: string;
  stage?: string;
  training?: { blocked: boolean; message: string } | null;
  subtitle?: string;
}) {
  const b = data.batch;
  const so = stage ? data.stages.find((s) => s.stage === stage) : undefined;
  const st = so
    ? (STAGE_STATUS[so.status] ?? STAGE_STATUS.pendiente)
    : (BATCH_STATUS[b.status] ?? BATCH_STATUS.creado);
  const doc = stage
    ? data.order.frozen_documents.find((d) => d.kind === "plantilla" && d.stage === stage)
    : null;
  const track = buildTrack(data);
  return (
    <div className="grid gap-4">
      <nav aria-label="Ruta" className="text-sm text-text-secondary">
        <Link href="/produccion/lotes">Producción</Link> ›{" "}
        <Link href={`/produccion/lotes/${b.id}`} className="font-mono">
          {b.batch_code}
        </Link>
        {current ? ` › ${title}` : ""}
      </nav>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[30px] leading-10 font-semibold">{title}</h1>
            <CodeChip>{b.batch_code}</CodeChip>
            <StatusBadge status={st.status} label={st.label} size="lg" />
          </div>
          <p className="text-sm text-text-secondary">
            {subtitle ??
              `${so?.code ?? data.order.code} · ${data.product.name} · ${Number(b.batch_size).toLocaleString("es-CO")} ${b.batch_unit}${b.expiry_date ? ` · vence ${b.expiry_date.slice(5, 7)}/${b.expiry_date.slice(0, 4)}` : ""}`}
          </p>
        </div>
        <div className="grid justify-items-end gap-1 text-sm">
          <span>
            <b className="font-semibold">Ejecuta:</b> Auxiliar de producción
          </span>
          <span>
            <b className="font-semibold">Verifica:</b> Coordinación o supervisión
          </span>
          {doc ? (
            <span
              className="mt-1 rounded-md border border-border bg-surface-sunken px-2 py-1 font-mono text-xs"
              data-testid="controlled-stamp"
            >
              {doc.code} · v{String(doc.version_no).padStart(2, "0")} · Vigente
            </span>
          ) : null}
        </div>
      </header>
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
      <div className="rounded-[10px] border border-border bg-surface px-4 py-3">
        <ProcessTrack nodes={track.nodes} compact />
        <span className="sr-only">Etapa actual: {current ? STAGE_LABELS[current] : "—"}</span>
      </div>
    </div>
  );
}
