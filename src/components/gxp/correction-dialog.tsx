"use client";

import { CircleX, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recordCorrection, type CorrectionResult } from "@/lib/gxp/actions";

type CorrectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: { table: string; id: string; code: string };
  field: { name: string; label: string; currentValue: string; unit?: string };
  onCorrected?: (result: Extract<CorrectionResult, { ok: true }>) => void;
};

/**
 * Corrección con motivo (DI-4, DI-12): el valor anterior se conserva tachado; el motivo es obligatorio.
 * Si el registro supera el umbral de correcciones (5 por defecto, D-25) se muestra el aviso.
 */
export function CorrectionDialog({
  open,
  onOpenChange,
  record,
  field,
  onCorrected,
}: CorrectionDialogProps) {
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<Exclude<CorrectionResult, { ok: true }> | null>(null);
  const [warning, setWarning] = useState<{ count: number; threshold: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const reasonMissing = reason.trim().length === 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reasonMissing || newValue.trim().length === 0) return;
    startTransition(async () => {
      const result = await recordCorrection({
        table: record.table,
        id: record.id,
        field: field.name,
        newValue: newValue.trim(),
        reason: reason.trim(),
      });
      if (!result.ok) {
        setError(result);
        return;
      }
      setError(null);
      onCorrected?.(result);
      if (result.warning) {
        setWarning({ count: result.count, threshold: result.threshold });
      } else {
        onOpenChange(false);
      }
      setNewValue("");
      setReason("");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setWarning(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="grid max-w-[480px] gap-4 rounded-xl p-[22px]">
        <DialogTitle className="text-xl leading-7 font-semibold">Registrar corrección</DialogTitle>
        <DialogDescription className="text-sm text-text-secondary">
          El valor anterior queda visible y tachado, con su motivo, su firma corta y la hora del
          servidor.
        </DialogDescription>

        {warning ? (
          <div
            role="alert"
            className="grid grid-cols-[22px_1fr] gap-3 rounded-lg bg-q-warn-bg p-3 ring-1 ring-q-warn-bd ring-inset"
          >
            <TriangleAlert aria-hidden className="size-[22px] text-q-warn-ic" />
            <span>
              <b className="block text-sm font-semibold text-q-warn-fg">
                Este registro acumula {warning.count} correcciones
              </b>
              <span className="text-sm text-text-strong">
                Supera el umbral de {warning.threshold}. Se avisará al verificador y a Calidad
                (DI-12).
              </span>
            </span>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-0.5 rounded-lg bg-surface-sunken px-3.5 py-3">
              <span className="text-label text-text-secondary uppercase">{field.label}</span>
              <span className="text-sm">
                Valor vigente: <b className="font-semibold">{field.currentValue}</b> {field.unit}
              </span>
              <span className="font-mono text-xs text-text-strong">{record.code}</span>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="correction-value" className="text-label uppercase">
                Valor corregido{field.unit ? ` (${field.unit})` : ""}
              </Label>
              <Input
                id="correction-value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="correction-reason" className="text-label uppercase">
                Motivo de la corrección <span className="text-q-bad-ic">*</span>
              </Label>
              <Textarea
                id="correction-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                aria-required="true"
                placeholder="Ej.: Error de transcripción; la balanza imprimió 98,8 kg."
              />
            </div>
            {error ? (
              <p
                role="alert"
                className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg"
              >
                <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                {error.rule} {error.action}
              </p>
            ) : null}
            <div className="flex justify-end gap-2.5">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={pending || reasonMissing || newValue.trim().length === 0}
              >
                {pending ? "Guardando…" : "Registrar corrección"}
              </Button>
            </div>
            {reasonMissing ? (
              <p className="text-small text-text-secondary">El motivo es obligatorio.</p>
            ) : null}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
