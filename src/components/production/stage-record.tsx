import { Check, Circle, Clock, Lock, Play } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { formatNumber, formatTime } from "@/lib/format";
import { loadEquipment, trainingNotice, type StageStep } from "@/lib/production/batch";
import { STAGE_LABELS } from "@/lib/production/labels";
import { batchPage } from "@/lib/production/page";
import { callRpc } from "@/lib/rpc";
import { BatchHeader } from "./batch-header";
import { VerifyButton } from "./prep-forms";
import { StageShell } from "./stage-shell";
import {
  CodingVerifyButton,
  InspectionForm,
  OutputForm,
  ReturnForm,
  WeightControlPanel,
  type WeightRow,
} from "./stage-panels";
import { StepCard } from "./step-card";
import { Card, YieldBar } from "./ui";

type Value = {
  name: string;
  unit?: string;
  min?: number | null;
  max?: number | null;
  value: number;
  in_range: boolean;
};

/**
 * S-19 · S-20 · S-21 (diseño «Registros S-19 a S-21»): a la izquierda los pasos de la versión congelada (completado y
 * firmado, actual, pendiente) y a la derecha el paso actual. Envase por presentación con control de peso; fabricación con
 * la conciliación del granel; acondicionamiento con codificado, inspección de 9 puntos, unidades y devolución.
 */
export async function StageRecord({
  id,
  stageCode,
  presParam,
}: {
  id: string;
  stageCode: "fabricacion" | "envase" | "acondicionamiento";
  presParam?: string;
}) {
  const p = await batchPage(id);
  if (!p) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a Producción" />
      </main>
    );
  }
  const { a, data } = p;
  const stage = data.stages.find((s) => s.stage === stageCode)!;
  const label = STAGE_LABELS[stageCode];
  const byPres = stageCode !== "fabricacion";
  const pres = byPres
    ? (data.order.presentations.find((x) => x.presentation_id === presParam) ??
      data.order.presentations[0])
    : null;
  const presId = pres?.presentation_id ?? null;
  const [equipment, training, now, settings, limits] = await Promise.all([
    loadEquipment(a),
    trainingNotice(a, stage.governing_version_id),
    callRpc(a.supabase, "reference_now").catch(() => new Date(0).toISOString()),
    a.supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["in_process_control_interval_minutes", "yield_min_pt_pct"]),
    stageCode === "envase" && presId
      ? callRpc(a.supabase, "production_fill_limits", {
          p_stage_order: stage.id,
          p_presentation: presId,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const setting = (k: string, d: number) =>
    Number(settings.data?.find((s) => s.key === k)?.value ?? d);
  const interval = setting("in_process_control_interval_minutes", 30);
  const minPt = setting("yield_min_pt_pct", 97);
  const steps: StageStep[] = data.stageSteps[stage.id] ?? [];
  const records = data.steps.filter(
    (r) => r.stage_order_id === stage.id && (r.presentation_id ?? null) === presId,
  );
  const doneKeys = new Set(records.map((r) => r.step_key));
  const current = steps.find((s) => !doneKeys.has(s.step_key));
  const draft = data.drafts.find(
    (d) =>
      d.stage_order_id === stage.id &&
      d.step_key === current?.step_key &&
      (d.presentation_id ?? null) === presId &&
      d.user_id === a.ctx.userId,
  );
  const corrections = (recordId: string) =>
    data.corrections.filter((c) => c.record_id === recordId);
  const output = data.outputs.find(
    (o) => o.stage_order_id === stage.id && (o.presentation_id ?? null) === presId,
  );
  const envaseStage = data.stages.find((s) => s.stage === "envase");
  const envaseOut = data.outputs.find(
    (o) => o.stage_order_id === envaseStage?.id && o.presentation_id === presId,
  );
  const inspection = data.inspections.find(
    (i) => i.stage_order_id === stage.id && i.presentation_id === presId,
  );
  const sa = data.requests.find((r) => r.type === "acondicionamiento");
  const saLines = (
    (sa?.material_request_lines as
      | {
          id: string;
          required_qty: number;
          presentation_id: string | null;
          materials: { name: string; code: string } | null;
        }[]
      | null) ?? []
  ).filter((l) => l.presentation_id === presId);
  const running = stage.status === "en_curso";
  const instruction = data.order.frozen_documents.find((d) =>
    stageCode === "fabricacion"
      ? d.kind === "instructivo"
      : d.kind === "plantilla" && d.stage === stageCode,
  );
  const instructionLabel = instruction
    ? `${instruction.code} v${String(instruction.version_no).padStart(2, "0")}`
    : null;
  const weights = data.weights.filter(
    (w) => w.stage_order_id === stage.id && w.presentation_id === presId,
  ) as unknown as WeightRow[];
  const lineCode = steps
    .find((s) => s.requires_equipment)
    ?.requires_equipment?.split(",")[0]
    ?.trim();
  const line = equipment.find((e) => e.code === lineCode);
  const lastWeight = weights.at(-1);
  const nextControl = lastWeight
    ? new Date(Date.parse(lastWeight.sampled_at) + interval * 60_000).toISOString()
    : null;
  const fmtLim = (l: unknown) => l as { min: number; max: number } | null;
  const lim = fmtLim(limits);
  return (
    <main className="grid content-start gap-5 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <BatchHeader
        data={data}
        title={`Registro de ${label.toLowerCase()}`}
        current={stageCode}
        stage={stageCode}
        training={training}
        subtitle={`${stage.code}${pres ? ` · presentación ${pres.name}` : ""}${lineCode && stageCode === "envase" ? ` · llenadora ${lineCode}` : ""}${current ? ` · paso ${steps.indexOf(current) + 1} de ${steps.length}` : ""}`}
      />
      <StageShell a={a} data={data} stage={stage}>
        {byPres ? (
          <nav
            aria-label="Presentación"
            className="flex flex-wrap gap-1 rounded-[10px] border border-border bg-surface px-3 pt-2"
            role="tablist"
          >
            {data.order.presentations.map((x) => {
              const o = data.outputs.find(
                (y) => y.stage_order_id === stage.id && y.presentation_id === x.presentation_id,
              );
              return (
                <Link
                  key={x.presentation_id}
                  role="tab"
                  aria-selected={x.presentation_id === presId}
                  href={`/produccion/lotes/${id}/${stageCode}?pres=${x.presentation_id}`}
                  className={cn(
                    "-mb-px inline-flex min-h-12 items-center gap-2 border-b-2 px-4 text-[16px] no-underline",
                    x.presentation_id === presId
                      ? "border-primary font-semibold text-primary"
                      : "border-transparent text-text-strong",
                  )}
                >
                  {x.name}
                  <span className="text-xs font-normal text-text-secondary">
                    {o ? formatNumber(Number(o.actual), 0) : "0"} de {formatNumber(x.units, 0)} u
                  </span>
                </Link>
              );
            })}
          </nav>
        ) : null}

        {stageCode === "envase" && pres ? (
          <div className="grid grid-cols-4 gap-4 max-[1023px]:grid-cols-2">
            <Card>
              <span className="text-label text-text-secondary uppercase">Línea de envase</span>
              <b className="font-mono text-[20px]">
                {lineCode ?? "—"} · {line?.name ?? ""}
              </b>
              {line ? (
                <StatusBadge
                  status={line.valid ? "vigente" : "vencido"}
                  label={
                    line.valid
                      ? "Calibración, mantenimiento y limpieza vigentes"
                      : line.reasons.join("; ")
                  }
                />
              ) : null}
            </Card>
            <Card className="border-2 border-primary">
              <span className="text-label text-text-secondary uppercase">Control de peso</span>
              <b className="flex items-center gap-2 text-[22px] leading-7">
                <Clock aria-hidden className="size-5" />
                {nextControl
                  ? `Próximo control ${formatTime(nextControl)}`
                  : "Primer control pendiente"}
              </b>
              <span className="text-sm text-text-secondary">
                cada {interval} min · objetivo {formatNumber(pres.net_content, 1)} g
              </span>
            </Card>
            <Card>
              <span className="text-label text-text-secondary uppercase">Unidades teóricas</span>
              <b className="text-[28px] leading-8">{formatNumber(pres.units, 0)}</b>
              <span className="text-sm text-text-secondary">
                {formatNumber(pres.bulk_qty, 1)} kg ÷ {formatNumber(pres.net_content, 0)} g
              </span>
            </Card>
            <Card>
              <span className="text-label text-text-secondary uppercase">Envasadas</span>
              <b className="text-[28px] leading-8">
                {output ? formatNumber(Number(output.actual), 0) : "—"}
              </b>
              <span className="text-sm text-text-secondary">
                {output ? `a las ${formatTime(output.recorded_at)}` : "Se registran al terminar"}
              </span>
            </Card>
          </div>
        ) : null}

        {stageCode === "acondicionamiento" && data.coding ? (
          <Card
            title={`Codificación · ${data.coding.code}`}
            aside={
              data.coding.status === "verificada" ? (
                <StatusBadge status="completada" label="Codificación verificada" />
              ) : (
                <StatusBadge status="pendiente" label="Por verificar" />
              )
            }
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-md border-2 border-dashed border-border-control bg-white px-5 py-3 font-mono text-lg">
                <div>{data.coding.batch_code_text}</div>
                <div>{data.coding.expiry_text}</div>
              </div>
              {data.coding.status !== "verificada" && running && a.execute ? (
                <CodingVerifyButton
                  batchId={id}
                  text={`${data.coding.batch_code_text} · ${data.coding.expiry_text}`}
                  signer={a.signer}
                />
              ) : null}
            </div>
          </Card>
        ) : null}

        {steps.length ? (
          <div className="grid grid-cols-[340px_1fr] items-start gap-5 max-[1279px]:grid-cols-1">
            <section
              className="grid gap-1 rounded-[10px] border border-border bg-surface p-4"
              aria-label="Pasos del registro"
            >
              <span className="px-1 pb-2 text-label text-text-secondary uppercase">
                Registro de {label.toLowerCase()} · {steps.length} pasos
              </span>
              <ol className="grid" data-testid="stepper">
                {steps.map((s, i) => {
                  const done = records.find((r) => r.step_key === s.step_key);
                  const isCurrent = current?.step_key === s.step_key;
                  const state = done ? "completado" : isCurrent ? "actual" : "pendiente";
                  return (
                    <li
                      key={s.step_key}
                      data-state={state}
                      className="grid grid-cols-[36px_1fr] gap-3"
                    >
                      <span className="flex flex-col items-center">
                        <span
                          className={cn(
                            "flex size-8 items-center justify-center rounded-full border-2",
                            done && "border-primary bg-primary text-white",
                            isCurrent && "border-primary bg-surface text-primary",
                            !done &&
                              !isCurrent &&
                              "border-border-control bg-surface text-text-secondary",
                          )}
                        >
                          {done ? (
                            <Check aria-hidden className="size-4" />
                          ) : isCurrent ? (
                            <Play aria-hidden className="size-4" />
                          ) : (
                            <Circle aria-hidden className="size-3.5" />
                          )}
                        </span>
                        {i < steps.length - 1 ? (
                          <span
                            aria-hidden
                            className={cn(
                              "w-0.5 flex-1",
                              done
                                ? "bg-primary"
                                : "border-l-2 border-dashed border-border-control",
                            )}
                          />
                        ) : null}
                      </span>
                      <div
                        className={cn(
                          "mb-2 grid gap-1 rounded-md px-2 py-1.5",
                          isCurrent && "bg-primary-soft/60",
                        )}
                      >
                        <span
                          className={cn(
                            "text-[15px]",
                            isCurrent ? "font-semibold" : done ? "" : "text-text-secondary",
                          )}
                        >
                          {i + 1}. {s.text}
                        </span>
                        {done ? (
                          <>
                            {((done.values as unknown as Value[]) ?? []).map((v) => (
                              <span
                                key={v.name}
                                className={cn(
                                  "font-mono text-xs",
                                  !v.in_range && "font-semibold text-q-bad-fg",
                                )}
                              >
                                {v.name}: {formatNumber(Number(v.value), 2)} {v.unit}
                                {v.in_range ? "" : " · fuera de rango: exige desviación"}
                              </span>
                            ))}
                            {corrections(done.id).map((c, k) => (
                              <span key={k} className="text-xs text-text-secondary">
                                <s>{JSON.stringify(c.old_value)}</s> → {JSON.stringify(c.new_value)}
                                * · {c.reason} · {c.short_signature}
                              </span>
                            ))}
                            <span className="flex items-center gap-1 text-xs text-text-secondary">
                              <Lock aria-hidden className="size-3" /> Ejecutó: {done.executedBy}
                              {done.requires_verification
                                ? done.verifiedBy
                                  ? ` · Verificó: ${done.verifiedBy}`
                                  : " · pendiente de verificación"
                                : ""}
                            </span>
                            {done.requires_verification &&
                            done.status !== "verificado" &&
                            a.sign &&
                            done.executed_by !== a.ctx.userId ? (
                              <VerifyButton
                                kind="step"
                                batchId={id}
                                recordId={done.id}
                                label="Verificar paso"
                                title={`Verificar paso ${done.label}`}
                                summary={[
                                  { label: "Paso", value: `${done.label} · ${done.text}` },
                                  { label: "Ejecutó", value: done.executedBy },
                                ]}
                                signer={a.signer}
                                testId={`verify-step-${done.label}`}
                              />
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-text-secondary">
                            {isCurrent ? "En curso" : "Pendiente"}
                            {s.requires_verification ? " · requiere verificación" : ""}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
            <div className="grid content-start gap-4">
              {running && a.execute && current ? (
                <StepCard
                  key={`${current.step_key}-${presId}`}
                  batchId={id}
                  stageOrderId={stage.id}
                  presentationId={presId}
                  position={steps.indexOf(current) + 1}
                  total={steps.length}
                  instruction={instructionLabel}
                  step={{
                    ...current,
                    // En envase, el rango del peso neto es el de la presentación (plantilla o tolerancia, D-66).
                    params: (current.params ?? []).map((prm) =>
                      stageCode === "envase" && prm.name === "Peso neto" && lim
                        ? { ...prm, min: Number(lim.min), max: Number(lim.max) }
                        : prm,
                    ),
                  }}
                  equipment={equipment}
                  now={String(now)}
                  draft={Object.fromEntries(
                    Object.entries((draft?.values as Record<string, unknown>) ?? {}).map(
                      ([k, v]) => [k, String(v ?? "")],
                    ),
                  )}
                  signer={a.signer}
                />
              ) : current ? (
                <Card
                  title={`Paso ${steps.indexOf(current) + 1} · ${current.text}`}
                  subtitle={
                    running
                      ? "Lo registra el auxiliar de producción."
                      : "La etapa no está en curso."
                  }
                />
              ) : (
                <Card
                  title="Todos los pasos registrados"
                  subtitle={
                    records.some((r) => r.requires_verification && r.status !== "verificado")
                      ? "Faltan verificaciones de la coordinación."
                      : "Registre el rendimiento y complete la etapa."
                  }
                />
              )}
              {stageCode === "fabricacion" ? <YieldCard /> : null}
            </div>
          </div>
        ) : null}

        {stageCode === "envase" && pres && lim ? (
          <WeightControlPanel
            key={presId}
            batchId={id}
            stageOrderId={stage.id}
            presentationId={pres.presentation_id}
            presentation={pres.name}
            limits={{ min: Number(lim.min), max: Number(lim.max) }}
            rows={weights}
            intervalMin={interval}
            now={String(now)}
            canRecord={running && a.execute}
            signer={a.signer}
          />
        ) : null}

        {stageCode === "envase" ? <YieldCard /> : null}

        {stageCode === "acondicionamiento" && pres ? (
          <div className="grid grid-cols-[1fr_440px] items-start gap-5 max-[1279px]:grid-cols-1">
            <Card
              title="Inspección de producto terminado · 9 puntos"
              subtitle={
                inspection
                  ? "9 de 9 puntos marcados"
                  : "La firma la coordinación de producción o el supervisor (D-47)"
              }
              aside={
                inspection ? (
                  <StatusBadge
                    status={inspection.result === "conforme" ? "vigente" : "vencido"}
                    label={`${(inspection.points as { result: string }[]).filter((x) => x.result === "conforme").length} de 9 conformes`}
                  />
                ) : null
              }
            >
              {inspection ? (
                <ol className="grid" data-testid="inspection-done">
                  {(
                    inspection.points as {
                      n: number;
                      label: string;
                      result: string;
                      note: string;
                    }[]
                  ).map((x) => (
                    <li
                      key={x.n}
                      className="flex min-h-12 items-center gap-3 border-t border-divider text-[15px] first:border-0"
                    >
                      <span className="flex size-7 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold">
                        {x.n}
                      </span>
                      <span className="flex-1">
                        {x.label}
                        <span className="block text-xs text-text-secondary">
                          {x.note || "Sin observaciones"}
                        </span>
                      </span>
                      <StatusBadge
                        status={x.result === "conforme" ? "vigente" : "vencido"}
                        label={x.result === "conforme" ? "Conforme" : "No conforme"}
                      />
                    </li>
                  ))}
                  <li className="pt-2 text-xs text-text-secondary">Firmó {inspection.inspector}</li>
                </ol>
              ) : running && a.verify ? (
                <InspectionForm
                  key={presId}
                  batchId={id}
                  stageOrderId={stage.id}
                  presentationId={pres.presentation_id}
                  presentation={pres.name}
                  signer={a.signer}
                />
              ) : (
                <p className="text-sm text-text-secondary">
                  Pendiente de la coordinación de producción o el supervisor.
                </p>
              )}
            </Card>
            <div className="grid gap-4">
              <YieldCard />
              <Card title="Rótulo de producto terminado">
                <div className="grid grid-cols-[1fr_96px] gap-3 rounded-md border-2 border-foreground p-3">
                  <div className="grid gap-0.5">
                    <b className="text-[18px] font-semibold">{data.product.name}</b>
                    <span className="text-sm font-medium">Contenido neto {pres.name}</span>
                    <span className="font-mono text-sm">
                      {data.batch.batch_code} · Vence{" "}
                      {data.batch.expiry_date
                        ? `${data.batch.expiry_date.slice(5, 7)}/${data.batch.expiry_date.slice(0, 4)}`
                        : "N.A."}
                    </span>
                    <span className="font-mono text-xs text-text-secondary">
                      {data.product.sanitary_registration ?? "Registro sanitario N.A."} ·{" "}
                      {data.product.titular ?? ""}
                    </span>
                  </div>
                  <span className="flex items-center justify-center border-2 border-foreground bg-[repeating-linear-gradient(45deg,var(--color-divider)_0_6px,transparent_6px_12px)] font-mono text-sm font-semibold">
                    QR lote
                  </span>
                </div>
              </Card>
            </div>
          </div>
        ) : null}

        {stageCode === "acondicionamiento" && saLines.length ? (
          <Card
            title={`Devolución de material de acondicionamiento · ${pres?.name}`}
            subtitle="Entregado = usado + dañado + devuelto (D-48)"
          >
            {saLines.map((l) => {
              const r = data.returns.find((x) => x.request_line_id === l.id);
              return r ? (
                <p
                  key={l.id}
                  className="flex flex-wrap items-center gap-2 text-sm"
                  data-testid={`return-done-${l.materials?.code}`}
                >
                  <b className="font-semibold">{l.materials?.name}</b>
                  <StatusBadge
                    status="vigente"
                    label={`Cuadra: ${formatNumber(Number(r.used), 0)} + ${formatNumber(Number(r.damaged), 0)} + ${formatNumber(Number(r.returned), 0)} = ${formatNumber(Number(r.delivered), 0)}`}
                  />
                </p>
              ) : running && a.execute ? (
                <ReturnForm
                  key={l.id}
                  batchId={id}
                  lineId={l.id}
                  material={l.materials?.code ?? ""}
                  delivered={Number(l.required_qty)}
                  signer={a.signer}
                />
              ) : null;
            })}
          </Card>
        ) : null}
      </StageShell>
    </main>
  );

  // Rendimiento y conciliación (S-19d, S-20, S-21) con barra de límites y, en fabricación, el rótulo del granel.
  function YieldCard() {
    const isPt = stageCode === "acondicionamiento";
    const transfer = data.transfers.find((t) => t.from_stage === "fabricacion");
    return (
      <Card
        title={
          isPt
            ? `Unidades · ${pres?.name}`
            : stageCode === "fabricacion"
              ? "Transferencia de granel y conciliación"
              : `Conciliación de rendimiento · ${pres?.name}`
        }
        testId="yield"
      >
        {output ? (
          <div className="grid gap-3" data-testid="yield-result">
            {isPt ? (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    [output.received, "Envasadas"],
                    [output.rejected, "Rechazadas"],
                    [output.retained, "Retención"],
                    [output.actual, "Aprobadas"],
                  ].map(([v, t], k) => (
                    <span
                      key={String(t)}
                      className={cn(
                        "grid justify-items-center rounded-md border border-border py-2",
                        k === 3 && "bg-primary-soft/50",
                      )}
                    >
                      <b className="text-[20px]">{formatNumber(Number(v), 0)}</b>
                      <span className="text-xs text-text-secondary">{t}</span>
                    </span>
                  ))}
                </div>
                <StatusBadge
                  status="vigente"
                  label={`Cuadra: ${formatNumber(Number(output.received), 0)} − ${formatNumber(Number(output.rejected), 0)} − ${formatNumber(Number(output.retained), 0)} = ${formatNumber(Number(output.actual), 0)}`}
                />
              </>
            ) : (
              <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
                <dt className="text-text-secondary">
                  {stageCode === "fabricacion" ? "Granel teórico" : "Unidades teóricas"}
                </dt>
                <dd className="text-right font-semibold">
                  {formatNumber(Number(output.theoretical), stageCode === "fabricacion" ? 1 : 0)}{" "}
                  {output.unit}
                </dd>
                <dt className="text-text-secondary">
                  {stageCode === "fabricacion" ? "Granel obtenido" : "Envasadas"}
                </dt>
                <dd className="text-right font-semibold">
                  {formatNumber(Number(output.actual), stageCode === "fabricacion" ? 1 : 0)}{" "}
                  {output.unit}
                </dd>
                {stageCode === "fabricacion" ? (
                  <>
                    <dt className="text-text-secondary">Asignado</dt>
                    <dd className="text-right font-semibold">
                      {data.order.presentations
                        .map((x) => `${x.name}: ${formatNumber(x.bulk_qty, 1)} kg`)
                        .join(" + ")}
                    </dd>
                    <dt className="text-text-secondary">Remanente</dt>
                    <dd className="text-right font-semibold">
                      {formatNumber(Number(output.remnant), 1)} kg
                    </dd>
                  </>
                ) : null}
              </dl>
            )}
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-label text-text-secondary uppercase">
                {isPt ? "Rendimiento PT" : "Rendimiento"}
              </span>
              <b className="text-[30px] leading-9">{formatNumber(Number(output.pct), 1)} %</b>
              <StatusBadge
                status={output.within_limits ? "vigente" : "vencido"}
                label={
                  output.limit_min != null
                    ? output.within_limits
                      ? `≥ ${formatNumber(Number(output.limit_min), 1)} % · cumple`
                      : "Fuera de límites: exige desviación"
                    : "Sin límite definido (D-71)"
                }
              />
            </div>
            <YieldBar
              pct={Number(output.pct)}
              min={output.limit_min != null ? Number(output.limit_min) : null}
              from={90}
              to={104}
            />
            {stageCode === "fabricacion" && transfer ? (
              <div className="rounded-md border-2 border-foreground">
                <p className="flex justify-between border-b-2 border-foreground px-3 py-1.5 text-xs font-semibold uppercase">
                  <span>Granel · rótulo</span>
                  <span className="font-mono">{transfer.label_code}</span>
                </p>
                <div className="grid gap-0.5 px-3 py-2">
                  <b className="text-[18px]">{data.product.name}</b>
                  <b className="font-mono text-[24px]">
                    {formatNumber(Number(transfer.qty), 1)} {transfer.unit}
                  </b>
                  <span className="font-mono text-sm">{data.batch.batch_code}</span>
                  <span className="text-xs text-text-secondary">
                    {data.order.presentations
                      .map((x) => `${x.name}: ${formatNumber(x.bulk_qty, 1)} kg`)
                      .join(" · ")}{" "}
                    · remanente {formatNumber(Number(output.remnant), 1)} kg
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : running && a.execute ? (
          <OutputForm
            key={`${stageCode}-${presId}`}
            batchId={id}
            stageOrderId={stage.id}
            presentationId={presId}
            stage={stageCode}
            theoretical={
              stageCode === "fabricacion" ? Number(data.batch.batch_size) : (pres?.units ?? 0)
            }
            unit={stageCode === "fabricacion" ? data.batch.batch_unit : "und"}
            received={isPt ? (envaseOut ? Number(envaseOut.actual) : null) : null}
            minPct={isPt ? minPt : null}
            signer={a.signer}
          />
        ) : (
          <p className="text-sm text-text-secondary">Se registra durante la etapa.</p>
        )}
      </Card>
    );
  }
}
