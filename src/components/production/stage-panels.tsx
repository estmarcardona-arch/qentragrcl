"use client";

import { CircleX, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Field } from "@/components/equipment/equipment-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  correctRecord,
  recordInspection,
  recordOutput,
  recordReturn,
  recordWeight,
  verifyCoding,
  type PrResult,
} from "@/lib/production/actions";
import { formatTime } from "@/lib/format";
import { PT_POINTS } from "@/lib/production/labels";
import { ResultError, SignedAction } from "./signed-action";

const num = (v: string) => Number(v.replace(",", "."));
const fmt = (n: number, d = 1) =>
  n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });

export type WeightRow = {
  id: string;
  sample_no: number;
  sampled_at: string;
  value: number;
  min_value: number;
  max_value: number;
  in_range: boolean;
  action: string | null;
};

/** S-20 · Control de peso cada N minutos (RF-35, D-08): tabla, gráfica con límites y próximo control. */
export function WeightControlPanel({
  batchId,
  stageOrderId,
  presentationId,
  presentation,
  limits,
  rows,
  intervalMin,
  now,
  canRecord,
  signer,
}: {
  batchId: string;
  stageOrderId: string;
  presentationId: string;
  presentation: string;
  limits: { min: number; max: number };
  rows: WeightRow[];
  intervalMin: number;
  now: string;
  canRecord: boolean;
  signer: string;
}) {
  const [value, setValue] = useState("");
  const [action, setAction] = useState("");
  const n = num(value);
  const outOfRange = value !== "" && (n < limits.min || n > limits.max);
  const last = rows.at(-1);
  const due = last ? Date.parse(last.sampled_at) + intervalMin * 60_000 : null;
  const [clock, setClock] = useState(() => Date.parse(now));
  useEffect(() => {
    const t = window.setInterval(() => setClock((c) => c + 30_000), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const left = due ? Math.round((due - clock) / 60_000) : null;
  // Gráfica de tendencia con límites (SVG accesible: la tabla tiene los mismos datos).
  const W = 520;
  const H = 150;
  const lo = Math.min(limits.min, ...rows.map((r) => r.value)) - 1;
  const hi = Math.max(limits.max, ...rows.map((r) => r.value)) + 1;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const x = (i: number) => (rows.length < 2 ? W / 2 : 20 + (i * (W - 40)) / (rows.length - 1));
  return (
    <section
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
      aria-labelledby={`wc-${presentationId}`}
      data-testid="weight-controls"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`wc-${presentationId}`} className="text-card-title">
          Control de peso · {presentation} · rango {fmt(limits.min)}–{fmt(limits.max)} g
        </h3>
        {due ? (
          <span
            className={`flex items-center gap-1.5 text-sm font-semibold ${left !== null && left <= 0 ? "text-q-bad-fg" : "text-text-strong"}`}
            role="status"
          >
            <Timer aria-hidden className="size-4" />
            {left !== null && left <= 0
              ? `Control vencido: corresponde desde ${formatTime(new Date(due).toISOString())}`
              : `Próximo control ${formatTime(new Date(due).toISOString())} (en ${left} min)`}
          </span>
        ) : (
          <span className="text-sm text-text-secondary">
            Registre el primer control; luego cada {intervalMin} minutos.
          </span>
        )}
      </div>
      {rows.length ? (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-40 w-full max-w-[560px]"
            role="img"
            aria-label={`Tendencia del peso neto de ${presentation}`}
          >
            <line
              x1="0"
              x2={W}
              y1={y(limits.max)}
              y2={y(limits.max)}
              stroke="currentColor"
              className="text-q-bad-ic"
              strokeDasharray="4 4"
            />
            <line
              x1="0"
              x2={W}
              y1={y(limits.min)}
              y2={y(limits.min)}
              stroke="currentColor"
              className="text-q-bad-ic"
              strokeDasharray="4 4"
            />
            <polyline
              fill="none"
              stroke="currentColor"
              className="text-primary"
              strokeWidth="2"
              points={rows.map((r, i) => `${x(i)},${y(r.value)}`).join(" ")}
            />
            {rows.map((r, i) => (
              <circle
                key={r.id}
                cx={x(i)}
                cy={y(r.value)}
                r="4"
                className={r.in_range ? "fill-primary" : "fill-q-bad-ic"}
              />
            ))}
          </svg>
          <table className="w-full max-w-[720px] text-left text-sm">
            <thead className="bg-surface-sunken">
              <tr>
                {["#", "Hora", "Peso neto (g)", "Resultado", "Acción"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 text-label uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-divider" data-in-range={r.in_range}>
                  <td className="px-3 py-2 font-mono text-xs">{r.sample_no}</td>
                  <td className="px-3 py-2 font-mono text-xs">{formatTime(r.sampled_at)}</td>
                  <td className="px-3 py-2 font-mono text-xs font-semibold">
                    {fmt(Number(r.value))}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.in_range ? (
                      "En rango"
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-q-bad-fg">
                        <CircleX aria-hidden className="size-3.5" /> Fuera de rango
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.action ?? "—"}
                    <CorrectionButton
                      batchId={batchId}
                      table="weight_controls"
                      recordId={r.id}
                      field="action"
                      current={r.action ?? ""}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      {canRecord ? (
        <div className="grid gap-3">
          <div className="grid grid-cols-[200px_1fr] gap-3 max-[1023px]:grid-cols-1">
            <Field id={`wv-${presentationId}`} label="Peso neto (g) *">
              <Input
                id={`wv-${presentationId}`}
                inputMode="decimal"
                className="h-12 font-mono text-[16px]"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </Field>
            {outOfRange ? (
              <Field id={`wa-${presentationId}`} label="Acción tomada * (fuera de rango)">
                <Input
                  id={`wa-${presentationId}`}
                  className="h-12"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                />
              </Field>
            ) : null}
          </div>
          {outOfRange ? (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-q-bad-fg">
              <CircleX aria-hidden className="size-4" /> {value} g está fuera del rango{" "}
              {fmt(limits.min)}–{fmt(limits.max)} g: registre la acción tomada.
            </p>
          ) : null}
          <div>
            <SignedAction
              label="Registrar control"
              title={`Control de peso · ${presentation}`}
              meaning="Ejecuté"
              summary={[{ label: "Peso neto", value: `${value} g`, mono: true }]}
              signer={signer}
              validate={() =>
                !n
                  ? "Registre el peso neto."
                  : outOfRange && !action.trim()
                    ? "Registre la acción tomada."
                    : null
              }
              run={async (pw) => {
                const res = await recordWeight(
                  batchId,
                  { stageOrderId, presentationId, value: n, action },
                  pw,
                );
                if (res.ok) {
                  setValue("");
                  setAction("");
                }
                return res;
              }}
              testId="record-weight"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Rendimiento de la etapa (RF-37): fabricación (granel), envase (unidades) o acondicionamiento (PT aprobado). */
export function OutputForm({
  batchId,
  stageOrderId,
  presentationId,
  stage,
  theoretical,
  unit,
  received,
  minPct,
  signer,
}: {
  batchId: string;
  stageOrderId: string;
  presentationId: string | null;
  stage: string;
  theoretical: number;
  unit: string;
  received?: number | null;
  minPct?: number | null;
  signer: string;
}) {
  const [a, setA] = useState(stage === "acondicionamiento" && received ? String(received) : "");
  const [rej, setRej] = useState("");
  const [ret, setRet] = useState("");
  const [rem, setRem] = useState("");
  const actual =
    stage === "acondicionamiento"
      ? num(a || "0") - num(rej || "0") - num(ret || "0")
      : num(a || "0");
  const pct = theoretical ? Math.round((actual * 1000) / theoretical) / 10 : 0;
  const ok = minPct == null || pct >= minPct;
  return (
    <div className="grid gap-3" data-testid={`output-form-${stage}`}>
      <div className="grid grid-cols-3 gap-3 max-[1023px]:grid-cols-1">
        <Field
          id={`oa-${stageOrderId}-${presentationId}`}
          label={
            stage === "fabricacion"
              ? `Granel obtenido (${unit})`
              : stage === "envase"
                ? "Unidades envasadas"
                : "Unidades recibidas de envase"
          }
        >
          <Input
            id={`oa-${stageOrderId}-${presentationId}`}
            inputMode="decimal"
            className="h-12 font-mono"
            value={a}
            onChange={(e) => setA(e.target.value)}
          />
        </Field>
        {stage === "acondicionamiento" ? (
          <>
            <Field id={`or-${presentationId}`} label="Rechazadas en inspección">
              <Input
                id={`or-${presentationId}`}
                inputMode="numeric"
                className="h-12 font-mono"
                value={rej}
                onChange={(e) => setRej(e.target.value)}
              />
            </Field>
            <Field id={`ot-${presentationId}`} label="Muestras de retención">
              <Input
                id={`ot-${presentationId}`}
                inputMode="numeric"
                className="h-12 font-mono"
                value={ret}
                onChange={(e) => setRet(e.target.value)}
              />
            </Field>
          </>
        ) : stage === "fabricacion" ? (
          <Field
            id={`om-${stageOrderId}`}
            label={`Granel remanente (${unit})`}
            hint="Muestras de calidad y contramuestra"
          >
            <Input
              id={`om-${stageOrderId}`}
              inputMode="decimal"
              className="h-12 font-mono"
              value={rem}
              onChange={(e) => setRem(e.target.value)}
            />
          </Field>
        ) : null}
      </div>
      {a ? (
        <p className="text-sm" role="status" data-testid="yield-preview">
          {stage === "acondicionamiento"
            ? `${fmt(num(a), 0)} − ${fmt(num(rej || "0"), 0)} − ${fmt(num(ret || "0"), 0)} = ${fmt(actual, 0)} aprobadas · `
            : ""}
          {fmt(actual, stage === "fabricacion" ? 1 : 0)} {unit} = <b>{fmt(pct)} %</b> del teórico (
          {fmt(theoretical, stage === "fabricacion" ? 1 : 0)} {unit})
          {minPct != null
            ? ok
              ? ` · dentro del límite ≥ ${fmt(minPct)} %`
              : ` · FUERA del límite ≥ ${fmt(minPct)} %: exige desviación`
            : ""}
        </p>
      ) : null}
      <div>
        <SignedAction
          label="Registrar rendimiento"
          title="Rendimiento de la etapa"
          meaning="Ejecuté"
          summary={[{ label: "Rendimiento", value: `${fmt(pct)} %`, mono: true }]}
          signer={signer}
          validate={() => (!a ? "Registre la cantidad obtenida." : null)}
          run={(pw) =>
            recordOutput(
              batchId,
              {
                stageOrderId,
                presentationId,
                data:
                  stage === "acondicionamiento"
                    ? { received: num(a), rejected: num(rej || "0"), retained: num(ret || "0") }
                    : stage === "fabricacion"
                      ? { actual: num(a), remnant: num(rem || "0") }
                      : { actual: num(a) },
              },
              pw,
            )
          }
          testId={`record-output-${stage}`}
        />
      </div>
    </div>
  );
}

/** S-21 · Inspección de producto terminado de 9 puntos (RF-36, D-47): la firma coordinación o supervisión. */
export function InspectionForm({
  batchId,
  stageOrderId,
  presentationId,
  presentation,
  signer,
}: {
  batchId: string;
  stageOrderId: string;
  presentationId: string;
  presentation: string;
  signer: string;
}) {
  const [res, setRes] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const done = PT_POINTS.every((_, i) => res[i + 1]);
  return (
    <div className="grid gap-2" data-testid="inspection-form">
      <ol className="grid gap-2">
        {PT_POINTS.map((p, i) => (
          <li
            key={p}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 max-[1023px]:grid-cols-1"
          >
            <span className="text-[15px]">
              {i + 1}. {p}
            </span>
            <span className="flex gap-2" role="radiogroup" aria-label={`${p}: resultado`}>
              {["conforme", "no_conforme"].map((r) => (
                <label
                  key={r}
                  className={`flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm ${res[i + 1] === r ? "border-primary bg-primary-soft font-semibold" : "border-border-control"}`}
                >
                  <input
                    type="radio"
                    name={`pt-${presentationId}-${i}`}
                    className="size-5"
                    checked={res[i + 1] === r}
                    onChange={() => setRes((x) => ({ ...x, [i + 1]: r }))}
                  />
                  {r === "conforme" ? "Conforme" : "No conforme"}
                </label>
              ))}
            </span>
            <Input
              aria-label={`Observación del punto ${i + 1}`}
              className="h-11"
              value={notes[i + 1] ?? ""}
              onChange={(e) => setNotes((x) => ({ ...x, [i + 1]: e.target.value }))}
              placeholder="Observación"
            />
          </li>
        ))}
      </ol>
      {!done ? (
        <p className="text-sm text-text-secondary">
          Marque los 9 puntos para firmar la inspección.
        </p>
      ) : null}
      <div>
        <SignedAction
          label="Firmar inspección"
          title={`Inspección de producto terminado · ${presentation}`}
          meaning="Verifiqué"
          summary={[
            {
              label: "Puntos",
              value: `${Object.values(res).filter((r) => r === "conforme").length} conformes de 9`,
            },
          ]}
          signer={signer}
          disabled={!done}
          run={(pw) =>
            recordInspection(
              batchId,
              {
                stageOrderId,
                presentationId,
                points: PT_POINTS.map((label, i) => ({
                  n: i + 1,
                  label,
                  result: res[i + 1],
                  note: notes[i + 1] ?? "",
                })),
              },
              pw,
            )
          }
          testId="sign-inspection"
        />
      </div>
    </div>
  );
}

/** Devolución de material de acondicionamiento: entregado = usado + dañado + devuelto (D-48). */
export function ReturnForm({
  batchId,
  lineId,
  material,
  delivered,
  signer,
}: {
  batchId: string;
  lineId: string;
  material: string;
  delivered: number;
  signer: string;
}) {
  const [used, setUsed] = useState("");
  const [dam, setDam] = useState("");
  const [ret, setRet] = useState("");
  const sum = num(used || "0") + num(dam || "0") + num(ret || "0");
  return (
    <div className="grid gap-2 border-t border-divider pt-2" data-testid={`return-${material}`}>
      <span className="text-sm font-semibold">
        {material} · entregadas {fmt(delivered, 0)}
      </span>
      <div className="grid grid-cols-3 gap-3 max-[1023px]:grid-cols-1">
        <Field id={`ru-${lineId}`} label="Usadas">
          <Input
            id={`ru-${lineId}`}
            inputMode="numeric"
            className="h-12 font-mono"
            value={used}
            onChange={(e) => setUsed(e.target.value)}
          />
        </Field>
        <Field id={`rd-${lineId}`} label="Dañadas">
          <Input
            id={`rd-${lineId}`}
            inputMode="numeric"
            className="h-12 font-mono"
            value={dam}
            onChange={(e) => setDam(e.target.value)}
          />
        </Field>
        <Field id={`rr-${lineId}`} label="Devueltas">
          <Input
            id={`rr-${lineId}`}
            inputMode="numeric"
            className="h-12 font-mono"
            value={ret}
            onChange={(e) => setRet(e.target.value)}
          />
        </Field>
      </div>
      {used ? (
        <p
          className={`text-sm ${sum === delivered ? "text-q-ok-fg" : "text-q-bad-fg"}`}
          role="status"
        >
          {sum === delivered ? "Cuadra" : "No cuadra"}: {fmt(num(used || "0"), 0)} +{" "}
          {fmt(num(dam || "0"), 0)} + {fmt(num(ret || "0"), 0)} = {fmt(sum, 0)} de{" "}
          {fmt(delivered, 0)}
        </p>
      ) : null}
      <div>
        <SignedAction
          label="Registrar devolución"
          title={`Devolución · ${material}`}
          meaning="Ejecuté"
          summary={[
            { label: "Cuenta", value: `${fmt(sum, 0)} de ${fmt(delivered, 0)}`, mono: true },
          ]}
          signer={signer}
          validate={() => (!used ? "Registre las unidades usadas." : null)}
          run={(pw) =>
            recordReturn(
              batchId,
              { lineId, used: num(used), damaged: num(dam || "0"), returned: num(ret || "0") },
              pw,
            )
          }
          testId={`record-return-${material}`}
        />
      </div>
    </div>
  );
}

export function CodingVerifyButton({
  batchId,
  text,
  signer,
}: {
  batchId: string;
  text: string;
  signer: string;
}) {
  return (
    <SignedAction
      label="Verificar codificación"
      title="Verificar la codificación impresa"
      meaning="Ejecuté"
      summary={[{ label: "Texto", value: text, mono: true }]}
      signer={signer}
      run={(pw) => verifyCoding(batchId, pw)}
      testId="verify-coding"
    />
  );
}

/** Corrección con motivo (DI-4, DI-12): el valor anterior queda tachado; a la sexta se avisa al verificador. */
export function CorrectionButton({
  batchId,
  table,
  recordId,
  field,
  current,
}: {
  batchId: string;
  table: string;
  recordId: string;
  field: string;
  current: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<Exclude<PrResult, { ok: true }> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <button
        type="button"
        className="ml-2 text-xs text-primary underline"
        onClick={() => setOpen(true)}
      >
        Corregir
      </button>
    );
  }
  return (
    <span className="mt-1 grid gap-1.5">
      <Input
        aria-label="Nuevo valor"
        className="h-10"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Input
        aria-label="Motivo de la corrección"
        className="h-10"
        placeholder="Motivo *"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <span className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || !reason.trim()}
          onClick={() =>
            start(async () => {
              const res = await correctRecord(batchId, { table, recordId, field, value, reason });
              if (!res.ok) return setError(res);
              setError(null);
              setMsg(
                res.warning
                  ? `Registro con ${res.count} correcciones: se avisó al verificador y a Calidad.`
                  : null,
              );
              setOpen(false);
              router.refresh();
            })
          }
        >
          Guardar corrección
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </span>
      <ResultError error={error} />
      {msg ? (
        <span role="status" className="text-xs text-q-warn-fg">
          {msg}
        </span>
      ) : null}
    </span>
  );
}
