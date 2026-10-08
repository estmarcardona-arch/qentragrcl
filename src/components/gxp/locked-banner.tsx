import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { SignatureStamp, type StampSignature } from "./signature-stamp";

/**
 * Aviso de registro firmado y bloqueado (DI-3). Los campos se muestran en solo lectura; un cambio
 * se hace como corrección con motivo (DI-4).
 */
export function LockedBanner({
  signatures,
  action,
}: {
  signatures: StampSignature[];
  /** Acción permitida (p. ej. botón «Registrar corrección»). */
  action?: ReactNode;
}) {
  return (
    <section
      aria-label="Registro firmado y bloqueado"
      className="grid grid-cols-[40px_1fr] gap-3.5 rounded-[10px] border border-neutral-strong bg-surface p-4"
    >
      <span className="flex size-10 items-center justify-center rounded-[10px] bg-neutral-strong text-white">
        <Lock aria-hidden className="size-[22px]" />
      </span>
      <div className="grid gap-2">
        <div>
          <b className="text-[15px] leading-5 font-semibold">Registro firmado y bloqueado</b>
          <p className="text-sm leading-[21px] text-text-strong">
            Los datos firmados no se editan. Para cambiar un valor, registre una corrección con
            motivo: el valor anterior queda visible y tachado.
          </p>
        </div>
        <SignatureStamp signatures={signatures} />
        {action ? <div>{action}</div> : null}
      </div>
    </section>
  );
}
