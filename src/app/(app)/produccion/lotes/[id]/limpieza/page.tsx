import type { Metadata } from "next";
import { CircleX } from "lucide-react";
import Link from "next/link";
import { NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { BatchHeader } from "@/components/production/batch-header";
import { CleaningForm, VerifyButton } from "@/components/production/prep-forms";
import { Stamps } from "@/components/production/stamps";
import { formatDateTime } from "@/lib/format";
import { loadEquipment } from "@/lib/production/batch";
import { STAGE_LABELS } from "@/lib/production/labels";
import { batchPage } from "@/lib/production/page";
import { callRpc } from "@/lib/rpc";

export const metadata: Metadata = { title: "Limpieza de equipos y utensilios · GRUFARCOL eBR" };

// S-39 · Limpieza de equipos y utensilios antes de cada etapa (RF-39): rótulo verificado, vigencia y sellos. La
// limpieza de un equipo queda también en su hoja de vida; sin limpieza vigente el equipo no se usa (EQUIPMENT_NOT_VALID).
export default async function CleaningPage({
  params,
  searchParams,
}: PageProps<"/produccion/lotes/[id]/limpieza">) {
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
  const [equipment, now] = await Promise.all([
    loadEquipment(a),
    callRpc(a.supabase, "reference_now").catch(() => null),
  ]);
  const nowMs = now ? Date.parse(String(now)) : 0;
  const required = [
    ...new Set(
      (data.stageSteps[stage.id] ?? [])
        .flatMap((s) => (s.requires_equipment ?? "").split(","))
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ];
  const blocked = equipment.filter((e) => required.includes(e.code) && !e.valid);
  const records = data.cleanings.filter((c) => c.stage_order_id === stage.id);
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <BatchHeader data={data} title={`Limpieza · ${label}`} current="despeje" />
      <nav aria-label="Área" className="flex flex-wrap gap-1.5">
        {data.stages.map((s) => (
          <Link
            key={s.id}
            href={`/produccion/lotes/${id}/limpieza?etapa=${s.stage}`}
            aria-current={s.id === stage.id ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[14px] no-underline ${s.id === stage.id ? "border-primary bg-primary font-semibold text-white" : "border-border-control bg-white"}`}
          >
            {STAGE_LABELS[s.stage]}
          </Link>
        ))}
      </nav>
      {blocked.map((e) => (
        <p
          key={e.id}
          role="alert"
          className="flex flex-wrap items-start gap-2 rounded-lg border border-q-bad-bd bg-q-bad-bg px-3.5 py-2.5 text-sm text-q-bad-fg"
          data-testid="equipment-blocked"
        >
          <CircleX aria-hidden className="mt-0.5 size-4" />
          <span>
            <b>{e.code}</b> no está apto ({e.reasons.join("; ")}): no puede usarse en el registro de{" "}
            {label.toLowerCase()}. Registre la limpieza o use otro equipo.
          </span>
        </p>
      ))}
      <section
        className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
        aria-labelledby="rec"
      >
        <h2 id="rec" className="text-card-title">
          Limpiezas de {label.toLowerCase()} ({stage.code})
        </h2>
        {records.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Aún no hay limpiezas registradas para esta etapa.
          </p>
        ) : (
          <ul className="grid gap-3" data-testid="cleanings">
            {records.map((c) => (
              <li key={c.id} className="grid gap-1.5 border-b border-divider pb-3 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">
                    {c.equipmentCode ?? "Utensilios"}
                  </span>
                  <span className="text-sm">{(c.utensils as string[]).join(", ")}</span>
                  <StatusBadge
                    status={Date.parse(c.valid_until) > nowMs ? "vigente" : "vencido"}
                    label={`Vigente hasta ${formatDateTime(c.valid_until)}`}
                  />
                  <span className="text-xs">Rótulo de limpieza colocado y verificado</span>
                </div>
                <Stamps
                  executedBy={c.cleanedBy}
                  executedAt={c.cleaned_at}
                  verifiedBy={c.verifiedBy}
                  verifiedAt={c.verified_at}
                />
                {c.status !== "verificado" && a.sign && c.cleaned_by !== a.ctx.userId ? (
                  <div>
                    <VerifyButton
                      kind="cleaning"
                      batchId={id}
                      recordId={c.id}
                      label="Verificar limpieza"
                      title={`Verificar limpieza · ${c.equipmentCode ?? "utensilios"}`}
                      summary={[
                        { label: "Limpió", value: c.cleanedBy },
                        { label: "Vigente hasta", value: formatDateTime(c.valid_until) },
                      ]}
                      signer={a.signer}
                      testId="verify-cleaning"
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      {a.execute && stage.status !== "completada" ? (
        <section
          className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
          aria-labelledby="new"
        >
          <h2 id="new" className="text-card-title">
            Registrar limpieza
          </h2>
          <CleaningForm
            batchId={id}
            stageOrderId={stage.id}
            stageLabel={label}
            equipment={equipment
              .filter((e) => e.type !== "balanza" || stage.stage === "dispensacion")
              .map((e) => ({ id: e.id, code: e.code, name: e.name }))}
            signer={a.signer}
          />
        </section>
      ) : null}
      <p className="text-sm">
        Siguiente:{" "}
        <Link href={`/produccion/lotes/${id}/${stage.stage}`} className="font-semibold">
          {label}
        </Link>
      </p>
    </main>
  );
}
