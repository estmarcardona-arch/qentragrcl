import type { Metadata } from "next";
import Link from "next/link";
import { NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { BatchHeader } from "@/components/production/batch-header";
import { formatNumber } from "@/lib/format";
import { STAGE_LABELS, STAGE_STATUS } from "@/lib/production/labels";
import { batchPage } from "@/lib/production/page";

export const metadata: Metadata = { title: "Lote de producción · GRUFARCOL eBR" };

// Lote: etapas con su estado y prealistamiento, rendimientos y documentos de la orden (RF-31).
export default async function BatchPage({ params }: PageProps<"/produccion/lotes/[id]">) {
  const { id } = await params;
  const p = await batchPage(id);
  if (!p) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a Producción" />
      </main>
    );
  }
  const { data } = p;
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <BatchHeader data={data} title="Lote" />
      {data.order.status === "borrador" ? (
        <p
          role="status"
          className="rounded-lg border border-border bg-surface-sunken px-3.5 py-2.5 text-sm"
        >
          La orden {data.order.code} está en borrador: las etapas se generan al aprobarla.{" "}
          <Link href={`/produccion/ordenes/${data.order.id}/documentos`} className="font-semibold">
            Ver la orden
          </Link>
        </p>
      ) : null}
      <div className="grid grid-cols-4 gap-3 max-[1279px]:grid-cols-2" data-testid="stage-cards">
        {data.stages.map((s) => {
          const st = STAGE_STATUS[s.status] ?? STAGE_STATUS.pendiente;
          const outs = data.outputs.filter((o) => o.stage_order_id === s.id);
          return (
            <Link
              key={s.id}
              href={`/produccion/lotes/${id}/${s.stage}`}
              className="grid content-start gap-2 rounded-[10px] border border-border bg-surface p-4 no-underline"
              data-stage={s.stage}
            >
              <span className="text-card-title text-foreground">{STAGE_LABELS[s.stage]}</span>
              <span className="font-mono text-xs text-text-secondary">{s.code}</span>
              <StatusBadge status={st.status} label={st.label} />
              {outs.map((o) => (
                <span key={o.id} className="text-sm text-foreground">
                  {o.presentation_id
                    ? (data.order.presentations.find((x) => x.presentation_id === o.presentation_id)
                        ?.name ?? "") + ": "
                    : "Granel: "}
                  {formatNumber(Number(o.pct), 1)} %
                </span>
              ))}
            </Link>
          );
        })}
      </div>
      <p className="text-sm">
        <Link href={`/produccion/ordenes/${data.order.id}/documentos`} className="font-semibold">
          Documentos de la orden {data.order.code}
        </Link>
      </p>
    </main>
  );
}
