import { Check, Lock } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { STAGE_LABELS } from "@/lib/production/labels";

type StageLite = { id: string; stage: string; status: string };

/**
 * Línea de proceso del lote (S-16): Despeje → Dispensación → Fabricación → Envase → Acondicionamiento. Completada con
 * marca, actual resaltada y las siguientes bloqueadas (no se inicia sin la anterior ni sin despeje, AC-04).
 */
export function ProcessLine({
  batchId,
  stages,
  current,
}: {
  batchId: string;
  stages: StageLite[];
  current?: string;
}) {
  const active = stages.find((s) => s.status !== "completada");
  const nodes = [
    {
      key: "despeje",
      label: STAGE_LABELS.despeje,
      state: active ? "actual-soft" : "completada",
      href: active ? `/produccion/lotes/${batchId}/despeje?etapa=${active.stage}` : null,
    },
    ...stages.map((s) => ({
      key: s.stage,
      label: STAGE_LABELS[s.stage],
      state:
        s.status === "completada" ? "completada" : s.id === active?.id ? "actual" : "bloqueada",
      href: `/produccion/lotes/${batchId}/${s.stage}`,
    })),
  ];
  return (
    <ol
      className="flex flex-wrap items-center gap-2"
      aria-label="Línea de proceso del lote"
      data-testid="process-line"
    >
      {nodes.map((n, i) => (
        <li key={n.key} className="flex items-center gap-2" data-state={n.state}>
          {i > 0 ? <span aria-hidden className="h-px w-5 bg-border-control" /> : null}
          {n.href ? (
            <Link
              href={n.href}
              aria-current={current === n.key ? "step" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold no-underline",
                n.state === "completada" && "border-q-ok-bd bg-q-ok-bg text-q-ok-fg",
                (n.state === "actual" || n.state === "actual-soft") &&
                  "border-primary bg-primary text-white",
                n.state === "bloqueada" && "border-border bg-surface-sunken text-text-secondary",
                current === n.key && "ring-2 ring-primary ring-offset-2",
              )}
            >
              {n.state === "completada" ? <Check aria-hidden className="size-4" /> : null}
              {n.state === "bloqueada" ? <Lock aria-hidden className="size-3.5" /> : null}
              {n.label}
              <span className="sr-only">
                {n.state === "completada"
                  ? " (completada)"
                  : n.state === "bloqueada"
                    ? " (bloqueada)"
                    : " (actual)"}
              </span>
            </Link>
          ) : (
            <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-q-ok-bd bg-q-ok-bg px-3 text-[13px] font-semibold text-q-ok-fg">
              <Check aria-hidden className="size-4" />
              {n.label}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
