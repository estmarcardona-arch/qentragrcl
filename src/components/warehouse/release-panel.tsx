"use client";

import { CircleX, FileText, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ReauthDialog } from "@/components/documents/reauth-dialog";
import { SodNotice } from "@/components/gxp/sod-notice";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordResults, releaseLot, type WhResult } from "@/lib/warehouse/actions";

export type TestView = {
  id: string;
  name: string;
  method: string;
  acceptance: string;
  value: string | null;
  conforming: boolean | null;
  recordedBy: string | null;
};

export type QuarantineLot = {
  id: string;
  code: string;
  material: string;
  supplierLot: string;
  supplier: string;
  received: string;
  expiry: string;
  coa: string | null;
  tests: TestView[];
};

/**
 * S-13 · Un lote en cuarentena (RF-22): el laboratorio registra los resultados y Control de calidad aprueba
 * («Liberé») o rechaza con motivo, con firma. Aprobar queda bloqueado mientras falten resultados (RESULTS_PENDING)
 * y quien registró resultados no decide (SOD-5).
 */
export function ReleasePanel({
  lot,
  canRecord,
  canRelease,
  userId,
  signer,
}: {
  lot: QuarantineLot;
  canRecord: boolean;
  canRelease: boolean;
  userId: string;
  signer: string;
}) {
  const router = useRouter();
  const pending = lot.tests.filter((t) => t.conforming == null);
  const nonConforming = lot.tests.filter((t) => t.conforming === false);
  const analyst = lot.tests.some((t) => t.recordedBy === userId);
  const [values, setValues] = useState<Record<string, { value: string; conforming: string }>>({});
  const [error, setError] = useState<Exclude<WhResult, { ok: true }> | null>(null);
  const [dialog, setDialog] = useState<null | "aprobado" | "rechazado">(null);
  const [busy, start] = useTransition();
  const ready = pending.filter((t) => values[t.id]?.value?.trim() && values[t.id]?.conforming);
  const blockApprove = pending.length > 0 || nonConforming.length > 0;

  return (
    <article
      aria-label={`Lote ${lot.code}`}
      data-code={lot.code}
      className="grid gap-3 rounded-[10px] border border-q-warn-bd bg-surface p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <b className="text-base font-semibold">{lot.material}</b>
          <span className="font-mono text-[13px]">
            {lot.code} · {lot.supplierLot}
          </span>
          <span className="text-small text-text-secondary">
            {lot.supplier} · recepción {lot.received} · vence {lot.expiry}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="cuarentena" label="Cuarentena" />
          {lot.coa ? (
            <span className="inline-flex items-center gap-1 text-small">
              <FileText aria-hidden className="size-4" />
              {lot.coa}
            </span>
          ) : null}
        </div>
      </header>

      <table className="w-full text-left text-sm" data-testid="lot-tests">
        <caption className="sr-only">Resultados capturados</caption>
        <thead className="bg-surface-sunken">
          <tr>
            {["Prueba", "Criterio", "Resultado", "Estado"].map((h) => (
              <th key={h} scope="col" className="px-2 py-2 text-label uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lot.tests.map((t) => (
            <tr key={t.id} className="border-t border-divider align-top">
              <td className="px-2 py-2">
                <b className="font-semibold">{t.name}</b>
                {t.method ? (
                  <span className="block text-xs text-text-secondary">{t.method}</span>
                ) : null}
              </td>
              <td className="px-2 py-2 text-xs">{t.acceptance || "—"}</td>
              <td className="px-2 py-2">
                {t.conforming == null && canRecord ? (
                  <div className="flex flex-wrap gap-2">
                    <Input
                      aria-label={`Resultado de ${t.name}`}
                      className="h-9 w-56"
                      value={values[t.id]?.value ?? ""}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [t.id]: {
                            conforming: values[t.id]?.conforming ?? "",
                            value: e.target.value,
                          },
                        })
                      }
                    />
                    <select
                      aria-label={`Conformidad de ${t.name}`}
                      className="h-9 rounded-md border border-border-control bg-white px-2 text-sm"
                      value={values[t.id]?.conforming ?? ""}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [t.id]: { value: values[t.id]?.value ?? "", conforming: e.target.value },
                        })
                      }
                    >
                      <option value="">Conformidad…</option>
                      <option value="si">Conforme</option>
                      <option value="no">No conforme</option>
                    </select>
                  </div>
                ) : (
                  (t.value ?? "—")
                )}
              </td>
              <td className="px-2 py-2">
                <StatusBadge
                  status={
                    t.conforming == null ? "sin_dato" : t.conforming ? "aprobado" : "rechazado"
                  }
                  label={
                    t.conforming == null ? "Pendiente" : t.conforming ? "Conforme" : "No conforme"
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {canRecord && pending.length ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={busy || ready.length === 0}
            onClick={() =>
              start(async () => {
                const res = await recordResults({
                  lotId: lot.id,
                  results: ready.map((t) => ({
                    test_id: t.id,
                    value: values[t.id].value,
                    conforming: values[t.id].conforming === "si",
                  })),
                });
                if (!res.ok) return setError(res);
                setError(null);
                setValues({});
                router.refresh();
              })
            }
          >
            Registrar {ready.length || ""} resultado{ready.length === 1 ? "" : "s"}
          </Button>
        </div>
      ) : null}

      {canRelease && analyst ? (
        <SodNotice
          title="No puede liberar este lote"
          reason="Usted registró resultados de este lote: quien analiza no aprueba ni rechaza el mismo lote (SOD-5)."
          who="Lo decide otra persona de Control de calidad."
        />
      ) : null}

      {canRelease && !analyst && blockApprove ? (
        <div
          role="note"
          className="grid grid-cols-[40px_1fr] gap-3 rounded-[10px] border border-neutral-strong bg-surface-sunken p-4"
          data-testid="gmp-block"
        >
          <span className="flex size-10 items-center justify-center rounded-[10px] bg-neutral-strong text-white">
            <ShieldAlert aria-hidden className="size-5" />
          </span>
          <div className="grid gap-1 text-sm">
            <b className="font-semibold">Bloqueado por regla GMP</b>
            <span>
              <b>Qué regla:</b>{" "}
              {pending.length
                ? "No se puede aprobar: faltan resultados de análisis."
                : "No se puede aprobar: hay resultados no conformes."}
            </span>
            <span>
              <b>Qué hacer:</b>{" "}
              {pending.length
                ? `Solicite a Laboratorio que registre ${pending.map((t) => t.name).join(" y ")}.`
                : "Rechace el lote con su motivo."}
            </span>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg">
          <CircleX aria-hidden className="mt-0.5 size-3.5" />
          {error.rule} {error.detail ? `(${error.detail}) ` : ""}
          {error.action}
        </p>
      ) : null}

      {canRelease && !analyst ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setDialog("rechazado")}>
            Rechazar con motivo
          </Button>
          <Button type="button" disabled={blockApprove} onClick={() => setDialog("aprobado")}>
            Aprobar y firmar
          </Button>
        </div>
      ) : null}

      {dialog ? (
        <ReauthDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={dialog === "aprobado" ? `Liberar lote ${lot.code}` : `Rechazar lote ${lot.code}`}
          meaning={dialog === "aprobado" ? "Liberé" : "Revisé"}
          summary={[
            { label: "Material", value: lot.material },
            { label: "Lote", value: `${lot.code} · ${lot.supplierLot}`, mono: true },
            {
              label: "Resultados",
              value: `${lot.tests.filter((t) => t.conforming).length} de ${lot.tests.length} conformes`,
            },
            { label: "Estado resultante", value: dialog === "aprobado" ? "Aprobado" : "Rechazado" },
          ]}
          signer={signer}
          reasonLabel={dialog === "rechazado" ? "Motivo del rechazo" : "Observaciones (opcional)"}
          reasonRequired={dialog === "rechazado"}
          confirmLabel={dialog === "aprobado" ? "Firmar liberación" : "Firmar rechazo"}
          destructive={dialog === "rechazado"}
          onConfirm={(pw, reason) =>
            releaseLot({ lotId: lot.id, decision: dialog, reason, password: pw })
          }
          onDone={() => {
            setDialog(null);
            router.refresh();
          }}
        >
          {dialog === "rechazado" ? (
            <p className="rounded-md border border-q-bad-bd bg-q-bad-bg px-3 py-2 text-sm text-q-bad-fg">
              Pasará a RECHAZADO: el lote no podrá dispensarse y debe trasladarse a la bodega de
              rechazo.
            </p>
          ) : null}
        </ReauthDialog>
      ) : null}
    </article>
  );
}
