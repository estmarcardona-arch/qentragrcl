import { CircleMinus, File, Lock, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { formatDocumentDate } from "@/lib/format";

type ControlledDocumentHeaderProps = {
  title: string;
  /** Código del documento: PPP-TT-NNN o PPP-TT-NNN-LL-## */
  code: string;
  /** Versión de dos dígitos («03»). */
  version: string;
  issueDate: Date | string;
  reviewDate: Date | string;
  page: number;
  pageCount: number;
  /** Estado del documento como texto («Vigente»). */
  status: string;
};

/**
 * Encabezado de documento controlado (Prompt 0, 5.m; PRD 2.5.3).
 * Encabeza todo documento, formato y PDF. Las fechas del documento van DD-MM-AAAA.
 */
export function ControlledDocumentHeader(props: ControlledDocumentHeaderProps) {
  const cells: { k: string; v: ReactNode; mono?: boolean; strong?: boolean }[] = [
    { k: "Código", v: props.code, mono: true },
    { k: "Versión", v: props.version, strong: true },
    { k: "Fecha de emisión", v: formatDocumentDate(props.issueDate) },
    { k: "Fecha de revisión", v: formatDocumentDate(props.reviewDate) },
    { k: "Página", v: `${props.page} de ${props.pageCount}`, strong: true },
    { k: "Estado", v: props.status, strong: true },
  ];
  return (
    <header className="border-2 border-foreground bg-surface">
      <div className="grid grid-cols-[200px_minmax(0,1fr)_300px] max-[1279px]:grid-cols-[160px_minmax(0,1fr)_280px]">
        <div className="flex items-center gap-2.5 border-r-2 border-foreground px-4 py-3.5">
          <span className="flex size-9 items-center justify-center rounded-[9px] bg-primary text-white">
            <ShieldCheck aria-hidden className="size-[22px]" />
          </span>
          <b className="text-base leading-5 font-semibold">GRUFARCOL</b>
        </div>
        <div className="grid content-center border-r-2 border-foreground px-5 py-3.5 text-center">
          <h2 className="text-lg leading-[26px] font-semibold">{props.title}</h2>
        </div>
        <dl className="grid grid-cols-2 text-[13px] leading-[18px]">
          {cells.map((c, i) => (
            <div
              key={c.k}
              className={cn(
                "border-b border-border-strong px-2.5 py-1.5",
                i % 2 === 0 && "border-r",
              )}
            >
              <dt className="block text-[10px] leading-[14px] font-semibold tracking-[.04em] text-text-secondary uppercase">
                {c.k}
              </dt>
              <dd
                className={cn(
                  c.mono && "font-mono text-xs font-semibold whitespace-nowrap",
                  c.strong && "font-semibold",
                  !c.mono && !c.strong && "font-medium",
                )}
              >
                {c.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}

const COPY_STAMPS = {
  controlada: {
    label: "Copia controlada",
    icon: Lock,
    className: "bg-primary text-white border-primary",
  },
  no_controlada: {
    label: "Copia no controlada",
    icon: File,
    className: "bg-surface text-text-strong border-text-strong",
  },
  obsoleto: {
    label: "OBSOLETO",
    icon: CircleMinus,
    className: "bg-neutral-strong text-white border-neutral-strong",
  },
} as const;

/** Sello del pie de documento: copia controlada, no controlada u OBSOLETO (PRD RF-103). */
export function CopyStamp({ kind }: { kind: keyof typeof COPY_STAMPS }) {
  const s = COPY_STAMPS[kind];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex min-h-[34px] items-center gap-2 rounded-md border-2 px-3.5 text-[13px] leading-none font-bold tracking-[.06em] uppercase",
        s.className,
      )}
    >
      <Icon aria-hidden className="size-4" />
      {s.label}
    </span>
  );
}
