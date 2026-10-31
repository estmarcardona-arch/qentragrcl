"use client";

import { CircleX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ReauthDialog } from "@/components/documents/reauth-dialog";
import { Button } from "@/components/ui/button";
import type { PrResult } from "@/lib/production/actions";

export type Summary = { label: string; value: string; mono?: boolean }[];

/**
 * Acción con firma electrónica: botón grande (tablet), diálogo con qué se firma, quién firma y la contraseña. La base
 * valida rol, estado, SOD y reglas GMP; el error vuelve con regla y acción.
 */
export function SignedAction({
  label,
  title,
  meaning,
  summary,
  signer,
  confirmLabel = "Firmar",
  run,
  children,
  variant = "default",
  disabled,
  validate,
  testId,
}: {
  label: string;
  title: string;
  meaning: string;
  summary: Summary;
  signer: string;
  confirmLabel?: string;
  run: (password: string) => Promise<PrResult<object>>;
  children?: ReactNode;
  variant?: "default" | "secondary" | "destructive";
  disabled?: boolean;
  /** Validación local antes de pedir la contraseña (campos vacíos). */
  validate?: () => string | null;
  testId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  return (
    <>
      <Button
        type="button"
        size="lg"
        variant={variant}
        disabled={disabled}
        data-testid={testId}
        className="min-h-12 px-5 text-[15px]"
        onClick={() => {
          const msg = validate?.() ?? null;
          setLocal(msg);
          if (!msg) setOpen(true);
        }}
      >
        {label}
      </Button>
      {local ? (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg">
          <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {local}
        </p>
      ) : null}
      {open ? (
        <ReauthDialog
          open
          onOpenChange={setOpen}
          title={title}
          meaning={meaning}
          summary={summary}
          signer={signer}
          confirmLabel={confirmLabel}
          onConfirm={(pw) => run(pw)}
          onDone={() => {
            setOpen(false);
            router.refresh();
          }}
        >
          {children}
        </ReauthDialog>
      ) : null}
    </>
  );
}

/** Error de una acción sin firma (iniciar etapa, borrador). */
export function ResultError({ error }: { error: Exclude<PrResult, { ok: true }> | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg">
      <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {error.rule} {error.detail ? `(${error.detail}) ` : ""}
        {error.action}
      </span>
    </p>
  );
}
