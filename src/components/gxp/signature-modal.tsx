"use client";

import { Check, CircleX, KeyRound, Lock, PenLine } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";
import {
  canSign,
  getServerTime,
  signRecord,
  type CanSignResult,
  type SignResult,
  type Signer,
} from "@/lib/gxp/actions";
import { MEANINGS, MODAL_MEANINGS, type SignatureMeaning } from "@/lib/gxp/meanings";

export type SignatureModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: { table: string; id: string; label: string; code: string };
  meaning: SignatureMeaning;
  /** Resumen de lo que se firma (clave → valor). */
  summary?: { label: string; value: string; mono?: boolean }[];
  signer: Signer;
  /** Verifica segregación de funciones antes de pedir la contraseña (por defecto, sí). */
  precheck?: boolean;
  onSigned?: (result: Extract<SignResult, { ok: true }>) => void;
};

/**
 * Modal de firma electrónica único del sistema (PRD §13 regla 3; Prompt 0, 5.a). Muestra qué se firma,
 * el significado, el resumen, quién firma y la hora del servidor, y exige la contraseña. Toda la
 * validación (reautenticación, rol, orden y SOD) la hace sign_record en la base.
 */
export function SignatureModal({
  open,
  onOpenChange,
  record,
  meaning,
  summary = [],
  signer,
  precheck = true,
  onSigned,
}: SignatureModalProps) {
  const passwordId = useId();
  const errorId = useId();
  const [password, setPassword] = useState("");
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [precheckResult, setCheck] = useState<CanSignResult | null>(null);
  const [error, setError] = useState<Exclude<SignResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const refresh = () => void getServerTime().then((t) => alive && setServerTime(t));
    refresh();
    const id = window.setInterval(refresh, 30_000);
    if (precheck) {
      void canSign({ table: record.table, id: record.id, meaning }).then(
        (r) => alive && setCheck(r),
      );
    }
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [open, precheck, record.table, record.id, meaning]);

  // Al cerrar se limpia todo: la contraseña nunca queda en memoria entre aperturas.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setPassword("");
      setError(null);
      setCheck(null);
    }
    onOpenChange(next);
  }

  const check = precheck ? precheckResult : ({ allowed: true } as const);
  const blocked = check !== null && !check.allowed;
  const sodBlocked = blocked && (check.code === "SOD_VIOLATION" || check.code === "FORBIDDEN_ROLE");
  const locked = error?.code === "REAUTH_LOCKED";
  const canSubmit = !pending && !blocked && !locked && password.length > 0 && check !== null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await signRecord({ table: record.table, id: record.id, meaning, password });
      setPassword("");
      if (result.ok) {
        handleOpenChange(false);
        onSigned?.(result);
      } else {
        setError(result);
      }
    });
  }

  const errorText = error
    ? error.code === "REAUTH_FAILED"
      ? `Contraseña incorrecta.${error.remaining !== undefined ? ` Le quedan ${error.remaining} ${error.remaining === 1 ? "intento" : "intentos"}.` : ""}`
      : error.code === "REAUTH_LOCKED"
        ? `${error.rule}${error.lockedUntil ? ` Podrá firmar de nuevo a las ${formatDateTime(error.lockedUntil).slice(-5)}.` : ""} ${error.action}`
        : `${error.rule} ${error.detail ? `(${error.detail}) ` : ""}${error.action}`
    : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="grid max-w-[440px] gap-3.5 rounded-xl p-[22px] max-[1279px]:max-w-[560px]">
        <DialogTitle className="text-xl leading-7 font-semibold">Firmar registro</DialogTitle>
        <DialogDescription className="sr-only">
          Confirme su identidad para firmar «{record.label}» con el significado «
          {MEANINGS[meaning].chip}».
        </DialogDescription>

        <div className="grid gap-0.5 rounded-lg bg-surface-sunken px-3.5 py-3">
          <span className="text-label text-text-secondary uppercase">Qué se firma</span>
          <span className="text-[15px] leading-[22px] font-semibold">{record.label}</span>
          <span className="font-mono text-xs font-medium text-text-strong">{record.code}</span>
        </div>

        <div className="grid gap-2">
          <span className="text-[13px] leading-[18px] font-semibold">Significado de la firma</span>
          <div className="flex flex-wrap gap-1.5" role="list">
            {MODAL_MEANINGS.map((m) => {
              const selected = m === meaning;
              return (
                <span
                  key={m}
                  role="listitem"
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-2xl border px-3 text-[13px] leading-none",
                    selected
                      ? "border-primary bg-primary font-semibold text-white"
                      : "border-border-control bg-white font-medium text-text-strong",
                  )}
                >
                  {selected ? <Check aria-hidden strokeWidth={3} className="size-3.5" /> : null}
                  {MEANINGS[m].chip}
                </span>
              );
            })}
          </div>
        </div>

        {summary.length ? (
          <div className="grid gap-1.5 border-y border-divider py-2.5 text-[13px] leading-[19px] text-text-strong">
            <span className="text-[13px] leading-[18px] font-semibold">
              Resumen de lo que firma
            </span>
            {summary.map((s) => (
              <span key={s.label} className="flex justify-between gap-3">
                <span className="text-text-secondary">{s.label}</span>
                <span
                  className={cn(
                    "text-right",
                    s.mono ? "font-mono text-xs font-medium" : "font-semibold",
                  )}
                >
                  {s.value}
                </span>
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary-hover">
            {signer ? initials(signer.fullName) : "—"}
          </span>
          <span>
            <b className="block text-sm leading-[18px] font-semibold">
              {signer?.fullName ?? "Sin sesión"}
            </b>
            <span className="text-[13px] leading-[18px] text-text-secondary">
              {signer?.roleLabel ?? "Inicie sesión para firmar"}
            </span>
          </span>
        </div>

        {sodBlocked ? (
          <div
            role="note"
            className="grid grid-cols-[32px_1fr] items-start gap-2.5 rounded-lg bg-surface-sunken p-3 ring-1 ring-neutral-strong ring-inset"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-neutral-strong text-white">
              <Lock aria-hidden className="size-[18px]" />
            </span>
            <span>
              <b className="block text-sm leading-5 font-semibold">No puede firmar este registro</b>
              <span className="text-[13px] leading-[19px] text-neutral-strong">
                {check.message}
              </span>
            </span>
          </div>
        ) : null}

        <form onSubmit={submit} className="grid gap-3.5">
          <div className="grid gap-1.5">
            <label htmlFor={passwordId} className="text-[13px] leading-[18px] font-semibold">
              Confirme su identidad
            </label>
            <div className="relative">
              <Input
                id={passwordId}
                type="password"
                autoComplete="current-password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={blocked || locked || pending}
                aria-invalid={error ? true : undefined}
                aria-describedby={errorText ? errorId : undefined}
                className="h-10 bg-white pr-10 text-sm"
              />
              <KeyRound aria-hidden className="absolute top-3 right-3 size-4 text-text-secondary" />
            </div>
            {errorText ? (
              <p
                id={errorId}
                role="alert"
                className="flex items-start gap-1.5 text-[13px] leading-[19px] font-medium text-q-bad-fg"
              >
                <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                {errorText}
              </p>
            ) : null}
          </div>

          <div className="flex h-9 items-center justify-between rounded-md bg-surface-sunken px-3 text-[13px] text-neutral-strong ring-1 ring-border ring-inset">
            <span className="flex items-center gap-1.5">
              <Lock aria-hidden className="size-3.5" />
              Fecha y hora del servidor
            </span>
            <span
              className="font-mono text-[13px] font-medium text-foreground"
              data-testid="server-time"
            >
              {serverTime ? formatDateTime(serverTime) : "—"}
            </span>
          </div>

          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              <PenLine aria-hidden />
              {pending ? "Firmando…" : "Firmar"}
            </Button>
          </div>
          {sodBlocked ? (
            <p className="text-[13px] leading-[19px] text-neutral-strong">
              «Firmar» está deshabilitado: la segregación de funciones exige que firme otra persona.
            </p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
