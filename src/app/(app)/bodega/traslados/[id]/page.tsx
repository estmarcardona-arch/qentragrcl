import type { Metadata } from "next";
import { Check, Circle, Download, Info, Lock, Play } from "lucide-react";
import { notFound } from "next/navigation";
import { cn } from "cn";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { TransferActions } from "@/components/warehouse/transfer-actions";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import { LOT_STATUS, TRANSFER_STATUS } from "@/lib/warehouse/labels";
import { qualification, todayBogota } from "@/lib/warehouse/structure";
import { loadTransfer } from "@/lib/warehouse/transfer";

export const metadata: Metadata = { title: "Traslado · GRUFARCOL eBR" };

// S-42c · Detalle del traslado (RF-25): línea de tiempo Borrador → Despachado → Recibido con los sellos de firma,
// líneas, remisión PDF y acciones según el estado y el rol.
export default async function TransferPage({ params }: PageProps<"/bodega/traslados/[id]">) {
  const { id } = await params;
  const a = await getWarehouseAccess();
  if (!a.trRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a los traslados" />
      </main>
    );
  }
  const v = await loadTransfer(a.supabase, id);
  if (!v) notFound();
  const { t } = v;
  const ext = t.to?.site_type === "externa";
  const st = TRANSFER_STATUS[t.status];
  const q = qualification(t.to?.external_parties ?? null, todayBogota());
  const { data: destLocs } =
    t.status === "despachado"
      ? await a.supabase
          .from("v_location_status")
          .select("id, code, status")
          .eq("warehouse_id", String(t.to?.id))
          .neq("status", "bloqueada")
          .order("code")
      : { data: [] as { id: string | null; code: string | null; status: string | null }[] };
  const total = v.lines.reduce((s, l) => s + l.qty, 0);
  const unit = v.lines[0]?.lot?.unit ?? "";
  const seal = (m: string, label: string) => {
    const g = v.sig(m);
    return {
      label,
      value: g ? `${g.signer_name} · ${formatDateTime(g.signed_at)}` : "pendiente de firma",
      on: Boolean(g),
    };
  };
  const steps = [
    {
      title: "Borrador",
      done: true,
      seals: [{ label: "Preparó", value: v.preparedBy, on: true }],
      note: `Motivo: ${t.reason}`,
    },
    {
      title: "Despachado",
      done: t.status === "despachado" || t.status === "recibido",
      seals: [seal("ejecuto", "Despachó"), seal("aprobo", "Aprobó")],
      note: "Remisión PDF generada.",
    },
    {
      title: t.status === "anulado" ? "Anulado" : "Recibido",
      done: t.status === "recibido" || t.status === "anulado",
      seals:
        t.status === "anulado"
          ? [{ label: "Motivo", value: String(t.cancel_reason), on: true }]
          : [
              {
                ...seal("verifico", "Recepción"),
                value: v.sig("verifico")
                  ? seal("verifico", "").value
                  : `pendiente de firma${ext ? " del maquilador" : ""}`,
              },
              {
                label: "Adjunto",
                value: t.reception_ref ?? `Acta de recepción${ext ? " del maquilador" : ""} (PDF)`,
                on: Boolean(t.reception_ref),
              },
            ],
      note: ext
        ? `Se completa cuando ${t.to?.external_parties?.name} firma la recepción.`
        : "Se completa al recibir en la bodega de destino.",
    },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={t.code}
        description={`${t.from?.code} → ${t.to?.code} · ${formatNumber(total, 0)} ${unit} · ${v.lines.map((l) => `lote ${l.lot?.supplier_lot}`).join(", ")}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Traslados", href: "/bodega/traslados" },
          { label: t.code },
        ]}
        meta={<StatusBadge status={st.status} label={st.label} />}
        actions={
          <Button asChild variant="secondary">
            <a href={`/bodega/traslados/${id}/remision`} target="_blank" rel="noreferrer">
              <Download aria-hidden /> Descargar remisión (PDF)
            </a>
          </Button>
        }
      />
      {t.status === "despachado" ? (
        <p
          role="note"
          className="flex items-start gap-2 rounded-lg border border-tram-en-curso-bd bg-tram-en-curso-bg px-3.5 py-2.5 text-sm text-tram-en-curso-fg"
        >
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          Mientras esté en tránsito, el saldo aparece en la bodega {ext
            ? "externa"
            : "de destino"}{" "}
          como pendiente de recepción.
        </p>
      ) : null}
      {ext ? (
        <section
          className={cn(
            "grid gap-1 rounded-[10px] border-2 border-dashed bg-surface p-4 text-sm",
            q.ok ? "border-primary" : "border-q-bad-fg",
          )}
        >
          <span className="flex flex-wrap items-center justify-between gap-2">
            <b className="font-semibold">
              {t.from?.code} → {t.to?.code} · {t.to?.external_parties?.name}
            </b>
            <StatusBadge status={q.ok ? "vigente" : "vencido"} label={q.label} />
          </span>
        </section>
      ) : null}

      <ol
        aria-label="Estado del traslado"
        className="grid grid-cols-3 gap-3 max-[1279px]:grid-cols-1"
        data-testid="timeline"
      >
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={cn(
              "grid content-start gap-2 rounded-[10px] border bg-surface p-4",
              i === current ? "border-2 border-primary" : "border-border",
            )}
          >
            <span className="flex items-center gap-2 font-semibold">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full",
                  s.done
                    ? "bg-primary text-white"
                    : i === current
                      ? "border-2 border-primary text-primary"
                      : "border border-border-control",
                )}
              >
                {s.done ? (
                  <Check aria-hidden className="size-4" />
                ) : i === current ? (
                  <Play aria-hidden className="size-3.5" />
                ) : (
                  <Circle aria-hidden className="size-3" />
                )}
              </span>
              {s.title}
            </span>
            {s.seals.map((g) => (
              <span
                key={g.label}
                className={cn(
                  "flex items-start gap-1.5 text-sm",
                  g.on ? "text-text" : "text-text-secondary",
                )}
              >
                <Lock
                  aria-hidden
                  className={cn("mt-0.5 size-3.5 shrink-0", !g.on && "opacity-40")}
                />
                <span>
                  <b className="font-semibold">{g.label}:</b> {g.value}
                </span>
              </span>
            ))}
            <span className="text-xs text-text-secondary">{s.note}</span>
          </li>
        ))}
      </ol>

      <section aria-labelledby="lineas" className="grid gap-2">
        <h2 id="lineas" className="text-card-title">
          Líneas del traslado
        </h2>
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm" data-testid="transfer-lines">
            <caption className="sr-only">Líneas</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {[
                  "Lote",
                  "Material",
                  "Cantidad",
                  "Ubicación origen",
                  "Ubicación destino",
                  "Calidad",
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="border-b border-border px-3 py-2.5 text-label uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.lines.map((l) => {
                const ls = LOT_STATUS[String(l.lot?.status)] ?? LOT_STATUS.aprobado;
                return (
                  <tr key={l.id} className="border-b border-divider last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold">
                      {l.lot?.supplier_lot}
                      <span className="block font-normal">{l.lot?.internal_code}</span>
                    </td>
                    <td className="px-3 py-2.5">{l.lot?.materials?.name}</td>
                    <td className="px-3 py-2.5 font-semibold">
                      {formatNumber(l.qty, 0)} {l.lot?.unit}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{l.fromCode}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{l.toCode ?? "Por asignar"}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={ls.status} label={ls.label} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <TransferActions
        id={id}
        code={t.code}
        status={t.status}
        dispatchSigned={Boolean(v.sig("ejecuto"))}
        dispatchedByMe={t.dispatched_by === a.ctx.userId}
        canCreate={a.trCreate}
        canApprove={a.trApprove}
        external={ext}
        summary={[
          { label: "Traslado", value: t.code, mono: true },
          { label: "Ruta", value: `${t.from?.code} → ${t.to?.code}` },
          { label: "Cantidad", value: `${formatNumber(total, 0)} ${unit}` },
        ]}
        lines={v.lines.map((l) => ({
          id: l.id,
          label: `${l.lot?.supplier_lot} · ${formatNumber(l.qty, 0)} ${l.lot?.unit}`,
          toLocationId: l.toLocationId,
        }))}
        locations={(destLocs ?? []).map((d) => ({ id: String(d.id), code: String(d.code) }))}
        signer={a.signer}
      />
    </main>
  );
}
