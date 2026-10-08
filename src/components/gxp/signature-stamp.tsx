import { Lock } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { MEANINGS, type SignatureMeaning } from "@/lib/gxp/meanings";

export type StampSignature = {
  meaning: SignatureMeaning;
  signerName: string;
  shortSignature: string;
  signedAt: string;
};

/**
 * Sello de firma (Prompt 0, 5.b): candado + «Ejecutó: Diego Cárdenas (D. Cárdenas) · 05/10/2026 14:32»,
 * una fila por firma.
 */
export function SignatureStamp({ signatures }: { signatures: StampSignature[] }) {
  if (signatures.length === 0) return null;
  return (
    <ul
      className="grid gap-1 rounded-lg border border-border bg-surface-sunken px-3 py-2"
      aria-label="Firmas del registro"
    >
      {signatures.map((s) => (
        <li
          key={`${s.meaning}-${s.signedAt}`}
          className="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-5 text-neutral-strong"
        >
          <Lock aria-hidden className="size-3.5 text-text-secondary" />
          <b className="font-semibold text-foreground">{MEANINGS[s.meaning].stamp}:</b>
          <span>
            {s.signerName} <span className="text-text-secondary">({s.shortSignature})</span>
          </span>
          <span className="text-text-secondary">·</span>
          <span className="font-mono text-xs font-medium">{formatDateTime(s.signedAt)}</span>
        </li>
      ))}
    </ul>
  );
}
