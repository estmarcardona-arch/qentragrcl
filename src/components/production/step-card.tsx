"use client";

import { CircleX, CloudOff, Save } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { Field } from "@/components/equipment/equipment-form";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { completeStep } from "@/lib/production/actions";
import { formatTime } from "@/lib/format";
import { SignedAction } from "./signed-action";
import { useDraftQueue } from "./use-draft-queue";

export type StepParam = {
  name: string;
  unit?: string;
  min?: number | null;
  max?: number | null;
  frequency?: string;
};
export type EquipmentState = { id: string; code: string; valid: boolean; reasons: string[] };

const num = (v: string) => Number(v.replace(",", "."));

/**
 * Paso actual del registro (S-19…S-21): texto del instructivo, parámetros con rango y unidad (fuera de rango se marca con
 * ícono y texto y exige desviación), equipos con su vigencia y firma «Ejecuté». Cada campo se guarda como borrador.
 */
export function StepCard({
  batchId,
  stageOrderId,
  presentationId,
  step,
  equipment,
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
  equipment: EquipmentState[];
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
  const [notes, setNotes] = useState(values.__notes ?? "");
  const out = step.params.filter((p) => {
    const v = values[p.name];
    if (v === undefined || v === "") return false;
    const n = num(v);
    return (p.min != null && n < p.min) || (p.max != null && n > p.max);
  });
  return (
    <section
      className="grid gap-4 rounded-[10px] border border-primary bg-surface p-5"
      aria-labelledby={`step-${step.step_key}`}
      data-testid="current-step"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={`step-${step.step_key}`} className="text-[17px] font-semibold">
          Paso {step.label} · {step.text}
        </h3>
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
          ) : null}
        </span>
      </div>
      {step.params.length ? (
        <div className="grid grid-cols-3 gap-3 max-[1023px]:grid-cols-1">
          {step.params.map((p) => {
            const bad = out.includes(p);
            return (
              <Field
                key={p.name}
                id={`v-${step.step_key}-${p.name}`}
                label={`${p.name}${p.unit ? ` (${p.unit})` : ""} *`}
                hint={
                  p.min != null || p.max != null
                    ? `Rango ${p.min ?? "—"}–${p.max ?? "—"} ${p.unit ?? ""}`
                    : undefined
                }
              >
                <Input
                  id={`v-${step.step_key}-${p.name}`}
                  inputMode="decimal"
                  aria-invalid={bad}
                  className={cn("h-12 font-mono text-[16px]", bad && "border-q-bad-bd")}
                  value={values[p.name] ?? ""}
                  onChange={(e) => setField(p.name, e.target.value)}
                />
              </Field>
            );
          })}
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
          {values[p.name]} {p.unit} está fuera del rango {p.min}–{p.max} {p.unit}. Debe abrir una
          desviación para continuar (Desviaciones y CAPA, F8): el paso queda marcado y la etapa no
          se cierra sin ella.
        </p>
      ))}
      {required.length ? (
        <div className="grid gap-1.5">
          <span className="text-label uppercase">Equipos del paso</span>
          <ul className="flex flex-wrap gap-2">
            {used.map((e) => (
              <li key={e.id}>
                <StatusBadge
                  status={e.valid ? "vigente" : "vencido"}
                  label={`${e.code} · ${e.valid ? "apto" : "no apto"}`}
                />
              </li>
            ))}
            {missingEq.map((c) => (
              <li key={c}>
                <StatusBadge status="sin_dato" label={`${c} · no registrado`} />
              </li>
            ))}
          </ul>
          {invalid.map((e) => (
            <p
              key={e.id}
              role="alert"
              className="text-sm text-q-bad-fg"
              data-testid="equipment-not-valid"
            >
              {e.code} no puede usarse: {e.reasons.join("; ")}. Registre la limpieza o la
              calibración, o use otro equipo.
            </p>
          ))}
        </div>
      ) : null}
      <Field id={`n-${step.step_key}`} label="Observaciones">
        <Textarea
          id={`n-${step.step_key}`}
          rows={2}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setField("__notes", e.target.value);
          }}
        />
      </Field>
      <div>
        <SignedAction
          label="Completar paso"
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
                notes,
              },
              pw,
            );
            if (res.ok) clear();
            return res;
          }}
          testId="complete-step"
        />
      </div>
    </section>
  );
}
