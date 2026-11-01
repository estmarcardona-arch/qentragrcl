import type { Metadata } from "next";
import { Lock } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { NoPermissionState } from "@/components/common/state-card";
import { SodNotice } from "@/components/gxp/sod-notice";
import { StatusBadge } from "@/components/gxp/status-badge";
import { BatchHeader } from "@/components/production/batch-header";
import { ClearanceForm, StartStageButton, VerifyButton } from "@/components/production/prep-forms";
import { Card, GmpBlock, Seals } from "@/components/production/ui";
import { Button } from "@/components/ui/button";
import { loadEquipment, trainingNotice } from "@/lib/production/batch";
import { STAGE_LABELS, STAGE_STATUS } from "@/lib/production/labels";
import { batchPage } from "@/lib/production/page";
import { callRpc } from "@/lib/rpc";

export const metadata: Metadata = { title: "Despeje de línea · GRUFARCOL eBR" };

// S-17 · Prealistamiento y despeje de línea por área (RF-32; diseño «Producción S-15 a S-17»): ejecuta el auxiliar y
// verifica otra persona (coordinación o supervisión, D-46). Sin despeje verificado la etapa no inicia (AC-04).
export default async function ClearancePage({
  params,
  searchParams,
}: PageProps<"/produccion/lotes/[id]/despeje">) {
  const { id } = await params;
  const sp = await searchParams;
  const p = await batchPage(id);
  if (!p) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a Producción" />
      </main>
    );
  }
  const { a, data } = p;
  const stage =
    data.stages.find((s) => s.stage === sp.etapa) ??
    data.stages.find((s) => s.status !== "completada") ??
    data.stages[0];
  const label = STAGE_LABELS[stage.stage];
  const despeje = data.order.frozen_documents.find(
    (d) => d.kind === "plantilla" && d.stage === "despeje",
  );
  const [{ data: tplSteps }, training, equipment, now] = await Promise.all([
    despeje?.template_id
      ? a.supabase
          .from("process_template_steps")
          .select("text, order_no")
          .eq("template_id", despeje.template_id)
          .eq("checklist_item", true)
          .order("order_no")
      : Promise.resolve({ data: [] }),
    trainingNotice(a, despeje?.version_id),
    loadEquipment(a),
    callRpc(a.supabase, "reference_now").catch(() => new Date(0).toISOString()),
  ]);
  const items = (tplSteps ?? []).map((s) => s.text);
  const clearance = data.clearances.find((c) => c.stage_order_id === stage.id);
  const required = [
    ...new Set(
      (data.stageSteps[stage.id] ?? [])
        .flatMap((s) => (s.requires_equipment ?? "").split(","))
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ];
  const stageEquipment = equipment.filter((e) => required.includes(e.code));
  const cleaningOk = data.cleanings.some(
    (c) => c.stage_order_id === stage.id && c.status === "verificado",
  );
  const verified = clearance?.status === "verificado";
  const prev = data.stages.find((s) => s.order_no === stage.order_no - 1);
  const prevOk = !prev || prev.status === "completada";
  return (
    <main className="grid content-start gap-5 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <BatchHeader
        data={data}
        title="Despeje de línea"
        current="despeje"
        stage="despeje"
        training={training}
        subtitle={`${data.batch.batch_code} · ${data.order.code} · una lista por área`}
      />

      <nav
        aria-label="Área"
        className="flex flex-wrap gap-1 rounded-[10px] border border-border bg-surface px-3 pt-2"
      >
        {data.stages.map((s) => {
          const st = STAGE_STATUS[s.status] ?? STAGE_STATUS.pendiente;
          const locked =
            s.status === "pendiente" &&
            !data.clearances.some((c) => c.stage_order_id === s.id && c.status === "verificado");
          return (
            <Link
              key={s.id}
              href={`/produccion/lotes/${id}/despeje?etapa=${s.stage}`}
              aria-current={s.id === stage.id ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-12 items-center gap-2 border-b-2 px-4 text-[15px] no-underline",
                s.id === stage.id
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-text-strong",
              )}
            >
              {STAGE_LABELS[s.stage]}
              <StatusBadge
                status={locked ? "bloqueada" : st.status}
                label={locked ? "Bloqueada" : st.label}
              />
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-[1fr_400px] items-start gap-5 max-[1279px]:grid-cols-1">
        <Card
          title={`Despeje de línea · ${label}`}
          subtitle={
            clearance
              ? `Ejecutado por ${clearance.executedBy}.${verified ? ` Verificado por ${clearance.verifiedBy}.` : " Falta la verificación."}`
              : `${data.batch.batch_code} · ${stage.code}`
          }
        >
          {clearance ? (
            <ul
              className="grid divide-y divide-divider rounded-[10px] border border-border"
              data-testid="clearance-done"
            >
              {(clearance.checklist as { item: string; ok: boolean }[]).map((c) => (
                <li key={c.item} className="flex min-h-12 items-center gap-3 px-4 py-2 text-[15px]">
                  <input
                    type="checkbox"
                    checked
                    readOnly
                    aria-label={c.item}
                    className="size-6 accent-primary"
                  />
                  <span className="flex-1">{c.item}</span>
                  <StatusBadge status="completada" label="Completada" />
                </li>
              ))}
            </ul>
          ) : stage.status !== "pendiente" ? (
            <p className="text-sm text-text-secondary">La etapa ya inició.</p>
          ) : a.execute ? (
            items.length ? (
              <ClearanceForm
                batchId={id}
                stageOrderId={stage.id}
                stageLabel={label}
                items={items}
                equipment={stageEquipment}
                now={String(now)}
                signer={a.signer}
              />
            ) : (
              <GmpBlock
                rule="La orden no tiene congelado el formato de despeje de línea."
                action="Solicite a Aseguramiento de la calidad el formato vigente."
              />
            )
          ) : (
            <p className="text-sm text-text-secondary">
              Pendiente de que el auxiliar de producción ejecute el despeje.
            </p>
          )}
        </Card>

        <aside className="grid gap-4">
          <Card title="Sellos de firma">
            <Seals
              executedBy={clearance?.executedBy}
              executedAt={clearance?.executed_at}
              verifiedBy={clearance?.verifiedBy}
              verifiedAt={clearance?.verified_at}
              note={
                clearance && !verified
                  ? "Falta el verificador: coordinador o supervisor, distinto de quien ejecutó."
                  : undefined
              }
            />
          </Card>
          {clearance && !verified ? (
            clearance.executed_by === a.ctx.userId ? (
              <SodNotice
                title="No puede verificar este despeje"
                reason={`Usted ejecutó el despeje de ${label}. Por segregación de funciones, la verificación la hace otra persona.`}
                who="Puede verificar: coordinación de producción o un supervisor."
              />
            ) : a.sign ? (
              <VerifyButton
                kind="clearance"
                batchId={id}
                recordId={clearance.id}
                label="Verificar y firmar"
                title={`Verificar despeje · ${label}`}
                summary={[
                  {
                    label: "Ítems cumplidos",
                    value: `${(clearance.checklist as unknown[]).length} de ${(clearance.checklist as unknown[]).length}`,
                  },
                  { label: "Ejecutó", value: clearance.executedBy },
                  { label: "Lote", value: data.batch.batch_code, mono: true },
                ]}
                signer={a.signer}
                testId="verify-clearance"
              />
            ) : null
          ) : null}
          {stage.status === "pendiente" && a.execute ? (
            verified && cleaningOk && prevOk ? null : (
              <>
                <Button size="lg" disabled className="min-h-12">
                  <Lock aria-hidden /> Iniciar {label.toLowerCase()}
                </Button>
                <GmpBlock
                  tone="neutral"
                  rule={
                    !prevOk
                      ? `Primero se completa ${STAGE_LABELS[prev!.stage].toLowerCase()}.`
                      : !verified
                        ? `No se puede iniciar ${label.toLowerCase()} sin despeje de línea verificado.`
                        : `No se puede iniciar ${label.toLowerCase()} sin la limpieza de equipos y utensilios verificada.`
                  }
                  action={
                    !prevOk
                      ? `Complete la etapa de ${STAGE_LABELS[prev!.stage].toLowerCase()}.`
                      : !verified
                        ? clearance
                          ? "Pida a la coordinación de producción que verifique y firme el despeje."
                          : "Diligencie la lista y firme la ejecución."
                        : "Registre y verifique la limpieza de equipos y utensilios."
                  }
                >
                  {verified && !cleaningOk ? (
                    <Link
                      href={`/produccion/lotes/${id}/limpieza?etapa=${stage.stage}`}
                      className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-white no-underline"
                    >
                      Ir a la limpieza
                    </Link>
                  ) : null}
                </GmpBlock>
              </>
            )
          ) : null}
          {stage.status === "pendiente" && a.execute && verified && cleaningOk && prevOk ? (
            <StartStageButton batchId={id} stageOrderId={stage.id} label={label} />
          ) : null}
        </aside>
      </div>
      <p className="text-sm">
        Siguiente:{" "}
        <Link
          href={`/produccion/lotes/${id}/limpieza?etapa=${stage.stage}`}
          className="font-semibold"
        >
          limpieza de equipos y utensilios de {label.toLowerCase()}
        </Link>
      </p>
    </main>
  );
}
