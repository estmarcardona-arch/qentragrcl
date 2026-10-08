import { formatDateTime } from "@/lib/format";

export type Correction = {
  oldValue: string;
  newValue: string;
  reason: string;
  shortSignature: string;
  correctedAt: string;
};

/**
 * Corrección (Prompt 0, 5.c; DI-12): valor anterior tachado y visible, valor nuevo con asterisco,
 * motivo, firma corta y fecha. Nunca se borra nada.
 */
export function CorrectedValue({
  value,
  corrections,
}: {
  value: string;
  corrections: Correction[];
}) {
  if (corrections.length === 0) return <span>{value}</span>;
  const last = corrections[corrections.length - 1];
  return (
    <span className="grid gap-0.5">
      <span className="flex flex-wrap items-baseline gap-2">
        {[value, ...corrections.slice(0, -1).map((c) => c.newValue)].map((v, i) => (
          <del key={i} className="text-text-secondary decoration-q-bad-ic decoration-2">
            <span className="sr-only">Valor anterior: </span>
            {v}
          </del>
        ))}
        <ins className="font-semibold no-underline">
          <span className="sr-only">Valor corregido: </span>
          {last.newValue}
          <span aria-hidden>*</span>
        </ins>
      </span>
      <span className="text-xs leading-4 text-text-secondary">
        * {last.reason} · {last.shortSignature} · {formatDateTime(last.correctedAt)}
        {corrections.length > 1 ? ` · ${corrections.length} correcciones` : ""}
      </span>
    </span>
  );
}
