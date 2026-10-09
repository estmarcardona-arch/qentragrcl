"use client";

import { CircleX, KeyRound, Lock } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DocResult } from "@/lib/documents/actions";

/**
 * Firma de un paso documental (Actualicé, Revisé, Aprobé) o decisión con contraseña. Muestra qué se
 * firma, quién firma y exige la contraseña; la base valida rol, ruta, SOD y reautenticación.
 */
export function ReauthDialog({
  open,
  onOpenChange,
  title,
  meaning,
  summary,
  signer,
  reasonLabel,
  reasonRequired,
  confirmLabel,
  destructive,
  children,
  onConfirm,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Significado que queda en el cuadro de firmas («Aprobé»). */
  meaning?: string;
  summary: { label: string; value: string; mono?: boolean }[];
  signer: string;
  reasonLabel?: string;
  reasonRequired?: boolean;
  confirmLabel: string;
  destructive?: boolean;
  children?: ReactNode;
  onConfirm: (password: string, reason: string) => Promise<DocResult>;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<Exclude<DocResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setPassword("");
          setReason("");
          setError(null);
        }
      }}
    >
      <DialogContent className="grid max-w-[480px] gap-4 rounded-xl p-[22px]">
        <DialogTitle className="text-xl leading-7 font-semibold">{title}</DialogTitle>
        <DialogDescription className="text-sm text-text-secondary">
          {meaning ? (
            <>
              Firma electrónica: <b className="font-semibold text-foreground">«{meaning}»</b>. Queda
              en el cuadro de firmas con su firma corta y la hora del servidor.
            </>
          ) : (
            "La decisión queda en la bitácora con su motivo, su nombre y la hora del servidor."
          )}
        </DialogDescription>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-md bg-surface-sunken px-3 py-2 text-sm">
          {summary.map((s) => (
            <div key={s.label} className="contents">
              <dt className="text-text-secondary">{s.label}</dt>
              <dd className={s.mono ? "font-mono text-[13px] font-semibold" : "font-medium"}>
                {s.value}
              </dd>
            </div>
          ))}
          <dt className="text-text-secondary">Firma</dt>
          <dd className="font-medium">{signer}</dd>
        </dl>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await onConfirm(password, reason.trim());
              if (res.ok) {
                setPassword("");
                setReason("");
                setError(null);
                onDone();
              } else {
                setPassword("");
                setError(res);
              }
            });
          }}
        >
          {children}
          {reasonLabel ? (
            <div className="grid gap-1.5">
              <Label htmlFor="reauth-reason" className="text-label uppercase">
                {reasonLabel} {reasonRequired ? <span className="text-q-bad-ic">*</span> : null}
              </Label>
              <Textarea
                id="reauth-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="reauth-password" className="text-label uppercase">
              <KeyRound aria-hidden className="mr-1 inline size-3.5" />
              Contraseña <span className="text-q-bad-ic">*</span>
            </Label>
            <Input
              id="reauth-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-required="true"
            />
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <Lock aria-hidden className="size-3" />
              Los intentos fallidos cuentan igual que en la firma de registros.
            </span>
          </div>
          {error ? (
            <p
              role="alert"
              className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg"
            >
              <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {error.rule} {error.detail ? `(${error.detail}) ` : ""}
                {error.action}
                {error.remaining !== undefined ? ` Intentos restantes: ${error.remaining}.` : ""}
              </span>
            </p>
          ) : null}
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={pending || !password || (reasonRequired && !reason.trim())}
            >
              {pending ? "Firmando…" : confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
