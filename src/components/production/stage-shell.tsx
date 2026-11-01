import { CircleCheck, CircleX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ProductionAccess } from "@/lib/production/access";
import type { BatchData } from "@/lib/production/batch";
import { STAGE_LABELS } from "@/lib/production/labels";
import { CompleteStageButton, StartStageButton } from "./prep-forms";
import { Card, GmpBlock } from "./ui";

/**
 * Antes de iniciar la etapa: etapa anterior, despeje y limpieza verificados (RF-32, RF-39, AC-04), con el bloqueo que
 * dice la regla y qué hacer. En curso: el registro y, al final, «Completar» con firma.
 */
export function StageShell({
  a,
  data,
  stage,
  children,
  hideComplete,
}: {
  a: ProductionAccess;
  data: BatchData;
  stage: BatchData["stages"][number];
  children: ReactNode;
  hideComplete?: boolean;
}) {
  const label = STAGE_LABELS[stage.stage];
  const clearanceOk = data.clearances.some(
    (c) => c.stage_order_id === stage.id && c.status === "verificado",
  );
  const cleaningOk = data.cleanings.some(
    (c) => c.stage_order_id === stage.id && c.status === "verificado",
  );
  const prev = data.stages.find((s) => s.order_no === stage.order_no - 1);
  const prevOk = !prev || prev.status === "completada";
  const base = `/produccion/lotes/${data.batch.id}`;
  const check = (ok: boolean, text: string, href: string) => (
    <li className="flex min-h-11 items-center gap-3 border-t border-divider text-[15px] first:border-0">
      {ok ? (
        <CircleCheck aria-hidden className="size-5 text-q-ok-ic" />
      ) : (
        <CircleX aria-hidden className="size-5 text-q-bad-ic" />
      )}
      <Link href={href} className="flex-1">
        {text}
      </Link>
      <span className="text-sm text-text-secondary">{ok ? "Listo" : "Pendiente"}</span>
    </li>
  );
  if (stage.status === "pendiente") {
    const ready = prevOk && clearanceOk && cleaningOk;
    return (
      <div
        className="grid grid-cols-[1fr_400px] items-start gap-5 max-[1279px]:grid-cols-1"
        data-testid="stage-shell"
      >
        <Card
          title={`Antes de iniciar ${label.toLowerCase()} · ${stage.code}`}
          subtitle="Pendiente"
        >
          <ul className="grid">
            {prev
              ? check(
                  prevOk,
                  `Etapa anterior (${STAGE_LABELS[prev.stage]}) completada`,
                  `${base}/${prev.stage}`,
                )
              : null}
            {check(
              clearanceOk,
              "Despeje de línea verificado por otra persona",
              `${base}/despeje?etapa=${stage.stage}`,
            )}
            {check(
              cleaningOk,
              "Limpieza de equipos y utensilios verificada",
              `${base}/limpieza?etapa=${stage.stage}`,
            )}
          </ul>
        </Card>
        <aside className="grid gap-3">
          {a.execute ? (
            <StartStageButton batchId={data.batch.id} stageOrderId={stage.id} label={label} />
          ) : null}
          {!ready ? (
            <GmpBlock
              tone="neutral"
              rule={
                !prevOk
                  ? `Primero se completa ${STAGE_LABELS[prev!.stage].toLowerCase()}.`
                  : !clearanceOk
                    ? `No se puede iniciar ${label.toLowerCase()} sin despeje de línea verificado.`
                    : `No se puede iniciar ${label.toLowerCase()} sin la limpieza verificada.`
              }
              action={
                !prevOk
                  ? "Complete la etapa anterior."
                  : !clearanceOk
                    ? "Haga el despeje y pida su verificación."
                    : "Registre y verifique la limpieza."
              }
            />
          ) : null}
        </aside>
      </div>
    );
  }
  return (
    <>
      <span data-testid="stage-shell" className="sr-only">
        {stage.status === "en_curso" ? "En curso" : "Completada"}
      </span>
      {children}
      {stage.status === "en_curso" && a.execute && !hideComplete ? (
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
