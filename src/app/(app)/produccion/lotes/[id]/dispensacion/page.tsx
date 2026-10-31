import type { Metadata } from "next";
import { ChevronDown, Lock } from "lucide-react";
import { cn } from "cn";
import { NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { BatchHeader } from "@/components/production/batch-header";
import { AddLotForm, SumIndicator, type LotOption } from "@/components/production/dispense-line";
import { CompleteStageButton, VerifyButton } from "@/components/production/prep-forms";
import { StageShell } from "@/components/production/stage-shell";
import { Card, CodeChip } from "@/components/production/ui";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { loadEquipment, trainingNotice } from "@/lib/production/batch";
import { STAGE_STATUS } from "@/lib/production/labels";
import { batchPage } from "@/lib/production/page";

export const metadata: Metadata = { title: "Dispensación · GRUFARCOL eBR" };

type Line = {
  id: string;
  order_no: number;
  required_qty: number;
  unit: string;
  material_id: string;
  materials: { code: string; name: string } | null;
};

// S-18 · Dispensación multi-lote (RF-33; diseño «Dispensación S-18»): cada materia prima es una línea desplegable con sus
// sublíneas de lote (balanza, peso, tara, neto, hora y firmas); solo lotes aprobados y vigentes por FEFO, balanza
// válida y verificación de otra persona (SOD-4).
export default async function DispensingPage({
  params,
}: PageProps<"/produccion/lotes/[id]/dispensacion">) {
  const { id } = await params;
  const p = await batchPage(id);
  if (!p) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a Producción" />
      </main>
    );
  }
  const { a, data } = p;
  const stage = data.stages.find((s) => s.stage === "dispensacion")!;
  const req = data.requests.find((r) => r.type === "dispensacion");
  const lines = ((req?.material_request_lines as Line[] | null) ?? []).sort(
    (x, y) => x.order_no - y.order_no,
  );
  const [{ data: lots }, equipment, training] = await Promise.all([
    a.supabase
      .from("v_lot_stock")
      .select(
        "id, internal_code, material_id, status, effective_status, expiry_date, qty_on_hand, status_reason",
      )
      .in(
        "material_id",
        lines.map((l) => l.material_id),
      )
      .gt("qty_on_hand", 0)
      .order("expiry_date"),
    loadEquipment(a),
    trainingNotice(a, stage.governing_version_id),
  ]);
  const balances = equipment.filter((e) => e.type === "balanza");
  const reasonOf = (l: {
    effective_status: unknown;
    expiry_date: unknown;
    status_reason?: unknown;
  }) =>
    l.effective_status === "aprobado"
      ? null
      : l.effective_status === "vencido"
        ? `vencido el ${formatDate(String(l.expiry_date))}`
        : l.effective_status === "cuarentena"
          ? "en cuarentena"
          : `${String(l.effective_status)}${l.status_reason ? `: ${String(l.status_reason)}` : ""}`;
  const lotOptions = (materialId: string): LotOption[] =>
    (lots ?? [])
      .filter((l) => l.material_id === materialId)
      .map((l) => ({
        id: String(l.id),
        code: String(l.internal_code),
        expiry: formatDate(String(l.expiry_date)),
        qty: Number(l.qty_on_hand),
        status: String(l.effective_status),
        reason: reasonOf(l),
      }));
  const blockedLots = (lots ?? []).filter((l) => l.effective_status !== "aprobado");
  const lineState = (l: Line) => {
    const done = data.lots.filter((x) => x.request_line_id === l.id);
    const sum = done.reduce((s, x) => s + Number(x.qty), 0);
    const complete = Math.abs(sum - Number(l.required_qty)) < 0.0001;
    const verified = done.length > 0 && done.every((x) => x.status === "verificado");
    const available = lotOptions(l.material_id).some((o) => !o.reason);
    return { done, sum, complete, verified, available };
  };
  const completed = lines.filter((l) => lineState(l).complete).length;
  const last = data.lots.at(-1);
  const st = STAGE_STATUS[stage.status] ?? STAGE_STATUS.pendiente;
  const th = "px-3 py-2 text-label uppercase";
  return (
    <main className="grid content-start gap-5 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <BatchHeader
        data={data}
        title="Dispensación"
        current="dispensacion"
        stage="dispensacion"
        training={training}
      />
      <StageShell a={a} data={data} stage={stage} hideComplete>
        <Card>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <CodeChip size="lg">{data.batch.batch_code}</CodeChip>
            <div className="grid">
              <b className="text-[17px] font-semibold">Dispensación · {data.product.name}</b>
              <span className="text-sm text-text-secondary">
                {data.order.code} · {stage.code} · lote de{" "}
                {formatNumber(Number(data.batch.batch_size), 1)} {data.batch.batch_unit}
              </span>
            </div>
            <StatusBadge status={st.status} label={st.label} size="lg" />
            <span className="text-sm text-text-secondary" data-testid="dispensing-progress">
              {completed} de {lines.length} líneas completadas
              {last ? ` · ${formatTime(last.executed_at)}` : ""}
            </span>
            {stage.status === "en_curso" && a.execute ? (
              <span className="ml-auto">
                <CompleteStageButton
                  batchId={id}
                  stageOrderId={stage.id}
                  code={stage.code}
                  label="Dispensación"
                  signer={a.signer}
                />
              </span>
            ) : null}
          </div>
        </Card>

        <section
          className="overflow-hidden rounded-[10px] border border-border bg-surface"
          aria-label="Líneas de dispensación"
          data-testid="dispensing"
        >
          <div className="grid grid-cols-[32px_1fr_150px_150px_150px] gap-3 bg-surface-sunken px-4 py-3 text-label uppercase max-[1023px]:hidden">
            <span />
            <span>Materia prima</span>
            <span className="text-right">Requerida</span>
            <span className="text-right">Dispensada</span>
            <span>Estado</span>
          </div>
          {lines.map((l) => {
            const s = lineState(l);
            const code = l.materials?.code ?? "";
            const open = stage.status === "en_curso" && (!s.complete || !s.verified);
            const status = s.complete
              ? s.verified
                ? { status: "completada" as const, label: "Completada" }
                : { status: "en_revision" as const, label: "Por verificar" }
              : s.done.length
                ? { status: "en_curso" as const, label: "En curso" }
                : !s.available
                  ? { status: "bloqueada" as const, label: "Bloqueada" }
                  : { status: "pendiente" as const, label: "Pendiente" };
            const blockedText =
              !s.available && !s.done.length
                ? `Sin lote disponible${blockedLots.find((b) => b.material_id === l.material_id) ? `: ${blockedLots.find((b) => b.material_id === l.material_id)?.internal_code} está ${blockedLots.find((b) => b.material_id === l.material_id)?.effective_status}` : ""}`
                : null;
            return (
              <details
                key={l.id}
                open={open}
                className={cn(
                  "group border-t border-divider",
                  open && "border-l-4 border-l-primary bg-primary-soft/20",
                )}
                data-code={code}
              >
                <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[32px_1fr_150px_150px_150px] items-center gap-3 px-4 py-2 max-[1023px]:grid-cols-[32px_1fr]">
                  <ChevronDown
                    aria-hidden
                    className="size-5 -rotate-90 transition-transform group-open:rotate-0"
                  />
                  <span>
                    <b className="font-semibold">{l.materials?.name}</b>{" "}
                    <span className="font-mono text-xs text-text-secondary">{code}</span>
                    <span className="block text-xs text-text-secondary">
                      {blockedText ??
                        (s.done.length
                          ? s.done.map((x) => x.lotCode).join(" · ")
                          : "Sin lote asignado")}
                    </span>
                  </span>
                  <span className="text-right font-mono font-semibold">
                    {formatNumber(Number(l.required_qty), 2)} {l.unit}
                  </span>
                  <span className="text-right font-mono font-semibold">
                    {formatNumber(s.sum, 2)} {l.unit}
                  </span>
                  <span>
                    <StatusBadge status={status.status} label={status.label} />
                  </span>
                </summary>
                <div className="grid gap-3 px-4 pb-4 pl-12">
                  <div className="flex flex-wrap items-center gap-3">
                    <SumIndicator
                      dispensed={s.sum}
                      required={Number(l.required_qty)}
                      unit={l.unit}
                    />
                    <span className="text-sm text-text-secondary">
                      {s.complete
                        ? "Coincide con lo requerido: se puede completar la línea."
                        : !s.available
                          ? "No hay un lote que se pueda elegir."
                          : "Agregue lotes hasta completar lo requerido."}
                    </span>
                  </div>
                  {s.done.length ? (
                    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-surface-sunken">
                          <tr>
                            {[
                              "#",
                              "Lote de insumo",
                              "Balanza",
                              "Peso registrado",
                              "Tara",
                              "Neto",
                              "Hora",
                              "Firmas",
                              "",
                            ].map((h) => (
                              <th key={h} scope="col" className={th}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {s.done.map((x, i) => (
                            <tr
                              key={x.id}
                              className="border-t border-divider align-top"
                              data-lot={x.lotCode}
                            >
                              <td className="px-3 py-2.5">
                                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                                  {i + 1}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <b className="font-mono font-semibold">{x.lotCode}</b>
                                <span className="block">
                                  <StatusBadge status="aprobado" label="Aprobado" />
                                </span>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs">{x.balanceCode}</td>
                              <td className="px-3 py-2.5 text-right font-mono">
                                {formatNumber(Number(x.qty) + Number(x.tare ?? 0), 2)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono">
                                {formatNumber(Number(x.tare ?? 0), 2)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-semibold">
                                {formatNumber(Number(x.qty), 2)}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs">
                                {formatTime(x.executed_at)}
                              </td>
                              <td className="px-3 py-2.5 text-xs">
                                Dispensó {x.executedBy}
                                <span className="block">
                                  {x.verifiedBy
                                    ? `Verificó ${x.verifiedBy}`
                                    : "Pendiente de verificación"}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                {x.status !== "verificado" && a.sign ? (
                                  <VerifyButton
                                    kind="dispensing"
                                    batchId={id}
                                    recordId={x.id}
                                    label="Verificar"
                                    title={`Verificar dispensación · ${l.materials?.name}`}
                                    summary={[
                                      { label: "Lote", value: x.lotCode, mono: true },
                                      {
                                        label: "Neto",
                                        value: `${formatNumber(Number(x.qty), 2)} ${l.unit}`,
                                        mono: true,
                                      },
                                      { label: "Balanza", value: x.balanceCode, mono: true },
                                      { label: "Dispensó", value: x.executedBy },
                                    ]}
                                    signer={a.signer}
                                    testId={`verify-${x.lotCode}`}
                                  />
                                ) : x.status === "verificado" ? (
                                  <StatusBadge status="firmada" label="Verificada" />
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {stage.status === "en_curso" && a.execute && s.sum < Number(l.required_qty) ? (
                    <AddLotForm
                      key={`${l.id}-${s.sum}`}
                      batchId={id}
                      lineId={l.id}
                      index={s.done.length + 1}
                      material={code}
                      materialName={l.materials?.name ?? code}
                      unit={l.unit}
                      required={Number(l.required_qty)}
                      dispensed={s.sum}
                      lots={lotOptions(l.material_id)}
                      balances={balances}
                      signer={a.signer}
                    />
                  ) : null}
                </div>
              </details>
            );
          })}
        </section>

        {blockedLots.length ? (
          <Card
            title="Lotes que nunca se pueden elegir"
            subtitle="Aparecen apagados en el selector, con su motivo"
          >
            <table className="w-full text-left text-sm">
              <tbody>
                {blockedLots.map((b) => (
                  <tr key={String(b.id)} className="border-t border-divider first:border-0">
                    <td className="w-8 py-2.5">
                      <Lock aria-hidden className="size-4 text-text-secondary" />
                    </td>
                    <td className="py-2.5 font-mono font-semibold">{b.internal_code}</td>
                    <td className="py-2.5">
                      {lines.find((l) => l.material_id === b.material_id)?.materials?.name}
                    </td>
                    <td className="py-2.5">
                      <StatusBadge
                        status={
                          b.effective_status === "cuarentena"
                            ? "cuarentena"
                            : b.effective_status === "vencido"
                              ? "vencido"
                              : "rechazado"
                        }
                        label={
                          b.effective_status === "cuarentena"
                            ? "Cuarentena"
                            : b.effective_status === "vencido"
                              ? "Vencido"
                              : "Rechazado"
                        }
                      />
                    </td>
                    <td className="py-2.5 text-text-secondary">
                      {b.effective_status === "cuarentena"
                        ? "No se dispensa hasta que Control de calidad lo libere."
                        : b.effective_status === "vencido"
                          ? `Venció el ${formatDate(String(b.expiry_date))}.`
                          : String(b.status_reason ?? "Rechazado por Control de calidad.")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : null}
      </StageShell>
    </main>
  );
}
