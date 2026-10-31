"use client";

import { CircleCheck, CircleX, CloudOff, FileText, Minus, Play, Plus, Save } from "lucide-react";
import { cn } from "cn";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeStep } from "@/lib/production/actions";
import { formatTime } from "@/lib/format";
import { SignedAction } from "./signed-action";
import { EquipmentTable, Seals, type EquipmentRow } from "./ui";
import { useDraftQueue } from "./use-draft-queue";

export type StepParam = {
  name: string;
  unit?: string;
  min?: number | null;
  max?: number | null;
  frequency?: string;
};
export type EquipmentState = EquipmentRow;

const num = (v: string) => Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
const show = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
// Paso de los botones − / + según la unidad del parámetro.
const stepOf = (unit?: string) =>
  unit === "rpm" ? 50 : unit === "kg" ? 1 : unit === "min" ? 1 : unit === "°C" ? 0.5 : 0.1;

/**
 * Paso actual del registro (diseño «Registros S-19 a S-21»): texto del instructivo, equipos usados con su vigencia,
 * parámetros con rango, valor y estado (fuera de rango con ícono y texto: exige desviación), observaciones, sellos y
 * firma «Ejecuté». Cada campo se guarda como borrador con la hora del servidor.
 */
export function StepCard({
  batchId,
  stageOrderId,
  presentationId,
  step,
  position,
  total,
  instruction,
  equipment,
  now,
  draft,
  signer,
}: {
  batchId: string;
  stageOrderId: string;
  presentationId: string | null;
  step: {
    step_key: string;
    label: string;
    text: string;
    params: StepParam[];
    requires_equipment: string | null;
    requires_verification: boolean;
  };
  position: number;
  total: number;
  instruction: string | null;
  equipment: EquipmentState[];
  now: string;
  draft: Record<string, string>;
  signer: string;
}) {
  const { values, setField, status, clear } = useDraftQueue(
    { stageOrderId, stepKey: step.step_key, presentationId },
    draft,
  );
  const required = (step.requires_equipment ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const used = equipment.filter((e) => required.includes(e.code));
  const invalid = used.filter((e) => !e.valid);
  const missingEq = required.filter((c) => !equipment.some((e) => e.code === c));
  const isOut = (p: StepParam) => {
    const v = values[p.name];
    if (v === undefined || v === "") return false;
    const n = num(v);
    return (p.min != null && n < p.min) || (p.max != null && n > p.max);
  };
  const out = step.params.filter(isOut);
  return (
    <section
      className="grid overflow-hidden rounded-[10px] border-2 border-primary bg-surface"
      aria-labelledby={`step-${step.step_key}`}
      data-testid="current-step"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <span className="text-label text-text-secondary uppercase">
            Paso {position} de {total}
          </span>
          <h3 id={`step-${step.step_key}`} className="text-[20px] leading-7 font-semibold">
            {step.text}
          </h3>
        </div>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary bg-primary-soft px-3 text-sm font-semibold text-primary">
          <Play aria-hidden className="size-4" /> En curso
        </span>
      </header>
      {instruction ? (
        <p className="mx-5 mt-3 flex items-start gap-2 rounded-md bg-surface-sunken px-3 py-2.5 text-sm">
          <FileText aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            <b className="font-semibold">Instructivo {instruction}:</b> {step.text}.
          </span>
        </p>
      ) : null}
      <div className="grid gap-5 px-5 py-4">
        {required.length ? (
          <div className="grid gap-2">
            <b className="text-[15px] font-semibold">Equipos usados</b>
            {used.length ? <EquipmentTable rows={used} now={now} /> : null}
            {missingEq.map((c) => (
              <p key={c} className="text-sm text-q-bad-fg">
                {c} no está registrado en Equipos.
              </p>
            ))}
            {invalid.map((e) => (
              <p
                key={e.id}
                role="alert"
                className="flex items-start gap-1.5 text-sm font-medium text-q-bad-fg"
                data-testid="equipment-not-valid"
              >
                <CircleX aria-hidden className="mt-0.5 size-4" /> {e.code} no puede usarse:{" "}
                {e.reasons.join("; ")}. Registre la limpieza o la calibración, o use otro equipo.
              </p>
            ))}
          </div>
        ) : null}
        {step.params.length ? (
          <div className="grid gap-2">
            <b className="text-[15px] font-semibold">Parámetros a registrar</b>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-sunken">
                  <tr>
                    {["Parámetro", "Rango permitido", "Valor registrado", "Estado"].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 text-label uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {step.params.map((p) => {
                    const v = values[p.name] ?? "";
                    const bad = isOut(p);
                    const id = `v-${step.step_key}-${p.name}`;
                    return (
                      <tr
                        key={p.name}
                        className="border-t border-divider"
                        data-param={p.name}
                        data-min={p.min ?? ""}
                        data-max={p.max ?? ""}
                      >
                        <td className="px-3 py-3">
                          <label htmlFor={id} className="font-semibold">
                            {p.name}
                          </label>
                        </td>
                        <td className="px-3 py-3 font-mono text-[13px]">
                          {p.min != null || p.max != null
                            ? `${show(p.min ?? 0)}${p.max !== p.min ? ` – ${show(p.max ?? 0)}` : ""} ${p.unit ?? ""}`
                            : "Sin rango"}
                        </td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon-lg"
                              aria-label={`Bajar ${p.name}`}
                              onClick={() =>
                                setField(
                                  p.name,
                                  String(
                                    Math.round(((num(v) || p.min || 0) - stepOf(p.unit)) * 100) /
                                      100,
                                  ),
                                )
                              }
                            >
                              <Minus aria-hidden />
                            </Button>
                            <Input
                              id={id}
                              inputMode="decimal"
                              aria-invalid={bad}
                              className={cn(
                                "h-11 w-32 text-right font-mono text-[16px]",
                                bad && "border-q-bad-bd",
                              )}
                              value={v}
                              onChange={(e) => setField(p.name, e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon-lg"
                              aria-label={`Subir ${p.name}`}
                              onClick={() =>
                                setField(
                                  p.name,
                                  String(
                                    Math.round(((num(v) || p.min || 0) + stepOf(p.unit)) * 100) /
                                      100,
                                  ),
                                )
                              }
                            >
                              <Plus aria-hidden />
                            </Button>
                            <span className="text-sm text-text-secondary">{p.unit}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {v === "" ? (
                            <StatusBadge status="sin_dato" label="Sin dato" />
                          ) : bad ? (
                            <StatusBadge status="vencido" label="Fuera de rango" />
                          ) : (
                            <StatusBadge status="vigente" label="En rango" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {out.map((p) => (
          <p
            key={p.name}
            role="alert"
            className="flex items-start gap-1.5 rounded-md border border-q-bad-bd bg-q-bad-bg px-3 py-2 text-sm text-q-bad-fg"
            data-testid="out-of-range"
          >
            <CircleX aria-hidden className="mt-0.5 size-4" />
            {values[p.name]} {p.unit} está fuera del rango {show(p.min ?? 0)}–{show(p.max ?? 0)}{" "}
            {p.unit}. Debe abrir una desviación para continuar (Desviaciones y CAPA, F8): el paso
            queda marcado y la etapa no se cierra sin ella.
          </p>
        ))}
        <label className="grid gap-1.5 text-sm font-medium">
          Observaciones
          <Input
            placeholder="Sin observaciones"
            className="h-11"
            value={values.__notes ?? ""}
            onChange={(e) => setField("__notes", e.target.value)}
          />
        </label>
      </div>
      <footer className="grid grid-cols-[1fr_auto] items-end gap-4 border-t border-divider bg-surface-sunken/50 px-5 py-4 max-[1023px]:grid-cols-1">
        <div className="grid gap-2">
          <Seals />
          <span
            className="flex items-center gap-1.5 text-xs text-text-secondary"
            role="status"
            data-testid="draft-status"
          >
            {status.kind === "queued" ? (
              <>
                <CloudOff aria-hidden className="size-3.5 text-q-warn-fg" /> Sin conexión:{" "}
                {status.pending} cambio(s) en cola; se reintenta solo
              </>
            ) : status.kind === "saved" ? (
              <>
                <Save aria-hidden className="size-3.5" /> Borrador guardado {formatTime(status.at)}{" "}
                (hora del servidor)
              </>
            ) : status.kind === "saving" ? (
              "Guardando borrador…"
            ) : (
              <>
                <CircleCheck aria-hidden className="size-3.5" /> Cada campo se guarda solo como
                borrador
              </>
            )}
          </span>
        </div>
        <div className="grid justify-items-end gap-1.5">
          <SignedAction
            label="Completar paso · firma «Ejecuté»"
            title={`Completar paso ${step.label}`}
            meaning="Ejecuté"
            summary={[
              { label: "Paso", value: `${step.label} · ${step.text}` },
              ...step.params.map((p) => ({
                label: p.name,
                value: `${values[p.name] ?? "—"} ${p.unit ?? ""}`,
                mono: true,
              })),
              ...(used.length
                ? [{ label: "Equipos", value: used.map((e) => e.code).join(", "), mono: true }]
                : []),
            ]}
            signer={signer}
            validate={() => {
              const empty = step.params.find((p) => !values[p.name]);
              return empty ? `Registre «${empty.name}».` : null;
            }}
            run={async (pw) => {
              const res = await completeStep(
                batchId,
                {
                  stageOrderId,
                  stepKey: step.step_key,
                  presentationId,
                  values: Object.fromEntries(
                    step.params.map((p) => [p.name, num(values[p.name] ?? "")]),
                  ),
                  equipment: used.map((e) => e.id),
                  notes: values.__notes ?? "",
                },
                pw,
              );
              if (res.ok) clear();
              return res;
            }}
            testId="complete-step"
          />
          <span className="text-xs text-text-secondary">
            {step.requires_verification
              ? "Después verifica la coordinación de producción."
              : "Al completar se abre la firma con el significado «Ejecuté»."}
          </span>
        </div>
      </footer>
    </section>
  );
}
