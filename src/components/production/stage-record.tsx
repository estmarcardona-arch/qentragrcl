import { CircleX, Lock } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { formatNumber } from "@/lib/format";
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
import { Stamps } from "./stamps";
import { StepCard } from "./step-card";

type Value = {
  name: string;
  unit?: string;
  min?: number | null;
  max?: number | null;
  value: number;
  in_range: boolean;
};

/**
 * S-19 · S-20 · S-21: registro de fabricación, envase (por presentación, con control de peso) y acondicionamiento
 * (codificado, inspección de 9 puntos, rendimiento PT y devolución). Pasos de la versión congelada; firma por paso.
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
  const [equipment, training, now, interval, limits] = await Promise.all([
    loadEquipment(a),
    trainingNotice(a, stage.governing_version_id),
    callRpc(a.supabase, "reference_now").catch(() => new Date(0).toISOString()),
    a.supabase
      .from("app_settings")
      .select("value")
      .eq("key", "in_process_control_interval_minutes")
      .maybeSingle(),
    stageCode === "envase" && presId
      ? callRpc(a.supabase, "production_fill_limits", {
          p_stage_order: stage.id,
          p_presentation: presId,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);
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
  const outputs = data.outputs.filter((o) => o.stage_order_id === stage.id);
  const output = outputs.find((o) => (o.presentation_id ?? null) === presId);
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
  const minPt = Number(
    (
      await a.supabase
        .from("app_settings")
        .select("value")
        .eq("key", "yield_min_pt_pct")
        .maybeSingle()
    ).data?.value ?? 97,
  );
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <BatchHeader
        data={data}
        title={`Registro de ${label.toLowerCase()}`}
        current={stageCode}
        stage={stageCode}
        training={training}
      />
      <StageShell a={a} data={data} stage={stage}>
        {byPres ? (
          <nav aria-label="Presentación" className="flex flex-wrap gap-1.5" role="tablist">
            {data.order.presentations.map((x) => (
              <Link
                key={x.presentation_id}
                role="tab"
                aria-selected={x.presentation_id === presId}
                href={`/produccion/lotes/${id}/${stageCode}?pres=${x.presentation_id}`}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-[14px] no-underline",
                  x.presentation_id === presId
                    ? "border-primary bg-primary font-semibold text-white"
                    : "border-border-control bg-white",
                )}
              >
                {x.name} · {formatNumber(x.units, 0)} und
              </Link>
            ))}
          </nav>
        ) : null}
        {stageCode === "acondicionamiento" && data.coding ? (
          <section
            className="grid gap-2 rounded-[10px] border border-border bg-surface p-5"
            aria-labelledby="cod"
          >
            <h3 id="cod" className="text-card-title">
              Codificación · {data.coding.code}
            </h3>
            <div className="w-fit rounded-md border-2 border-dashed border-border-control bg-white px-5 py-3 font-mono text-lg">
              <div>{data.coding.batch_code_text}</div>
              <div>{data.coding.expiry_text}</div>
            </div>
            {data.coding.status === "verificada" ? (
              <StatusBadge status="firmada" label="Codificación verificada" />
            ) : running && a.execute ? (
              <div>
                <CodingVerifyButton
                  batchId={id}
                  text={`${data.coding.batch_code_text} · ${data.coding.expiry_text}`}
                  signer={a.signer}
                />
              </div>
            ) : null}
          </section>
        ) : null}
        <div className="grid grid-cols-[280px_1fr] gap-4 max-[1279px]:grid-cols-1">
          <ol
            className="grid content-start gap-1.5"
            aria-label="Pasos del registro"
            data-testid="stepper"
          >
            {steps.map((s) => {
              const done = records.find((r) => r.step_key === s.step_key);
              const isCurrent = current?.step_key === s.step_key;
              return (
                <li
                  key={s.step_key}
                  data-state={done ? "completado" : isCurrent ? "actual" : "pendiente"}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm",
                    done && "border-q-ok-bd bg-q-ok-bg",
                    isCurrent && "border-primary bg-primary-soft font-semibold",
                    !done && !isCurrent && "border-border bg-surface-sunken text-text-secondary",
                  )}
                >
                  <span className="font-mono">{s.label}</span>
                  <span className="flex-1">{s.text}</span>
                  {done ? (
                    <span aria-label="completado">✓</span>
                  ) : !isCurrent ? (
                    <Lock aria-label="bloqueado" className="size-3.5" />
                  ) : null}
                </li>
              );
            })}
            {steps.length === 0 ? (
              <li className="text-sm text-text-secondary">
                Esta etapa no tiene pasos en su formato congelado.
              </li>
            ) : null}
          </ol>
          <div className="grid content-start gap-3">
            {running && a.execute && current ? (
              <StepCard
                key={`${current.step_key}-${presId}`}
                batchId={id}
                stageOrderId={stage.id}
                presentationId={presId}
                step={{
                  ...current,
                  // En envase, el rango del peso neto es el de la presentación (plantilla o tolerancia, D-66).
                  params: (current.params ?? []).map((prm) =>
                    stageCode === "envase" && prm.name === "Peso neto" && limits
                      ? {
                          ...prm,
                          min: Number((limits as { min: number }).min),
                          max: Number((limits as { max: number }).max),
                        }
                      : prm,
                  ),
                }}
                equipment={equipment.map((e) => ({
                  id: e.id,
                  code: e.code,
                  valid: e.valid,
                  reasons: e.reasons,
                }))}
                draft={Object.fromEntries(
                  Object.entries((draft?.values as Record<string, unknown>) ?? {}).map(([k, v]) => [
                    k,
                    String(v ?? ""),
                  ]),
                )}
                signer={a.signer}
              />
            ) : null}
            {records
              .slice()
              .reverse()
              .map((r) => (
                <article
                  key={r.id}
                  className="grid gap-1.5 rounded-[10px] border border-border bg-surface p-4"
                  data-step={r.label}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <b>Paso {r.label}</b>
                    <span className="text-sm">{r.text}</span>
                    {r.out_of_range ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-q-bad-fg">
                        <CircleX aria-hidden className="size-4" /> Fuera de rango: exige desviación
                      </span>
                    ) : null}
                  </div>
                  {((r.values as unknown as Value[]) ?? []).map((v) => (
                    <span key={v.name} className="font-mono text-sm">
                      {v.name}: {formatNumber(Number(v.value), 2)} {v.unit}{" "}
                      {v.in_range ? "" : "(fuera de rango)"}
                    </span>
                  ))}
                  {corrections(r.id).map((c, i) => (
                    <span key={i} className="text-xs text-text-secondary">
                      <s>{JSON.stringify(c.old_value)}</s> → {JSON.stringify(c.new_value)}* ·{" "}
                      {c.reason} · {c.short_signature}
                    </span>
                  ))}
                  {r.equipmentCodes.length ? (
                    <span className="text-xs">Equipos: {r.equipmentCodes.join(", ")}</span>
                  ) : null}
                  <Stamps
                    executedBy={r.executedBy}
                    executedAt={r.executed_at}
                    verifiedBy={r.requires_verification ? r.verifiedBy : r.executedBy}
                    verifiedAt={r.requires_verification ? r.verified_at : r.executed_at}
                    verifyLabel={r.requires_verification ? "Verificó" : "Firmó"}
                  />
                  {r.requires_verification &&
                  r.status !== "verificado" &&
                  a.sign &&
                  r.executed_by !== a.ctx.userId ? (
                    <div>
                      <VerifyButton
                        kind="step"
                        batchId={id}
                        recordId={r.id}
                        label="Verificar paso"
                        title={`Verificar paso ${r.label}`}
                        summary={[
                          { label: "Paso", value: `${r.label} · ${r.text}` },
                          { label: "Ejecutó", value: r.executedBy },
                        ]}
                        signer={a.signer}
                        testId={`verify-step-${r.label}`}
                      />
                    </div>
                  ) : null}
                </article>
              ))}
          </div>
        </div>

        {stageCode === "envase" && pres && limits ? (
          <WeightControlPanel
            key={presId}
            batchId={id}
            stageOrderId={stage.id}
            presentationId={pres.presentation_id}
            presentation={pres.name}
            limits={{
              min: Number((limits as { min: number }).min),
              max: Number((limits as { max: number }).max),
            }}
            rows={
              data.weights.filter(
                (w) => w.stage_order_id === stage.id && w.presentation_id === presId,
              ) as unknown as WeightRow[]
            }
            intervalMin={Number(interval.data?.value ?? 30)}
            now={String(now)}
            canRecord={running && a.execute}
            signer={a.signer}
          />
        ) : null}

        {stageCode === "acondicionamiento" && pres ? (
          <section
            className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
            aria-labelledby="insp"
          >
            <h3 id="insp" className="text-card-title">
              Inspección de producto terminado · {pres.name}
            </h3>
            {inspection ? (
              <>
                <ol className="grid gap-1 text-sm" data-testid="inspection-done">
                  {(
                    inspection.points as {
                      n: number;
                      label: string;
                      result: string;
                      note: string;
                    }[]
                  ).map((x) => (
                    <li key={x.n}>
                      {x.n}. {x.label}:{" "}
                      <b>{x.result === "conforme" ? "Conforme" : "No conforme"}</b>
                      {x.note ? ` · ${x.note}` : ""}
                    </li>
                  ))}
                </ol>
                <span className="text-xs text-text-secondary">Firmó {inspection.inspector}</span>
              </>
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
                La firma el coordinador de producción o el supervisor (D-47).
              </p>
            )}
          </section>
        ) : null}

        <section
          className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
          aria-labelledby="yield"
          data-testid="yield"
        >
          <h3 id="yield" className="text-card-title">
            Rendimiento y conciliación{pres ? ` · ${pres.name}` : " del granel"}
          </h3>
          {output ? (
            <p className="text-sm" data-testid="yield-result">
              {stageCode === "acondicionamiento"
                ? `${formatNumber(Number(output.received), 0)} − ${formatNumber(Number(output.rejected), 0)} − ${formatNumber(Number(output.retained), 0)} = ${formatNumber(Number(output.actual), 0)} unidades aprobadas · `
                : `${formatNumber(Number(output.actual), stageCode === "fabricacion" ? 1 : 0)} ${output.unit} de ${formatNumber(Number(output.theoretical), stageCode === "fabricacion" ? 1 : 0)} · `}
              <b>{formatNumber(Number(output.pct), 1)} %</b>{" "}
              {output.limit_min != null
                ? output.within_limits
                  ? `(dentro del límite ≥ ${formatNumber(Number(output.limit_min), 1)} %)`
                  : "(fuera de límites: exige desviación)"
                : ""}
            </p>
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
              received={
                stageCode === "acondicionamiento"
                  ? envaseOut
                    ? Number(envaseOut.actual)
                    : null
                  : null
              }
              minPct={stageCode === "acondicionamiento" ? minPt : null}
              signer={a.signer}
            />
          ) : (
            <p className="text-sm text-text-secondary">Se registra durante la etapa.</p>
          )}
          {stageCode === "fabricacion"
            ? data.transfers
                .filter((t) => t.from_stage === "fabricacion")
                .map((t) => (
                  <p key={t.id} className="text-sm">
                    Granel transferido a envase: {formatNumber(Number(t.qty), 1)} {t.unit} · rótulo{" "}
                    <span className="font-mono">{t.label_code}</span>
                  </p>
                ))
            : null}
        </section>

        {stageCode === "acondicionamiento" && saLines.length ? (
          <section
            className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
            aria-labelledby="dev"
          >
            <h3 id="dev" className="text-card-title">
              Devolución de material de acondicionamiento · {pres?.name}
            </h3>
            {saLines.map((l) => {
              const r = data.returns.find((x) => x.request_line_id === l.id);
              return r ? (
                <p key={l.id} className="text-sm" data-testid={`return-done-${l.materials?.code}`}>
                  {l.materials?.name}: cuadra {formatNumber(Number(r.used), 0)} +{" "}
                  {formatNumber(Number(r.damaged), 0)} + {formatNumber(Number(r.returned), 0)} ={" "}
                  {formatNumber(Number(r.delivered), 0)}
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
          </section>
        ) : null}
      </StageShell>
    </main>
  );
}
