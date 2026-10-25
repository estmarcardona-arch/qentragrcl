"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { ReauthDialog } from "@/components/documents/reauth-dialog";
import { SodNotice } from "@/components/gxp/sod-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cancelTransfer, dispatchTransfer, receiveTransfer } from "@/lib/warehouse/actions";

export type ReceiveLine = { id: string; label: string; toLocationId: string | null };

/**
 * Acciones del traslado (RF-25): quien prepara firma el despacho («Ejecuté»); el jefe de bodega, otra persona,
 * lo aprueba («Aprobé») y el material sale; al llegar se firma la recepción («Verifiqué») con el acta y la
 * ubicación de destino de cada línea. Un borrador se anula con motivo.
 */
export function TransferActions({
  id,
  code,
  status,
  dispatchSigned,
  dispatchedByMe,
  canCreate,
  canApprove,
  external,
  summary,
  lines,
  locations,
  signer,
}: {
  id: string;
  code: string;
  status: string;
  dispatchSigned: boolean;
  dispatchedByMe: boolean;
  canCreate: boolean;
  canApprove: boolean;
  external: boolean;
  summary: { label: string; value: string; mono?: boolean }[];
  lines: ReceiveLine[];
  locations: { id: string; code: string }[];
  signer: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "despacho" | "aprobacion" | "recepcion">(null);
  const [ref, setRef] = useState("");
  const [locs, setLocs] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((l) => [l.id, l.toLocationId ?? ""])),
  );
  const done = () => {
    setDialog(null);
    router.refresh();
  };
  return (
    <div className="grid gap-3">
      {status === "borrador" && dispatchSigned && dispatchedByMe && canApprove ? (
        <SodNotice
          title="No puede aprobar este despacho"
          reason="Usted firmó el despacho: quien despacha no aprueba el mismo traslado."
          who="Lo aprueba otra persona con rol de jefe de bodega."
        />
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {status === "borrador" && canCreate ? (
          <ReasonDialog
            trigger={<Button variant="secondary">Anular</Button>}
            title={`Anular ${code}`}
            description="El traslado en borrador queda anulado; no mueve existencias."
            confirmLabel="Anular"
            destructive
            onConfirm={(reason) => cancelTransfer({ id, reason })}
            onDone={() => router.refresh()}
          />
        ) : null}
        {status === "borrador" && !dispatchSigned && canCreate ? (
          <Button onClick={() => setDialog("despacho")}>Firmar despacho</Button>
        ) : null}
        {status === "borrador" && dispatchSigned && canApprove && !dispatchedByMe ? (
          <Button onClick={() => setDialog("aprobacion")}>Aprobar despacho</Button>
        ) : null}
        {status === "despachado" && canCreate ? (
          <Button onClick={() => setDialog("recepcion")}>Firmar recepción</Button>
        ) : null}
      </div>
      {dialog ? (
        <ReauthDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={
            dialog === "despacho"
              ? `Despachar ${code}`
              : dialog === "aprobacion"
                ? `Aprobar el despacho de ${code}`
                : `Recibir ${code}`
          }
          meaning={
            dialog === "despacho" ? "Ejecuté" : dialog === "aprobacion" ? "Aprobé" : "Verifiqué"
          }
          summary={summary}
          signer={signer}
          confirmLabel={
            dialog === "despacho"
              ? "Firmar despacho"
              : dialog === "aprobacion"
                ? "Firmar aprobación"
                : "Firmar recepción"
          }
          onConfirm={(pw) =>
            dialog === "recepcion"
              ? receiveTransfer({ id, locations: locs, reference: ref, password: pw })
              : dispatchTransfer({ id, password: pw })
          }
          onDone={done}
        >
          {dialog === "aprobacion" ? (
            <p className="text-sm">
              Al aprobar, el material sale del origen y queda en tránsito hasta su recepción.
            </p>
          ) : null}
          {dialog === "recepcion" ? (
            <div className="grid gap-3">
              {lines.map((l) => (
                <label key={l.id} className="grid gap-1.5">
                  <span className="text-label uppercase">Ubicación de destino · {l.label}</span>
                  <select
                    value={locs[l.id] ?? ""}
                    onChange={(e) => setLocs({ ...locs, [l.id]: e.target.value })}
                    className="h-10 rounded-md border border-border-control bg-white px-2.5 text-sm"
                  >
                    <option value="">Seleccione…</option>
                    {locations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.code}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="grid gap-1.5">
                <span className="text-label uppercase">
                  Acta de recepción{external ? " del maquilador *" : ""}
                </span>
                <Input
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="Referencia del acta (PDF)"
                />
              </label>
            </div>
          ) : null}
        </ReauthDialog>
      ) : null}
    </div>
  );
}
