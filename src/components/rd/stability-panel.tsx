"use client";

import { CircleX, Lock, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "cn";
import { ReauthDialog } from "@/components/documents/reauth-dialog";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatNumber } from "@/lib/format";
import { closeStudy, recordReadings, type RdResult } from "@/lib/rd/actions";
import { ANALYTES, TEST_LABELS, TIME_LABELS, TIME_POINTS } from "@/lib/rd/labels";

export type StudyView = {
  id: string;
  status: string;
  result: string | null;
  start_date: string;
  end_date: string;
  protocol: string;
  conclusions: string | null;
  early_close_reason: string | null;
  closed_by_name: string | null;
  closed_at: string | null;
};
export type TestView = {
  id: string;
  test_type: string;
  required: boolean;
  condition_min: number | null;
  condition_max: number | null;
  unit: string | null;
  replicates: number;
  report_file: string | null;
  external_lab_name: string | null;
  sample_volume_ml: number | null;
};
export type ReadingView = {
  test_id: string;
  time_point: string;
  replicate: number;
  due_at: string;
  recorded_at: string | null;
  temperature: number | null;
  ph: number | null;
  organoleptic: { aspecto?: string; color?: string; olor?: string; cambio?: boolean } | null;
  value: number | null;
  analytes: Record<string, { qualifier?: string; value?: number } | string> | null;
  in_range: boolean | null;
  within_window: boolean | null;
  recorded_by: string | null;
};

const DAY = 86_400_000;

/** Bloque «Estabilidad preliminar» (S-36, RF-16): cinco pruebas, cronograma, lecturas y cierre firmado. */
export function StabilityPanel({
  study,
  tests,
  readings,
  missing,
  now,
  canRecord,
  canClose,
  signer,
  path,
}: {
  study: StudyView;
  tests: TestView[];
  readings: ReadingView[];
  missing: { test: string; time_point: string; missing: number }[];
  now: string;
  canRecord: boolean;
  canClose: boolean;
  signer: string;
  path: string;
}) {
  const router = useRouter();
  const active = tests.filter((t) => t.required);
  const [tab, setTab] = useState(active[0]?.test_type ?? "calentamiento");
  const [closing, setClosing] = useState(false);
  const weight = (t?: TestView) => (t?.test_type === "microbiologica" ? 4 : 1);
  const total = readings
    .filter((r) => active.some((t) => t.id === r.test_id))
    .reduce((s, r) => s + weight(tests.find((t) => t.id === r.test_id)), 0);
  const done = readings
    .filter((r) => r.recorded_at && active.some((t) => t.id === r.test_id))
    .reduce((s, r) => s + weight(tests.find((t) => t.id === r.test_id)), 0);
  const missingText = missing
    .map(
      (m) => `${m.missing} de ${TEST_LABELS[m.test].toLowerCase()} a ${TIME_LABELS[m.time_point]}`,
    )
    .join(", ");
  const open = study.status === "en_curso";
  const test = tests.find((t) => t.test_type === tab);

  return (
    <section
      aria-labelledby="estabilidad"
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
      data-testid="stability"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="estabilidad" className="text-card-title">
            Estabilidad preliminar
          </h2>
          <p className="text-small text-text-secondary">
            Inicio {formatDateTime(study.start_date)} · fin {formatDateTime(study.end_date)} ·{" "}
            <span className="inline-flex items-center gap-1 font-mono text-xs">
              <Lock aria-hidden className="size-3" />
              {study.protocol}
            </span>
          </p>
        </div>
        <div className="grid justify-items-end gap-1">
          <b className="text-sm" data-testid="readings-progress">
            Lecturas completas: {done} de {total} obligatorias
          </b>
          {study.result ? (
            <StatusBadge
              status={study.result === "cumple" ? "aprobado" : "rechazado"}
              label={study.result === "cumple" ? "Cumple" : "No cumple"}
            />
          ) : (
            <StatusBadge status="en_curso" label="En curso" />
          )}
        </div>
      </div>
      {study.status !== "en_curso" ? (
        <p
          role="note"
          className="rounded-lg border border-neutral-strong bg-surface-sunken px-3.5 py-2.5 text-sm"
        >
          {study.status === "cerrado_anticipado"
            ? "Cierre anticipado «No cumple»"
            : `Estudio cerrado: ${study.result === "cumple" ? "cumple" : "no cumple"}`}
          {study.early_close_reason ? ` · ${study.early_close_reason}` : ""}
          {study.conclusions ? ` · ${study.conclusions}` : ""}
          {study.closed_by_name
            ? ` · firmó ${study.closed_by_name} el ${formatDateTime(study.closed_at!)}`
            : ""}
        </p>
      ) : null}

      <nav aria-label="Pruebas" className="flex flex-wrap gap-1 border-b border-border">
        {tests.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={t.test_type === tab ? "page" : undefined}
            onClick={() => setTab(t.test_type)}
            disabled={!t.required}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              t.test_type === tab
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-text-strong",
              !t.required && "opacity-50",
            )}
          >
            {TEST_LABELS[t.test_type]}
            {!t.required ? " (no requerida)" : ""}
          </button>
        ))}
      </nav>

      {test ? (
        <TestGrid test={test} readings={readings.filter((r) => r.test_id === test.id)} now={now} />
      ) : null}
      {test && open && canRecord ? (
        <ReadingForm
          key={test.id}
          test={test}
          readings={readings.filter((r) => r.test_id === test.id)}
          path={path}
        />
      ) : null}

      {open && canClose ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-divider pt-3">
          {missing.length ? (
            <span className="flex items-center gap-1.5 text-small text-text-secondary">
              <Lock aria-hidden className="size-3.5" />
              «Cumple» deshabilitado: faltan {missingText}.
            </span>
          ) : null}
          <Button type="button" onClick={() => setClosing(true)}>
            Cerrar estudio
          </Button>
        </div>
      ) : null}
      {closing ? (
        <CloseDialog
          study={study}
          canCumple={missing.length === 0}
          signer={signer}
          path={path}
          onClose={() => {
            setClosing(false);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}

function cellStatus(
  r: ReadingView,
  now: string,
): { status: "pendiente" | "en_curso" | "bloqueada" | "completada"; label: string } {
  if (r.recorded_at) return { status: "completada", label: "Registrada" };
  const due = new Date(r.due_at).getTime();
  const n = new Date(now).getTime();
  if (Math.floor(due / DAY) === Math.floor(n / DAY))
    return { status: "en_curso", label: "Vence hoy" };
  if (due < n) return { status: "bloqueada", label: "Atrasada" };
  return { status: "pendiente", label: "Pendiente" };
}

function TestGrid({
  test,
  readings,
  now,
}: {
  test: TestView;
  readings: ReadingView[];
  now: string;
}) {
  const points = TIME_POINTS.filter((tp) => readings.some((r) => r.time_point === tp));
  const reps = Array.from({ length: test.replicates }, (_, i) => i + 1);
  return (
    <div className="grid gap-2">
      <p className="text-small text-text-secondary">
        {test.test_type === "calentamiento" || test.test_type === "enfriamiento"
          ? `Rango ${formatNumber(Number(test.condition_min), 0)}–${formatNumber(Number(test.condition_max), 0)} °C · 30 días · temperatura, pH y examen organoléptico por triplicado.`
          : test.test_type === "microbiologica"
            ? `Laboratorio externo${test.external_lab_name ? ` · ${test.external_lab_name}` : ""}${test.report_file ? ` · informe ${test.report_file}` : " · sin informe adjunto"} · 0 h y 30 d.`
            : test.test_type === "viscosidad"
              ? `Muestra ${test.sample_volume_ml ? `${formatNumber(Number(test.sample_volume_ml), 0)} mL` : "sin volumen registrado"} (mínimo 250 mL) · 0 d y 30 d por triplicado, en mPa·s.`
              : "Método: picnómetro · 0 d y 30 d, en g/mL."}
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm" data-testid={`grid-${test.test_type}`}>
          <caption className="sr-only">Lecturas de {TEST_LABELS[test.test_type]}</caption>
          <thead className="bg-surface-sunken">
            <tr>
              <th scope="col" className="px-2 py-2 text-label uppercase">
                Tiempo
              </th>
              {reps.map((r) => (
                <th key={r} scope="col" className="px-2 py-2 text-label uppercase">
                  {test.replicates > 1 ? `R${r}` : "Resultado"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((tp) => (
              <tr key={tp} className="border-t border-divider align-top">
                <th scope="row" className="px-2 py-2 font-mono text-xs">
                  {TIME_LABELS[tp]}
                </th>
                {reps.map((rep) => {
                  const r = readings.find((x) => x.time_point === tp && x.replicate === rep);
                  if (!r)
                    return (
                      <td key={rep} className="px-2 py-2">
                        —
                      </td>
                    );
                  const st = cellStatus(r, now);
                  return (
                    <td
                      key={rep}
                      className={cn("px-2 py-2", r.in_range === false && "bg-q-bad-bg")}
                      data-cell={`${tp}-${rep}`}
                    >
                      {r.recorded_at ? (
                        <span className="grid gap-0.5 text-xs">
                          {r.temperature != null ? (
                            <span className="font-mono">
                              {formatNumber(Number(r.temperature), 1)} °C · pH{" "}
                              {formatNumber(Number(r.ph), 2)}
                            </span>
                          ) : null}
                          {r.in_range === false ? (
                            <span className="flex items-center gap-1 font-semibold text-q-bad-fg">
                              <TriangleAlert aria-hidden className="size-3" />
                              Fuera de {formatNumber(Number(test.condition_min), 0)}–
                              {formatNumber(Number(test.condition_max), 0)} °C
                            </span>
                          ) : null}
                          {r.organoleptic ? (
                            <span
                              className={r.organoleptic.cambio ? "font-semibold text-q-bad-fg" : ""}
                            >
                              {r.organoleptic.aspecto} · {r.organoleptic.color} ·{" "}
                              {r.organoleptic.olor}
                            </span>
                          ) : null}
                          {r.value != null ? (
                            <span className="font-mono">
                              {formatNumber(Number(r.value), test.test_type === "densidad" ? 3 : 1)}{" "}
                              {test.unit}
                            </span>
                          ) : null}
                          {r.analytes ? (
                            <span>
                              {ANALYTES.map(([k, l]) => {
                                const a = r.analytes?.[k];
                                return `${l.split(" ")[0]}: ${typeof a === "string" ? a : `${a?.qualifier ?? ""} ${a?.value ?? ""} UFC/g`}`;
                              }).join(" · ")}
                            </span>
                          ) : null}
                          <span className="text-text-muted">
                            {r.recorded_by ?? ""} · {formatDateTime(r.recorded_at)}
                            {r.within_window === false ? " · fuera de ventana" : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="grid gap-1">
                          <StatusBadge status={st.status} label={st.label} />
                          <span className="font-mono text-[11px] text-text-secondary">
                            {formatDateTime(r.due_at)}
                          </span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReadingForm({
  test,
  readings,
  path,
}: {
  test: TestView;
  readings: ReadingView[];
  path: string;
}) {
  const router = useRouter();
  const pendingTps = TIME_POINTS.filter((tp) =>
    readings.some((r) => r.time_point === tp && !r.recorded_at),
  );
  const [tp, setTp] = useState<string>(pendingTps[0] ?? "");
  const pendingReps = readings
    .filter((r) => r.time_point === tp && !r.recorded_at)
    .map((r) => r.replicate);
  const [vals, setVals] = useState<Record<number, Record<string, string | boolean>>>({});
  const [shared, setShared] = useState<Record<string, string>>({
    lab_name: test.external_lab_name ?? "",
    report_ref: test.report_file ?? "",
    sample_volume_ml: test.sample_volume_ml ? String(test.sample_volume_ml) : "",
    meso_q: "<",
    meso_v: "",
    pseudomonas: "ausente",
    staphylococcus: "ausente",
    ecoli: "ausente",
  });
  const [error, setError] = useState<Exclude<RdResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  if (!pendingTps.length)
    return (
      <p className="text-small text-text-secondary">
        Todas las lecturas de esta prueba están registradas.
      </p>
    );
  const v = (rep: number, k: string) => String(vals[rep]?.[k] ?? "");
  const setV = (rep: number, k: string, x: string | boolean) =>
    setVals({ ...vals, [rep]: { ...vals[rep], [k]: x } });
  const temp = test.test_type === "calentamiento" || test.test_type === "enfriamiento";

  const submit = () =>
    start(async () => {
      const readingsIn = pendingReps.map((rep) => ({
        replicate: rep,
        values: temp
          ? {
              temperature: Number(v(rep, "temperature")),
              ph: Number(v(rep, "ph")),
              organoleptic: {
                aspecto: v(rep, "aspecto"),
                color: v(rep, "color"),
                olor: v(rep, "olor"),
                cambio: Boolean(vals[rep]?.cambio),
              },
            }
          : test.test_type === "microbiologica"
            ? {
                lab_name: shared.lab_name,
                report_ref: shared.report_ref,
                analytes: {
                  mesofilos: { qualifier: shared.meso_q, value: Number(shared.meso_v) },
                  pseudomonas: shared.pseudomonas,
                  staphylococcus: shared.staphylococcus,
                  ecoli: shared.ecoli,
                },
              }
            : test.test_type === "viscosidad"
              ? {
                  value: Number(v(rep, "value")),
                  sample_volume_ml: Number(shared.sample_volume_ml),
                }
              : { value: Number(v(rep, "value")) },
      }));
      const res = await recordReadings({
        testId: test.id,
        timePoint: tp,
        readings: readingsIn,
        path,
      });
      if (!res.ok) setError(res);
      else {
        setError(null);
        setVals({});
      }
      router.refresh();
    });

  return (
    <form
      className="grid gap-3 rounded-md border border-border bg-surface-sunken p-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      aria-label={`Registrar lectura de ${TEST_LABELS[test.test_type]}`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="r-tp" className="text-label uppercase">
            Tiempo
          </Label>
          <select
            id="r-tp"
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            className="h-10 rounded-md border border-border-control bg-white px-2.5 text-sm"
          >
            {pendingTps.map((x) => (
              <option key={x} value={x}>
                {TIME_LABELS[x]}
              </option>
            ))}
          </select>
        </div>
        {test.test_type === "microbiologica" ? (
          <>
            <Field
              id="r-lab"
              label="Laboratorio externo"
              value={shared.lab_name}
              onChange={(x) => setShared({ ...shared, lab_name: x })}
            />
            <Field
              id="r-report"
              label="Informe del laboratorio"
              value={shared.report_ref}
              onChange={(x) => setShared({ ...shared, report_ref: x })}
            />
          </>
        ) : null}
        {test.test_type === "viscosidad" ? (
          <Field
            id="r-vol"
            label="Volumen de muestra (mL)"
            type="number"
            value={shared.sample_volume_ml}
            onChange={(x) => setShared({ ...shared, sample_volume_ml: x })}
          />
        ) : null}
      </div>
      {test.test_type === "microbiologica" ? (
        <div className="grid grid-cols-4 gap-3 max-[1279px]:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="r-meso" className="text-label uppercase">
              Mesófilos aerobios (UFC/g)
            </Label>
            <div className="flex gap-1">
              <select
                aria-label="Calificador de mesófilos"
                value={shared.meso_q}
                onChange={(e) => setShared({ ...shared, meso_q: e.target.value })}
                className="h-10 rounded-md border border-border-control bg-white px-1.5 text-sm"
              >
                <option value="<">&lt;</option>
                <option value="=">=</option>
              </select>
              <Input
                id="r-meso"
                type="number"
                value={shared.meso_v}
                onChange={(e) => setShared({ ...shared, meso_v: e.target.value })}
              />
            </div>
          </div>
          {ANALYTES.slice(1).map(([k, l]) => (
            <div key={k} className="grid gap-1.5">
              <Label htmlFor={`r-${k}`} className="text-label uppercase">
                {l}
              </Label>
              <select
                id={`r-${k}`}
                value={shared[k]}
                onChange={(e) => setShared({ ...shared, [k]: e.target.value })}
                className="h-10 rounded-md border border-border-control bg-white px-2.5 text-sm"
              >
                <option value="ausente">Ausente</option>
                <option value="presente">Presente</option>
              </select>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          {pendingReps.map((rep) => (
            <div
              key={rep}
              className="grid grid-cols-[48px_repeat(6,minmax(0,1fr))] items-end gap-2 max-[1279px]:grid-cols-3"
            >
              <span className="pb-2 font-mono text-xs font-semibold">
                {test.replicates > 1 ? `R${rep}` : ""}
              </span>
              {temp ? (
                <>
                  <Field
                    id={`r-${rep}-t`}
                    label="Temperatura (°C)"
                    type="number"
                    value={v(rep, "temperature")}
                    onChange={(x) => setV(rep, "temperature", x)}
                  />
                  <Field
                    id={`r-${rep}-ph`}
                    label="pH"
                    type="number"
                    value={v(rep, "ph")}
                    onChange={(x) => setV(rep, "ph", x)}
                  />
                  <Field
                    id={`r-${rep}-a`}
                    label="Aspecto"
                    value={v(rep, "aspecto")}
                    onChange={(x) => setV(rep, "aspecto", x)}
                  />
                  <Field
                    id={`r-${rep}-c`}
                    label="Color"
                    value={v(rep, "color")}
                    onChange={(x) => setV(rep, "color", x)}
                  />
                  <Field
                    id={`r-${rep}-o`}
                    label="Olor"
                    value={v(rep, "olor")}
                    onChange={(x) => setV(rep, "olor", x)}
                  />
                  <label className="flex items-center gap-1.5 pb-2 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(vals[rep]?.cambio)}
                      onChange={(e) => setV(rep, "cambio", e.target.checked)}
                    />
                    Cambio organoléptico
                  </label>
                </>
              ) : (
                <Field
                  id={`r-${rep}-v`}
                  label={test.test_type === "viscosidad" ? "Viscosidad (mPa·s)" : "Densidad (g/mL)"}
                  type="number"
                  value={v(rep, "value")}
                  onChange={(x) => setV(rep, "value", x)}
                />
              )}
            </div>
          ))}
        </div>
      )}
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg">
          <CircleX aria-hidden className="mt-0.5 size-3.5" />
          {error.rule} {error.detail ? `(${error.detail}) ` : ""}
          {error.action}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Registrando…" : `Registrar lectura de ${TIME_LABELS[tp]}`}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id} className="text-label uppercase">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CloseDialog({
  study,
  canCumple,
  signer,
  path,
  onClose,
}: {
  study: StudyView;
  canCumple: boolean;
  signer: string;
  path: string;
  onClose: () => void;
}) {
  const [result, setResult] = useState<"cumple" | "no_cumple">(canCumple ? "cumple" : "no_cumple");
  const [conclusions, setConclusions] = useState("");
  return (
    <ReauthDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Cerrar el estudio de estabilidad"
      meaning="Aprobé"
      summary={[{ label: "Estudio", value: `Inicio ${formatDateTime(study.start_date)}` }]}
      signer={signer}
      reasonLabel={
        result === "no_cumple" ? "Motivo (p. ej. separación de fase)" : "Observaciones (opcional)"
      }
      reasonRequired={result === "no_cumple"}
      confirmLabel={result === "cumple" ? "Firmar «Cumple»" : "Firmar «No cumple»"}
      destructive={result === "no_cumple"}
      onConfirm={(pw, reason) =>
        closeStudy({ studyId: study.id, result, reason, conclusions, password: pw, path })
      }
      onDone={onClose}
    >
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-label text-text-strong uppercase">Conclusión</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="res"
              checked={result === "cumple"}
              disabled={!canCumple}
              onChange={() => setResult("cumple")}
            />
            Cumple
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="res"
              checked={result === "no_cumple"}
              onChange={() => setResult("no_cumple")}
            />
            No cumple
          </label>
        </div>
        {!canCumple ? (
          <span className="text-xs text-text-secondary">
            Faltan lecturas obligatorias: solo se admite el cierre anticipado «No cumple».
          </span>
        ) : null}
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor="close-concl" className="text-label uppercase">
          Conclusiones
        </Label>
        <Textarea
          id="close-concl"
          rows={2}
          value={conclusions}
          onChange={(e) => setConclusions(e.target.value)}
        />
      </div>
    </ReauthDialog>
  );
}
