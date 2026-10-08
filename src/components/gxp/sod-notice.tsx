import { Users } from "lucide-react";
import type { ReactNode } from "react";

type SodNoticeProps = {
  /** Qué no puede hacer: «No puede verificar este paso». */
  title: string;
  /** Por qué, en una frase con la regla. */
  reason: string;
  /** Quién sí puede hacerlo. */
  who?: string;
  /** Acción sugerida (botón o enlace). */
  action?: ReactNode;
};

/**
 * Aviso de segregación de funciones (Prompt 0, 5.d). Neutro oscuro: es una regla, no una falla.
 * Dice por qué la persona no puede y quién sí puede.
 */
export function SodNotice({ title, reason, who, action }: SodNoticeProps) {
  return (
    <div
      role="note"
      className="grid grid-cols-[40px_1fr] gap-3.5 rounded-[10px] border border-neutral-strong bg-surface p-4"
    >
      <span className="flex size-10 items-center justify-center rounded-[10px] bg-neutral-strong text-white">
        <Users aria-hidden className="size-[22px]" />
      </span>
      <div className="grid justify-items-start gap-1.5">
        <b className="text-[15px] leading-5 font-semibold">{title}</b>
        <span className="text-sm leading-[21px] text-text-strong">{reason}</span>
        {who ? <span className="text-small text-text-secondary">{who}</span> : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    </div>
  );
}
