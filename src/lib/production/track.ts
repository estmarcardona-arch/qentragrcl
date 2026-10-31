import type { LineNode } from "@/components/production/ui";
import { formatDateTime } from "@/lib/format";
import type { BatchData } from "./batch";
import { STAGE_LABELS } from "./labels";

/** Línea de proceso del lote (S-16) con el estado, el detalle y el motivo de bloqueo de cada etapa. */
export function buildTrack(data: BatchData): {
  nodes: LineNode[];
  current: BatchData["stages"][number] | undefined;
  progress: Record<string, { done: number; total: number }>;
  next: { stage: BatchData["stages"][number]; clearanceOk: boolean; cleaningOk: boolean } | null;
} {
  const id = data.batch.id;
  const current = data.stages.find((s) => s.status !== "completada");
  const progress: Record<string, { done: number; total: number }> = {};
  for (const s of data.stages) {
    const steps = data.stageSteps[s.id] ?? [];
    const presCount =
      s.stage === "envase" || s.stage === "acondicionamiento"
        ? Math.max(data.order.presentations.length, 1)
        : 1;
    progress[s.id] = {
      done: data.steps.filter((r) => r.stage_order_id === s.id).length,
      total: steps.length * presCount,
    };
  }
  const ready = (s: BatchData["stages"][number]) => ({
    clearanceOk: data.clearances.some(
      (c) => c.stage_order_id === s.id && c.status === "verificado",
    ),
    cleaningOk: data.cleanings.some((c) => c.stage_order_id === s.id && c.status === "verificado"),
  });
  const currentClearance = current
    ? data.clearances.find((c) => c.stage_order_id === current.id)
    : undefined;
  const despeje: LineNode = !current
    ? {
        key: "despeje",
        label: "Despeje",
        state: "completada",
        chip: "Completado",
        detail: "Todas las áreas",
      }
    : currentClearance?.status === "verificado"
      ? {
          key: "despeje",
          label: "Despeje",
          state: "completada",
          chip: "Completado",
          detail: `Completado ${formatDateTime(String(currentClearance.verified_at))}`,
          href: `/produccion/lotes/${id}/despeje?etapa=${current.stage}`,
        }
      : {
          key: "despeje",
          label: "Despeje",
          state: "actual",
          chip: currentClearance ? "Por verificar" : "Pendiente",
          detail: `Despeje de ${STAGE_LABELS[current.stage].toLowerCase()}`,
          href: `/produccion/lotes/${id}/despeje?etapa=${current.stage}`,
        };
  const nodes: LineNode[] = [
    despeje,
    ...data.stages.map((s): LineNode => {
      const p = progress[s.id];
      if (s.status === "completada") {
        return {
          key: s.stage,
          label: STAGE_LABELS[s.stage],
          state: "completada",
          chip: "Completada",
          detail: s.completed_at ? `Completada ${formatDateTime(s.completed_at)}` : undefined,
          href: `/produccion/lotes/${id}/${s.stage}`,
        };
      }
      if (s.status === "en_curso") {
        return {
          key: s.stage,
          label: STAGE_LABELS[s.stage],
          state: "actual",
          chip: "En curso",
          detail: p.total ? `Paso ${Math.min(p.done + 1, p.total)} de ${p.total}` : "En curso",
          href: `/produccion/lotes/${id}/${s.stage}`,
        };
      }
      const r = ready(s);
      return {
        key: s.stage,
        label: STAGE_LABELS[s.stage],
        state: s.id === current?.id && r.clearanceOk && r.cleaningOk ? "pendiente" : "bloqueada",
        chip: s.id === current?.id && r.clearanceOk && r.cleaningOk ? "Lista" : "Bloqueada",
        detail: !r.clearanceOk
          ? "Falta el despeje de línea verificado"
          : !r.cleaningOk
            ? "Falta la limpieza verificada"
            : s.id === current?.id
              ? "Lista para iniciar"
              : "Falta la etapa anterior",
        href: `/produccion/lotes/${id}/${s.stage}`,
      };
    }),
  ];
  const nextStage = data.stages.find((s) => s.status === "pendiente");
  return {
    nodes,
    current,
    progress,
    next: nextStage ? { stage: nextStage, ...ready(nextStage) } : null,
  };
}
