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
import { StatusBadge } from "@/components/gxp/status-badge";
import { ResultError, SignedAction, type Summary } from "./signed-action";
import { EquipmentTable, GmpBlock, type EquipmentRow } from "./ui";
import { useHydrated } from "./use-hydrated";

/**
 * S-17 · Lista de despeje (diseño «Producción S-15 a S-17»): cada punto con su estado; el punto de equipos muestra la
 * vigencia de calibración, mantenimiento y limpieza. Un equipo no apto bloquea la firma («Ejecuté»).
 */
export function ClearanceForm({
  batchId,
  stageOrderId,
  stageLabel,
  items,
  equipment,
  now,
  signer,
}: {
  batchId: string;
  stageOrderId: string;
  stageLabel: string;
  items: string[];
  equipment: EquipmentRow[];
  now: string;
  signer: string;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const all = items.every((i) => checks[i]);
  // Bloquean el despeje los problemas que la limpieza no resuelve (calibración, mantenimiento, calificación, estado);
  // la limpieza vencida se resuelve en S-39 antes de iniciar la etapa.
  const invalid = equipment.filter((e) => !e.valid && e.reasons.some((r) => !/limpieza/i.test(r)));
  const cleaningDue = equipment.filter(
    (e) => !e.valid && e.reasons.every((r) => /limpieza/i.test(r)),
  );
  const isEquipmentItem = (i: string) => /equipo/i.test(i);
  return (
    <div className="grid gap-4">
      <ul
        className="grid divide-y divide-divider rounded-[10px] border border-border"
        data-testid="clearance-items"
      >
        {items.map((i) => {
          const blocking = isEquipmentItem(i) && invalid.length > 0;
          return (
            <li key={i} className="grid gap-3 px-4 py-3">
              <label className="flex min-h-11 items-center gap-3 text-[15px]">
                <input
                  type="checkbox"
                  className="size-6 accent-primary"
                  checked={Boolean(checks[i])}
                  disabled={blocking}
                  onChange={(e) => setChecks((c) => ({ ...c, [i]: e.target.checked }))}
                />
                <span className="flex-1">{i}</span>
                <StatusBadge
                  status={blocking ? "bloqueada" : checks[i] ? "completada" : "pendiente"}
                  label={blocking ? "Bloqueante" : checks[i] ? "Completada" : "Sin marcar"}
                />
              </label>
              {isEquipmentItem(i) && equipment.length ? (
                <EquipmentTable rows={equipment} now={now} />
              ) : null}
            </li>
          );
        })}
      </ul>
      {cleaningDue.length ? (
        <p
          role="status"
          className="rounded-md border border-q-warn-bd bg-q-warn-bg px-3 py-2 text-sm text-q-warn-fg"
        >
          {cleaningDue.map((e) => e.code).join(", ")}: limpieza vencida. Regístrela y verifíquela en
          «Limpieza de equipos y utensilios» antes de iniciar la etapa.
        </p>
      ) : null}
      {invalid.length ? (
        <GmpBlock
          rule={`${invalid.map((e) => `${e.code}: ${e.reasons.join("; ")}`).join(" · ")}.`}
          action="Registre la limpieza o la calibración en la hoja de vida, abra una desviación (F8) o use otro equipo."
          testId="clearance-blocked"
        />
      ) : null}
      <div className="grid gap-1.5">
        <SignedAction
          label="Firmar ejecución"
          title={`Despeje de línea · ${stageLabel}`}
          meaning="Ejecuté"
          summary={[
            { label: "Ítems cumplidos", value: `${items.length} de ${items.length}` },
            ...(equipment.length
              ? [{ label: "Equipos", value: equipment.map((e) => e.code).join(", "), mono: true }]
              : []),
          ]}
          signer={signer}
          disabled={!all || invalid.length > 0}
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
        {!all ? (
          <p className="text-sm text-text-secondary">
            Marque todos los puntos; uno no conforme se corrige antes de firmar.
          </p>
        ) : null}
      </div>
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
  const hydrated = useHydrated();
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
          data-ready={hydrated}
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

/** S-39 · Verifica de una vez las limpiezas pendientes con una sola firma «Verifiqué» (cada registro queda firmado). */
export function VerifyCleaningsButton({
  batchId,
  ids,
  stageLabel,
  executedBy,
  signer,
}: {
  batchId: string;
  ids: string[];
  stageLabel: string;
  executedBy: string;
  signer: string;
}) {
  return (
    <SignedAction
      label="Verificar limpieza y firmar"
      title={`Verificar limpieza · ${stageLabel}`}
      meaning="Verifiqué"
      summary={[
        { label: "Registros", value: String(ids.length) },
        { label: "Limpió", value: executedBy },
      ]}
      signer={signer}
      confirmLabel="Firmar verificación"
      run={async (pw) => {
        for (const id of ids) {
          const res = await verifyCleaningRecord(batchId, id, pw);
          if (!res.ok) return res;
        }
        return { ok: true, data: {} };
      }}
      testId="verify-cleaning"
    />
  );
}
