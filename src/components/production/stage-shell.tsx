import { CircleCheck, CircleX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/gxp/status-badge";
import type { ProductionAccess } from "@/lib/production/access";
import type { BatchData } from "@/lib/production/batch";
import { STAGE_LABELS, STAGE_STATUS } from "@/lib/production/labels";
import { CompleteStageButton, StartStageButton } from "./prep-forms";

/** Estado del prealistamiento de la etapa y acciones de inicio y cierre (RF-32, RF-39, AC-04). */
export function StageShell({
  a,
  data,
  stage,
  children,
}: {
  a: ProductionAccess;
  data: BatchData;
  stage: BatchData["stages"][number];
  children: ReactNode;
}) {
  const label = STAGE_LABELS[stage.stage];
  const clearance = data.clearances.find((c) => c.stage_order_id === stage.id);
  const cleanings = data.cleanings.filter((c) => c.stage_order_id === stage.id);
  const clearanceOk = clearance?.status === "verificado";
  const cleaningOk = cleanings.some((c) => c.status === "verificado");
  const prev = data.stages.find((s) => s.order_no === stage.order_no - 1);
  const st = STAGE_STATUS[stage.status] ?? STAGE_STATUS.pendiente;
  const check = (ok: boolean, text: string, href: string) => (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <CircleCheck aria-hidden className="size-4 text-q-ok-ic" />
      ) : (
        <CircleX aria-hidden className="size-4 text-q-bad-ic" />
      )}
      <Link href={href}>{text}</Link>
      <span className="sr-only">{ok ? "(listo)" : "(pendiente)"}</span>
    </li>
  );
  return (
    <>
      <section
        className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
        aria-labelledby="prep"
        data-testid="stage-shell"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="prep" className="text-card-title">
            {label} · {stage.code}
          </h2>
          <StatusBadge status={st.status} label={st.label} />
        </div>
        {stage.status === "pendiente" ? (
          <>
            <ul className="grid gap-1.5">
              {prev
                ? check(
                    prev.status === "completada",
                    `Etapa anterior (${STAGE_LABELS[prev.stage]}) completada`,
                    `/produccion/lotes/${data.batch.id}/${prev.stage}`,
                  )
                : null}
              {check(
                clearanceOk,
                "Despeje de línea verificado por otra persona",
                `/produccion/lotes/${data.batch.id}/despeje?etapa=${stage.stage}`,
              )}
              {check(
                cleaningOk,
                "Limpieza de equipos y utensilios verificada",
                `/produccion/lotes/${data.batch.id}/limpieza?etapa=${stage.stage}`,
              )}
            </ul>
            {a.execute ? (
              <StartStageButton batchId={data.batch.id} stageOrderId={stage.id} label={label} />
            ) : null}
          </>
        ) : null}
      </section>
      {stage.status !== "pendiente" ? children : null}
      {stage.status === "en_curso" && a.execute ? (
        <div className="flex justify-end">
          <CompleteStageButton
            batchId={data.batch.id}
            stageOrderId={stage.id}
            code={stage.code}
            label={label}
            signer={a.signer}
          />
        </div>
      ) : null}
    </>
  );
}
