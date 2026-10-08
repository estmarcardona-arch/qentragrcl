"use client";

import { CircleX } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AdminResult } from "@/lib/admin/actions";

type ReasonDialogProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Campos adicionales del cambio. */
  children?: ReactNode;
  onConfirm: (reason: string) => Promise<AdminResult>;
  onDone?: () => void;
  /** Se llama al abrir (p. ej. para reiniciar un borrador). */
  onOpen?: () => void;
};

/** Todo cambio administrativo exige motivo; queda en la bitácora con el antes y el después. */
export function ReasonDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive,
  children,
  onConfirm,
  onDone,
  onOpen,
}: ReasonDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<Exclude<AdminResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) onOpen?.();
        if (!o) {
          setReason("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="grid max-w-[480px] gap-4 rounded-xl p-[22px]">
        <DialogTitle className="text-xl leading-7 font-semibold">{title}</DialogTitle>
        <DialogDescription className="text-sm text-text-secondary">
          {description ??
            "El cambio queda en la bitácora con su motivo, su autor y la hora del servidor."}
        </DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await onConfirm(reason.trim());
              if (res.ok) {
                setOpen(false);
                setReason("");
                setError(null);
                onDone?.();
              } else setError(res);
            });
          }}
        >
          {children}
          <div className="grid gap-1.5">
            <Label htmlFor="admin-reason" className="text-label uppercase">
              Motivo <span className="text-q-bad-ic">*</span>
            </Label>
            <Textarea
              id="admin-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              aria-required="true"
            />
          </div>
          {error ? (
            <p
              role="alert"
              className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg"
            >
              <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {error.rule} {error.detail ? `(${error.detail}) ` : ""}
              {error.action}
            </p>
          ) : null}
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={pending || !reason.trim()}
            >
              {pending ? "Guardando…" : confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
