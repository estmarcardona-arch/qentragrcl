import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { NoPermissionState } from "@/components/common/state-card";
import { SodNotice } from "@/components/gxp/sod-notice";
import { StatusBadge } from "@/components/gxp/status-badge";
import { BatchHeader } from "@/components/production/batch-header";
import { CleaningForm, VerifyCleaningsButton } from "@/components/production/prep-forms";
import { Card, GmpBlock } from "@/components/production/ui";
import { formatDateTime } from "@/lib/format";
import { loadEquipment } from "@/lib/production/batch";
import { STAGE_LABELS, STAGE_STATUS } from "@/lib/production/labels";
import { batchPage } from "@/lib/production/page";
import { callRpc } from "@/lib/rpc";

export const metadata: Metadata = { title: "Limpieza de equipos y utensilios · GRUFARCOL eBR" };

// S-39 · Limpieza de equipos y utensilios antes de cada etapa (RF-39; diseño «Orden y limpieza S-38 y S-39»): rótulo,
// vigencia, quién ejecutó y quién verificó. La limpieza del equipo queda en su hoja de vida; sin limpieza vigente el
// equipo no se usa (EQUIPMENT_NOT_VALID).
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
  const pending = records.filter((c) => c.status !== "verificado");
  const mine = pending.filter((c) => c.cleaned_by === a.ctx.userId);
  const verifiable = pending.filter((c) => c.cleaned_by !== a.ctx.userId);
  const rows = records.flatMap((c) => [
    ...(c.equipmentCode
      ? [
          {
            key: `${c.id}-eq`,
            c,
            name: c.equipmentCode,
            sub: equipment.find((e) => e.code === c.equipmentCode)?.name ?? "Equipo",
            mono: true,
          },
        ]
      : []),
    ...(c.utensils as string[]).map((u, i) => ({
      key: `${c.id}-u${i}`,
      c,
      name: u,
      sub: "Utensilio",
      mono: false,
    })),
  ]);
  const vig = (until: string) => {
    const ms = Date.parse(until);
    return ms < nowMs
      ? {
          status: "vencido" as const,
          label: "Vencida",
          text: `Vencida desde ${formatDateTime(until)}`,
        }
      : ms - nowMs <= 48 * 3_600_000
        ? {
            status: "por_vencer" as const,
            label: "Por vencer",
            text: `Vigente hasta ${formatDateTime(until)}`,
          }
        : {
            status: "vigente" as const,
            label: "Vigente",
            text: `Vigente hasta ${formatDateTime(until)}`,
          };
  };
  const th = "px-4 py-3 text-label uppercase";
  return (
    <main className="grid content-start gap-5 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <BatchHeader
        data={data}
        title={`Limpieza · ${label}`}
        current="despeje"
        subtitle={`Lote ${data.batch.batch_code} · ${data.order.code}`}
      />
      <nav
        aria-label="Área"
        className="flex flex-wrap gap-1 rounded-[10px] border border-border bg-surface px-3 pt-2"
      >
        {data.stages.map((s) => {
          const st = STAGE_STATUS[s.status] ?? STAGE_STATUS.pendiente;
          return (
            <Link
              key={s.id}
              href={`/produccion/lotes/${id}/limpieza?etapa=${s.stage}`}
              aria-current={s.id === stage.id ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-12 items-center gap-2 border-b-2 px-4 text-[15px] no-underline",
                s.id === stage.id
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-text-strong",
              )}
            >
              {STAGE_LABELS[s.stage]} <StatusBadge status={st.status} label={st.label} />
            </Link>
          );
        })}
      </nav>
      {blocked.map((e) => (
        <GmpBlock
          key={e.id}
          testId="equipment-blocked"
          rule={`${e.code} sin ${e.reasons.some((r) => r.includes("limpieza")) ? "limpieza vigente" : "estado vigente"} (${e.reasons.join("; ")}): no puede usarse en el registro de ${label.toLowerCase()}.`}
          action="Registre la limpieza o use otro equipo."
        />
      ))}
      <section
        className="overflow-hidden rounded-[10px] border border-border bg-surface"
        aria-labelledby="rec"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div>
            <h2 id="rec" className="text-[18px] font-semibold">
              Limpieza de equipos y utensilios · {label}
            </h2>
            <p className="text-sm text-text-secondary">
              Lote {data.batch.batch_code} · ejecuta el auxiliar de producción, verifica la
              coordinación
            </p>
          </div>
          {blocked.length ? (
            <StatusBadge
              status="bloqueada"
              label={`Bloqueada · ${blocked.map((e) => e.code).join(", ")} sin limpieza vigente`}
            />
          ) : pending.length ? (
            <StatusBadge status="en_revision" label="Pendiente de verificación" />
          ) : records.length ? (
            <StatusBadge status="completada" label="Verificada" />
          ) : null}
        </header>
        {rows.length ? (
          <table className="w-full text-left text-sm" data-testid="cleanings">
            <thead className="bg-surface-sunken">
              <tr>
                {[
                  "Rótulo",
                  "Equipo o utensilio",
                  "Limpieza",
                  "Vigencia",
                  "Ejecutó",
                  "Verificó",
                ].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, c, name, sub, mono }) => {
                const v = vig(c.valid_until);
                return (
                  <tr
                    key={key}
                    className={cn(
                      "border-t border-divider",
                      v.status === "vencido" && "bg-q-bad-bg/60",
                      c.status !== "verificado" && v.status !== "vencido" && "bg-primary-soft/30",
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        readOnly
                        checked={c.status === "verificado"}
                        aria-label={`Rótulo de limpieza de ${name} verificado`}
                        className="size-6 accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <b className={cn("font-semibold", mono && "font-mono")}>{name}</b>
                      <span className="block text-xs text-text-secondary">{sub}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{formatDateTime(c.cleaned_at)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={v.status} label={v.label} />
                      <span className="block text-xs text-text-secondary">{v.text}</span>
                    </td>
                    <td className="px-4 py-3">{c.cleanedBy}</td>
                    <td className="px-4 py-3">
                      {c.verifiedBy ? (
                        `${c.verifiedBy} · ${formatDateTime(String(c.verified_at)).slice(11)}`
                      ) : (
                        <span className="text-text-secondary">pendiente</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="px-5 pb-5 text-sm text-text-secondary">
            Aún no hay limpiezas registradas para esta etapa.
          </p>
        )}
        {pending.length ? (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-divider p-4">
            <p className="text-sm text-text-secondary">
              «Rótulo de limpieza colocado y verificado»: lo marca quien verifica, no quien ejecutó
              la limpieza.
            </p>
            {verifiable.length && a.sign ? (
              <VerifyCleaningsButton
                batchId={id}
                ids={verifiable.map((c) => c.id)}
                stageLabel={label}
                executedBy={verifiable[0].cleanedBy}
                signer={a.signer}
              />
            ) : mine.length ? (
              <SodNotice
                title="No puede verificar su propia limpieza"
                reason="La verificación la hace otra persona (segregación de funciones)."
                who="Puede verificar: coordinación de producción o un supervisor."
              />
            ) : null}
          </footer>
        ) : null}
      </section>
      {a.execute && stage.status !== "completada" ? (
        <Card
          title="Registrar limpieza"
          subtitle="La limpieza de un equipo queda también en su hoja de vida."
        >
          <CleaningForm
            batchId={id}
            stageOrderId={stage.id}
            stageLabel={label}
            equipment={equipment
              .filter((e) => e.type !== "balanza" || stage.stage === "dispensacion")
              .map((e) => ({ id: e.id, code: e.code, name: e.name }))}
            signer={a.signer}
          />
        </Card>
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
