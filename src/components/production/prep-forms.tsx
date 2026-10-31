"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field, selectCls } from "@/components/equipment/equipment-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  completeStage,
  executeClearance,
  recordCleaning,
  startStage,
  verifyCleaningRecord,
  verifyClearance,
  verifyDispensing,
  verifyStep,
  type PrResult,
} from "@/lib/production/actions";
import { ResultError, SignedAction, type Summary } from "./signed-action";

/** S-17 · Lista de despeje: todos los puntos conformes para firmar («Ejecuté»). */
export function ClearanceForm({
  batchId,
  stageOrderId,
  stageLabel,
  items,
  signer,
}: {
  batchId: string;
  stageOrderId: string;
  stageLabel: string;
  items: string[];
  signer: string;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const all = items.every((i) => checks[i]);
  return (
    <div className="grid gap-3">
      <ul className="grid gap-2" data-testid="clearance-items">
        {items.map((i) => (
          <li key={i}>
            <label className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-white px-3 text-[15px]">
              <input
                type="checkbox"
                className="size-6"
                checked={Boolean(checks[i])}
                onChange={(e) => setChecks((c) => ({ ...c, [i]: e.target.checked }))}
              />
              {i}
            </label>
          </li>
        ))}
      </ul>
      <div>
        <SignedAction
          label="Firmar despeje"
          title={`Despeje de línea · ${stageLabel}`}
          meaning="Ejecuté"
          summary={[{ label: "Puntos", value: `${items.length} de ${items.length} conformes` }]}
          signer={signer}
          disabled={!all}
          run={(pw) =>
            executeClearance(
              batchId,
              stageOrderId,
              items.map((i) => ({ item: i, ok: true })),
              pw,
            )
          }
          testId="sign-clearance"
        />
      </div>
      {!all ? (
        <p className="text-sm text-text-secondary">
          Marque todos los puntos; uno no conforme se corrige antes de firmar.
        </p>
      ) : null}
    </div>
  );
}

const VERIFY = {
  clearance: verifyClearance,
  cleaning: verifyCleaningRecord,
  dispensing: verifyDispensing,
  step: verifyStep,
} as const;

/** Verificación por otra persona: «Verifiqué». Quien ejecutó no verifica (SOD-1, SOD-4). */
export function VerifyButton({
  kind,
  batchId,
  recordId,
  label,
  title,
  summary,
  signer,
  testId,
}: {
  kind: keyof typeof VERIFY;
  batchId: string;
  recordId: string;
  label: string;
  title: string;
  summary: Summary;
  signer: string;
  testId?: string;
}) {
  return (
    <SignedAction
      label={label}
      title={title}
      meaning="Verifiqué"
      summary={summary}
      signer={signer}
      confirmLabel="Firmar verificación"
      variant="secondary"
      run={(pw) => VERIFY[kind](batchId, recordId, pw)}
      testId={testId}
    />
  );
}

/** S-39 · Registro de limpieza de un equipo o de utensilios, con rótulo verificado y vigencia (RF-39). */
export function CleaningForm({
  batchId,
  stageOrderId,
  stageLabel,
  equipment,
  signer,
}: {
  batchId: string;
  stageOrderId: string;
  stageLabel: string;
  equipment: { id: string; code: string; name: string }[];
  signer: string;
}) {
  const [eq, setEq] = useState("");
  const [utensils, setUtensils] = useState("");
  const [until, setUntil] = useState("");
  const [label, setLabel] = useState(false);
  const eqCode = equipment.find((e) => e.id === eq)?.code;
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-3 max-[1023px]:grid-cols-1">
        <Field id="cl-eq" label="Equipo">
          <select
            id="cl-eq"
            value={eq}
            onChange={(e) => setEq(e.target.value)}
            className={`${selectCls} h-12`}
          >
            <option value="">Solo utensilios</option>
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} · {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="cl-ut" label="Utensilios" hint="Separados por coma">
          <Input
            id="cl-ut"
            className="h-12"
            value={utensils}
            onChange={(e) => setUtensils(e.target.value)}
            placeholder="Palas de acero, recipientes de acero"
          />
        </Field>
        <Field id="cl-until" label="Vigente hasta *" hint="Hora de Bogotá">
          <Input
            id="cl-until"
            type="datetime-local"
            className="h-12"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </Field>
      </div>
      <label className="flex min-h-12 items-center gap-3 text-[15px]">
        <input
          type="checkbox"
          className="size-6"
          checked={label}
          onChange={(e) => setLabel(e.target.checked)}
        />
        Rótulo de limpieza colocado y verificado
      </label>
      <div>
        <SignedAction
          label="Registrar limpieza"
          title={`Limpieza · ${stageLabel}`}
          meaning="Ejecuté"
          summary={[
            { label: "Equipo", value: eqCode ?? "Sin equipo", mono: true },
            { label: "Utensilios", value: utensils || "—" },
          ]}
          signer={signer}
          validate={() =>
            !label
              ? "Confirme que el rótulo de limpieza está colocado y verificado."
              : !until
                ? "Indique hasta cuándo es vigente la limpieza."
                : !eq && !utensils.trim()
                  ? "Indique el equipo o los utensilios limpiados."
                  : null
          }
          run={(pw) =>
            recordCleaning(
              batchId,
              stageOrderId,
              eq || null,
              {
                valid_until: `${until}:00-05:00`,
                utensils: utensils
                  .split(",")
                  .map((u) => u.trim())
                  .filter(Boolean),
                label_verified: label,
              },
              pw,
            )
          }
          testId="sign-cleaning"
        />
      </div>
    </div>
  );
}

/** Inicia la etapa: la base exige despeje y limpieza verificados (CLEARANCE_MISSING, AC-04). */
export function StartStageButton({
  batchId,
  stageOrderId,
  label,
}: {
  batchId: string;
  stageOrderId: string;
  label: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<Exclude<PrResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2">
      <div>
        <Button
          type="button"
          size="lg"
          className="min-h-12 px-5 text-[15px]"
          disabled={pending}
          data-testid="start-stage"
          onClick={() =>
            start(async () => {
              const res = await startStage(batchId, stageOrderId);
              if (!res.ok) return setError(res);
              setError(null);
              router.refresh();
            })
          }
        >
          Iniciar {label.toLowerCase()}
        </Button>
      </div>
      <ResultError error={error} />
    </div>
  );
}

export function CompleteStageButton({
  batchId,
  stageOrderId,
  code,
  label,
  signer,
}: {
  batchId: string;
  stageOrderId: string;
  code: string;
  label: string;
  signer: string;
}) {
  return (
    <SignedAction
      label={`Completar ${label.toLowerCase()}`}
      title={`Completar ${code}`}
      meaning="Ejecuté"
      summary={[{ label: "Etapa", value: `${label} · ${code}` }]}
      signer={signer}
      confirmLabel="Firmar cierre de etapa"
      run={(pw) => completeStage(batchId, stageOrderId, pw)}
      testId="complete-stage"
    />
  );
}
