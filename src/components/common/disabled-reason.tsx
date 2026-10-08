import { Info } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Motivo de un botón deshabilitado por una regla (PRD §13, regla 8; Prompt 0).
 * Se coloca junto al botón y se enlaza con aria-describedby desde él.
 */
export function DisabledReason({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-small text-text-secondary">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
