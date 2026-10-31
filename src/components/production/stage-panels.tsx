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
import { StatusBadge } from "@/components/gxp/status-badge";
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

/** S-20 · Control de peso cada N minutos (RF-35, D-08; diseño «Registros S-19 a S-21»): tabla con estado, gráfica de
 * tendencia con límites y el próximo control; fuera de rango con ícono y texto exige la acción tomada. */
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
  const target = (limits.min + limits.max) / 2;
  // Gráfica (SVG; la tabla tiene los mismos datos para lectores de pantalla).
  const W = 560;
  const H = 200;
  const PAD = 44;
  const lo = Math.floor(Math.min(limits.min, ...rows.map((r) => Number(r.value))) - 2);
  const hi = Math.ceil(Math.max(limits.max, ...rows.map((r) => Number(r.value))) + 2);
  const y = (v: number) => 12 + (H - 40) * (1 - (v - lo) / (hi - lo));
  const slots = Math.max(rows.length + 1, 2);
  const x = (i: number) => PAD + (i * (W - PAD - 16)) / (slots - 1);
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <div
      className="grid grid-cols-[1fr_1fr] items-start gap-5 max-[1279px]:grid-cols-1"
      data-testid="weight-controls"
    >
      <section
        className="overflow-hidden rounded-[10px] border border-border bg-surface"
        aria-labelledby={`wc-${presentationId}`}
      >
        <header className="flex flex-wrap items-start justify-between gap-3 p-5">
          <h3 id={`wc-${presentationId}`} className="text-[18px] font-semibold">
            Controles de peso cada {intervalMin} min · {presentation}
          </h3>
          <span className="font-mono text-xs text-text-secondary">
            Objetivo {fmt(target)} g · rango {fmt(limits.min)} – {fmt(limits.max)} g
          </span>
        </header>
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-sunken">
            <tr>
              {["Hora", "Peso neto", "Estado", "Observación"].map((h) => (
                <th key={h} scope="col" className="px-4 py-2.5 text-label uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-t border-divider ${r.in_range ? "" : "border-l-4 border-l-q-bad-ic bg-q-bad-bg/60"}`}
                data-in-range={r.in_range}
              >
                <td className="px-4 py-3 font-mono">{formatTime(r.sampled_at)}</td>
                <td
                  className={`px-4 py-3 text-right font-mono font-semibold ${r.in_range ? "" : "text-q-bad-fg"}`}
                >
                  {fmt(Number(r.value))} g
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={r.in_range ? "vigente" : "vencido"}
                    label={r.in_range ? "Conforme" : "Fuera de rango"}
                  />
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.action ?? "Registrado"}
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
            <tr className="border-t border-divider text-text-secondary">
              <td className="px-4 py-3 font-mono">
                {due ? formatTime(new Date(due).toISOString()) : "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono">—</td>
              <td className="px-4 py-3">
                <StatusBadge status="pendiente" label="Pendiente" />
              </td>
              <td className="px-4 py-3 text-xs">
                <span className="flex items-center gap-1">
                  <Timer aria-hidden className="size-3.5" />
                  {due
                    ? left !== null && left <= 0
                      ? "Control vencido: regístrelo ya"
                      : `Próximo control (en ${left} min)`
                    : "Primer control"}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        {canRecord ? (
          <div className="grid gap-3 border-t border-divider p-4">
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
                {fmt(limits.min)}–{fmt(limits.max)} g: registre la acción tomada y abra una
                desviación (F8).
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
      <section
        className="grid gap-2 rounded-[10px] border border-border bg-surface p-5"
        aria-label={`Tendencia del peso neto de ${presentation}`}
      >
        <h3 className="text-[18px] font-semibold">Tendencia del peso neto</h3>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Tendencia del peso neto de ${presentation}: ${rows.length} controles`}
        >
          <rect
            x={PAD}
            y={y(limits.max)}
            width={W - PAD - 16}
            height={y(limits.min) - y(limits.max)}
            className="fill-primary-soft/50"
          />
          {ticks.map((t) => (
            <text
              key={t}
              x={PAD - 6}
              y={y(t) + 4}
              textAnchor="end"
              className="fill-text-secondary font-mono text-[11px]"
            >
              {fmt(t)}
            </text>
          ))}
          {[limits.max, limits.min].map((l, k) => (
            <g key={l}>
              <line
                x1={PAD}
                x2={W - 16}
                y1={y(l)}
                y2={y(l)}
                stroke="currentColor"
                className="text-text-strong"
                strokeDasharray="5 4"
              />
              <text
                x={W - 16}
                y={y(l) + (k ? 14 : -4)}
                textAnchor="end"
                className="fill-text-strong text-[11px] font-semibold"
              >
                {k ? "Mín." : "Máx."} {fmt(l)} g
              </text>
            </g>
          ))}
          {rows.length > 1 ? (
            <polyline
              fill="none"
              stroke="currentColor"
              className="text-primary"
              strokeWidth="2"
              points={rows.map((r, i) => `${x(i)},${y(Number(r.value))}`).join(" ")}
            />
          ) : null}
          {rows.map((r, i) =>
            r.in_range ? (
              <circle
                key={r.id}
                cx={x(i)}
                cy={y(Number(r.value))}
                r="4.5"
                className="fill-surface stroke-primary"
                strokeWidth="2"
              />
            ) : (
              <g key={r.id}>
                <rect
                  x={x(i) - 6}
                  y={y(Number(r.value)) - 6}
                  width="12"
                  height="12"
                  transform={`rotate(45 ${x(i)} ${y(Number(r.value))})`}
                  className="fill-q-bad-ic"
                />
                <text
                  x={x(i)}
                  y={y(Number(r.value)) - 12}
                  textAnchor="middle"
                  className="fill-q-bad-fg text-[11px] font-semibold"
                >
                  {formatTime(r.sampled_at)} · {fmt(Number(r.value))} g · FUERA DE RANGO
                </text>
              </g>
            ),
          )}
          {rows.map((r, i) => (
            <text
              key={`t-${r.id}`}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-text-secondary font-mono text-[11px]"
            >
              {formatTime(r.sampled_at)}
            </text>
          ))}
        </svg>
        <p className="flex flex-wrap gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 bg-primary" /> Peso neto (g)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dashed border-text-strong" /> Límites{" "}
            {fmt(limits.min)} – {fmt(limits.max)} g
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rotate-45 bg-q-bad-ic" /> Fuera de rango
          </span>
        </p>
      </section>
    </div>
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

/** S-21 · Inspección de producto terminado de 9 puntos (RF-36, D-47): Conforme / No conforme por punto; la firma la
 * coordinación o el supervisor. No se completa hasta marcar los 9. */
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
  const marked = PT_POINTS.filter((_, i) => res[i + 1]).length;
  const done = marked === PT_POINTS.length;
  return (
    <div className="grid gap-3" data-testid="inspection-form">
      <ol className="grid">
        {PT_POINTS.map((p, i) => {
          const r = res[i + 1];
          return (
            <li
              key={p}
              className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-3 border-t border-divider py-2.5 first:border-0 max-[1023px]:grid-cols-[28px_1fr]"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold">
                {i + 1}
              </span>
              <span className="grid gap-1">
                <span className="text-[15px]">{p}</span>
                <Input
                  aria-label={`Observación del punto ${i + 1}`}
                  className="h-9 text-sm"
                  value={notes[i + 1] ?? ""}
                  onChange={(e) => setNotes((x) => ({ ...x, [i + 1]: e.target.value }))}
                  placeholder="Sin observaciones"
                />
              </span>
              <span
                className="flex overflow-hidden rounded-md border border-border-control"
                role="radiogroup"
                aria-label={`${p}: resultado`}
              >
                {["conforme", "no_conforme"].map((v) => (
                  <label
                    key={v}
                    className={`flex min-h-11 cursor-pointer items-center gap-1.5 px-3 text-sm font-semibold ${
                      r === v
                        ? v === "conforme"
                          ? "bg-primary text-white"
                          : "bg-q-bad-fg text-white"
                        : "bg-surface text-text-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`pt-${presentationId}-${i}`}
                      className="sr-only"
                      aria-label={v === "conforme" ? "Conforme" : "No conforme"}
                      checked={r === v}
                      onChange={() => setRes((x) => ({ ...x, [i + 1]: v }))}
                    />
                    <span aria-hidden>{v === "conforme" ? "✓ Conforme" : "✕ No conforme"}</span>
                  </label>
                ))}
              </span>
              <StatusBadge
                status={!r ? "sin_dato" : r === "conforme" ? "vigente" : "vencido"}
                label={!r ? "Pendiente" : r === "conforme" ? "Conforme" : "No conforme"}
              />
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-3">
        <span className="text-sm text-text-secondary">
          {done
            ? `${marked} de 9 puntos marcados.`
            : `No disponible: falta marcar ${PT_POINTS.length - marked} puntos.`}
        </span>
        <SignedAction
          label="Completar inspección"
          title={`Inspección de producto terminado · ${presentation}`}
          meaning="Verifiqué"
          summary={[
            {
              label: "Puntos",
              value: `${Object.values(res).filter((x) => x === "conforme").length} conformes de 9`,
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
