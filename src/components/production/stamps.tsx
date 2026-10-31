import { CircleCheck, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/format";

/** Sellos de ejecutor y verificador con la hora del servidor. */
export function Stamps({
  executedBy,
  executedAt,
  verifiedBy,
  verifiedAt,
  verifyLabel = "Verificó",
}: {
  executedBy: string;
  executedAt: string;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  verifyLabel?: string;
}) {
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
      <span className="inline-flex items-center gap-1">
        <CircleCheck aria-hidden className="size-3.5 text-q-ok-ic" />
        Ejecutó {executedBy} · {formatDateTime(executedAt)}
      </span>
      {verifiedBy ? (
        <span className="inline-flex items-center gap-1">
          <CircleCheck aria-hidden className="size-3.5 text-q-ok-ic" />
          {verifyLabel} {verifiedBy} · {verifiedAt ? formatDateTime(verifiedAt) : ""}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-q-warn-fg">
          <Clock aria-hidden className="size-3.5" />
          Pendiente de verificación
        </span>
      )}
    </span>
  );
}
