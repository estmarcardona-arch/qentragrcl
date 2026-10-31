import type { Metadata } from "next";
import Link from "next/link";
import { NoPermissionState } from "@/components/common/state-card";
import { BatchHeader } from "@/components/production/batch-header";
import { ClearanceForm, VerifyButton } from "@/components/production/prep-forms";
import { Stamps } from "@/components/production/stamps";
import { trainingNotice } from "@/lib/production/batch";
import { STAGE_LABELS } from "@/lib/production/labels";
import { batchPage } from "@/lib/production/page";

export const metadata: Metadata = { title: "Despeje de línea · GRUFARCOL eBR" };

// S-17 · Prealistamiento y despeje de línea por etapa (RF-32): ejecuta el auxiliar y verifica otra persona
// (coordinación o supervisión, D-46). Sin despeje verificado la etapa no inicia (CLEARANCE_MISSING, AC-04).
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
  const { data: tplSteps } = despeje?.template_id
    ? await a.supabase
        .from("process_template_steps")
        .select("text, order_no")
        .eq("template_id", despeje.template_id)
        .eq("checklist_item", true)
        .order("order_no")
    : { data: [] };
  const items = (tplSteps ?? []).map((s) => s.text);
  const clearance = data.clearances.find((c) => c.stage_order_id === stage.id);
  const training = await trainingNotice(a, despeje?.version_id);
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <BatchHeader
        data={data}
        title={`Despeje de línea · ${label}`}
        current="despeje"
        stage="despeje"
        training={training}
      />
      <nav aria-label="Área" className="flex flex-wrap gap-1.5">
        {data.stages.map((s) => (
          <Link
            key={s.id}
            href={`/produccion/lotes/${id}/despeje?etapa=${s.stage}`}
            aria-current={s.id === stage.id ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[14px] no-underline ${s.id === stage.id ? "border-primary bg-primary font-semibold text-white" : "border-border-control bg-white"}`}
          >
            {STAGE_LABELS[s.stage]}
          </Link>
        ))}
      </nav>
      <section
        className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
        aria-labelledby="ck"
      >
        <h2 id="ck" className="text-card-title">
          Lista de despeje · {label} ({stage.code})
        </h2>
        {clearance ? (
          <>
            <ul className="grid gap-1.5 text-[15px]" data-testid="clearance-done">
              {(clearance.checklist as { item: string; ok: boolean }[]).map((c) => (
                <li key={c.item}>✓ {c.item}</li>
              ))}
            </ul>
            <Stamps
              executedBy={clearance.executedBy}
              executedAt={clearance.executed_at}
              verifiedBy={clearance.verifiedBy}
              verifiedAt={clearance.verified_at}
            />
            {clearance.status !== "verificado" ? (
              clearance.executed_by === a.ctx.userId ? (
                <p
                  role="status"
                  className="rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm"
                >
                  Usted ejecutó el despeje: lo verifica otra persona (coordinación o supervisión).
                </p>
              ) : a.sign ? (
                <div>
                  <VerifyButton
                    kind="clearance"
                    batchId={id}
                    recordId={clearance.id}
                    label="Verificar despeje"
                    title={`Verificar despeje · ${label}`}
                    summary={[{ label: "Ejecutó", value: clearance.executedBy }]}
                    signer={a.signer}
                    testId="verify-clearance"
                  />
                </div>
              ) : null
            ) : null}
          </>
        ) : stage.status !== "pendiente" ? (
          <p className="text-sm text-text-secondary">La etapa ya inició.</p>
        ) : a.execute ? (
          items.length ? (
            <ClearanceForm
              batchId={id}
              stageOrderId={stage.id}
              stageLabel={label}
              items={items}
              signer={a.signer}
            />
          ) : (
            <p role="alert" className="text-sm text-q-bad-fg">
              La orden no tiene congelado el formato de despeje; la etapa no puede despejarse.
            </p>
          )
        ) : (
          <p className="text-sm text-text-secondary">
            Pendiente de que el auxiliar de producción ejecute el despeje.
          </p>
        )}
      </section>
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
