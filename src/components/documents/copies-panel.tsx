"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { issueCopy, recallCopy } from "@/lib/documents/actions";
import { formatDateTime } from "@/lib/format";

export type CopyRow = {
  id: string;
  versionNo: number;
  target: string;
  copyType: "controlada" | "no_controlada";
  deliveredAt: string;
  recalledAt: string | null;
  recallNote: string | null;
};

/** Copias y distribución (PRD 2.5.7): el control de documentos, entrega y recolección por proceso. */
export function CopiesPanel({
  rows,
  canManage,
  vigenteVersionId,
}: {
  rows: CopyRow[];
  canManage: boolean;
  vigenteVersionId: string | null;
}) {
  const router = useRouter();
  const [recipient, setRecipient] = useState("");
  const pending = rows.filter((r) => !r.recalledAt && r.copyType === "controlada");

  return (
    <section aria-label="Copias y distribución" className="grid gap-3">
      <p className="text-small text-text-secondary">
        Cada entrega de una copia controlada y cada recolección de una copia obsoleta queda
        registrada. No se publica una versión nueva ni se cierra una anulación con copias sin
        recoger.
      </p>
      <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
        <table className="w-full text-left text-sm" data-testid="copies">
          <caption className="sr-only">Copias entregadas y recogidas</caption>
          <thead className="bg-surface-sunken">
            <tr>
              {["Proceso o destinatario", "Versión", "Copia", "Entregada", "Recogida", ""].map(
                (h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-b border-border px-3 py-2.5 text-label uppercase"
                  >
                    {h || <span className="sr-only">Acciones</span>}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-text-secondary">
                  Aún no se han entregado copias.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-divider last:border-0"
                  data-target={r.target}
                >
                  <td className="px-3 py-2.5 font-medium">{r.target}</td>
                  <td className="px-3 py-2.5 font-mono">{String(r.versionNo).padStart(2, "0")}</td>
                  <td className="px-3 py-2.5">
                    {r.copyType === "controlada" ? "Controlada" : "No controlada"}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{formatDateTime(r.deliveredAt)}</td>
                  <td className="px-3 py-2.5">
                    {r.recalledAt ? (
                      <span className="font-mono text-xs">{formatDateTime(r.recalledAt)}</span>
                    ) : r.copyType === "controlada" ? (
                      <StatusBadge status="pendiente" label="Sin recoger" />
                    ) : (
                      "No se recoge"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {canManage && !r.recalledAt && r.copyType === "controlada" ? (
                      <ReasonDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-label={`Registrar recolección de ${r.target}`}
                          >
                            Registrar recolección
                          </Button>
                        }
                        title={`Recoger la copia de ${r.target}`}
                        description="La copia se retira del proceso. Queda en el control de documentos con su nota, usuario y hora."
                        confirmLabel="Registrar recolección"
                        onConfirm={(note) => recallCopy({ distributionId: r.id, note })}
                        onDone={() => router.refresh()}
                      />
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pending.length > 0 ? (
        <p className="text-small text-text-secondary">
          {pending.length} copia(s) controlada(s) sin recoger.
        </p>
      ) : null}
      {canManage && vigenteVersionId ? (
        <div className="flex flex-wrap items-end gap-2 rounded-[10px] border border-border bg-surface p-3.5">
          <div className="grid min-w-[280px] flex-1 gap-1.5">
            <Label htmlFor="copy-recipient" className="text-label uppercase">
              Copia no controlada para un tercero
            </Label>
            <Input
              id="copy-recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="p. ej. Laboratorio Externo Andino"
            />
          </div>
          <Button
            variant="secondary"
            disabled={!recipient.trim()}
            onClick={async () => {
              const res = await issueCopy({
                versionId: vigenteVersionId,
                recipient,
                copyType: "no_controlada",
              });
              if (res.ok) {
                setRecipient("");
                router.refresh();
              }
            }}
          >
            Registrar entrega
          </Button>
          <span className="w-full text-xs text-text-secondary">
            Un PDF entregado fuera de la empresa nunca sale como copia controlada: no se actualiza
            ni se recoge.
          </span>
        </div>
      ) : null}
    </section>
  );
}
