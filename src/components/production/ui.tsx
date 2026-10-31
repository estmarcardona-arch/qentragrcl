import { Check, Circle, Lock, Play, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { formatDateTime } from "@/lib/format";

// Piezas visuales de Producción tomadas de los diseños S-15…S-21, S-38 y S-39 (docs/diseno).

/** Código en monoespaciada dentro de una pastilla (lote, orden): «L-2610-018». */
export function CodeChip({ children, size = "md" }: { children: ReactNode; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border-control bg-surface-sunken font-mono font-semibold whitespace-nowrap",
        size === "lg" ? "px-2.5 py-1 text-[22px] leading-7" : "px-2 py-0.5 text-[15px] leading-6",
      )}
    >
      {children}
    </span>
  );
}

/** Tarjeta con encabezado opcional (título, subtítulo y acción a la derecha). */
export function Card({
  title,
  subtitle,
  aside,
  number,
  children,
  className,
  tone,
  testId,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  number?: number;
  children?: ReactNode;
  className?: string;
  tone?: "primary" | "bad" | "warn";
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className={cn(
        "grid content-start gap-4 rounded-[10px] border bg-surface p-5",
        tone === "primary"
          ? "border-2 border-primary"
          : tone === "bad"
            ? "border-q-bad-bd"
            : tone === "warn"
              ? "border-q-warn-bd"
              : "border-border",
        className,
      )}
    >
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {number ? (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-white">
                {number}
              </span>
            ) : null}
            <div className="grid gap-0.5">
              <h2 className="text-[18px] leading-7 font-semibold">{title}</h2>
              {subtitle ? <p className="text-sm text-text-secondary">{subtitle}</p> : null}
            </div>
          </div>
          {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Bloqueo por regla GMP (Prompt 0): qué regla y qué hacer; el color dice la gravedad, el texto la regla. */
export function GmpBlock({
  rule,
  action,
  children,
  tone = "bad",
  title = "Bloqueado por regla GMP",
  testId,
}: {
  rule: ReactNode;
  action: ReactNode;
  children?: ReactNode;
  tone?: "bad" | "neutral";
  title?: string;
  testId?: string;
}) {
  return (
    <div
      role="alert"
      data-testid={testId}
      className={cn(
        "grid grid-cols-[44px_1fr] gap-3.5 rounded-[10px] border bg-surface p-4",
        tone === "bad" ? "border-q-bad-bd" : "border-neutral-strong",
      )}
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-[10px]",
          tone === "bad" ? "bg-q-bad-bg text-q-bad-fg" : "bg-neutral-strong text-white",
        )}
      >
        <Lock aria-hidden className="size-5" />
      </span>
      <div className="grid gap-2">
        <b className="text-[16px] leading-6 font-semibold">{title}</b>
        <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-label text-text-secondary uppercase">Qué regla</dt>
          <dd>{rule}</dd>
          <dt className="text-label text-text-secondary uppercase">Qué hacer</dt>
          <dd>{action}</dd>
        </dl>
        {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </div>
  );
}

/** Sellos de firma (S-17): Ejecutó / Verificó con nombre y hora del servidor, o pendiente. */
export function Seals({
  executedBy,
  executedAt,
  verifiedBy,
  verifiedAt,
  note,
}: {
  executedBy?: string | null;
  executedAt?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  note?: ReactNode;
}) {
  const seal = (label: string, who?: string | null, at?: string | null) => (
    <div
      className={cn(
        "grid grid-cols-[32px_1fr] items-start gap-3 rounded-lg border p-3",
        who ? "border-border-control" : "border-border bg-surface-sunken",
      )}
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-md",
          who ? "bg-neutral-strong text-white" : "bg-text-muted/40 text-white",
        )}
      >
        {who ? <Lock aria-hidden className="size-4" /> : <Circle aria-hidden className="size-4" />}
      </span>
      <span className="grid text-sm">
        <span>
          <b className="font-semibold">{label}:</b>{" "}
          {who ?? <span className="text-text-secondary">pendiente de firma</span>}
        </span>
        <span className="font-mono text-xs text-text-secondary">
          {at ? formatDateTime(at) : "—"}
        </span>
      </span>
    </div>
  );
  return (
    <div className="grid gap-2" data-testid="seals">
      {seal("Ejecutó", executedBy, executedAt)}
      {seal("Verificó", verifiedBy, verifiedAt)}
      {note ? <p className="text-sm text-text-secondary">{note}</p> : null}
    </div>
  );
}

export type LineNode = {
  key: string;
  label: string;
  state: "completada" | "actual" | "bloqueada" | "pendiente";
  chip?: string;
  detail?: string;
  href?: string;
};

/** Línea de proceso del lote (S-16): círculo relleno = completada, anillo = actual, candado = bloqueada. */
export function ProcessTrack({ nodes, compact }: { nodes: LineNode[]; compact?: boolean }) {
  return (
    <ol
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${nodes.length}, minmax(0, 1fr))` }}
      aria-label="Línea de proceso del lote"
      data-testid="process-line"
    >
      {nodes.map((n, i) => {
        const Icon =
          n.state === "completada"
            ? Check
            : n.state === "actual"
              ? Play
              : n.state === "bloqueada"
                ? Lock
                : Circle;
        const body = (
          <>
            <span className="relative flex w-full justify-center">
              {i > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 right-1/2 left-[-50%] -z-0 h-0.5 -translate-y-1/2",
                    n.state === "completada" || n.state === "actual"
                      ? "bg-primary"
                      : "border-t-2 border-dashed border-border-control",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-12 items-center justify-center rounded-full border-2",
                  n.state === "completada" && "border-primary bg-primary text-white",
                  n.state === "actual" &&
                    "border-primary bg-surface text-primary ring-4 ring-primary-soft",
                  n.state === "bloqueada" &&
                    "border-border-control bg-surface-sunken text-text-strong",
                  n.state === "pendiente" && "border-border-control bg-surface text-text-secondary",
                )}
              >
                <Icon aria-hidden className="size-5" />
              </span>
            </span>
            <span className="text-[15px] font-semibold text-foreground">{n.label}</span>
            {n.chip && !compact ? (
              <span
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold",
                  n.state === "completada" && "bg-primary text-white",
                  n.state === "actual" && "border border-primary bg-primary-soft text-primary",
                  n.state === "bloqueada" && "bg-neutral-strong text-white",
                  n.state === "pendiente" && "border border-border-control text-text-strong",
                )}
              >
                {n.state === "completada" ? (
                  <Check aria-hidden className="size-3" />
                ) : n.state === "actual" ? (
                  <Play aria-hidden className="size-3" />
                ) : n.state === "bloqueada" ? (
                  <Lock aria-hidden className="size-3" />
                ) : null}
                {n.chip}
              </span>
            ) : null}
            {n.detail ? (
              <span className="text-center text-[13px] text-text-secondary">{n.detail}</span>
            ) : null}
            <span className="sr-only">({n.state})</span>
          </>
        );
        return (
          <li
            key={n.key}
            data-state={n.state}
            className="grid justify-items-center gap-1.5 text-center"
          >
            {n.href ? (
              <a href={n.href} className="grid w-full justify-items-center gap-1.5 no-underline">
                {body}
              </a>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Barra de rendimiento con límites (S-19d, S-20): marca el valor y la franja permitida. */
export function YieldBar({
  pct,
  min,
  max,
  from = 90,
  to = 104,
}: {
  pct: number;
  min?: number | null;
  max?: number | null;
  from?: number;
  to?: number;
}) {
  const pos = (v: number) => `${Math.min(Math.max(((v - from) / (to - from)) * 100, 0), 100)}%`;
  return (
    <div className="grid gap-1" aria-hidden>
      <div className="relative h-2 rounded-full bg-divider">
        <span
          className="absolute top-0 h-2 rounded-full bg-primary/50"
          style={{ left: pos(min ?? from), right: `calc(100% - ${pos(max ?? to)})` }}
        />
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-surface"
          style={{ left: pos(pct) }}
        />
      </div>
      <div className="flex justify-between font-mono text-[11px] text-text-secondary">
        <span>{from.toFixed(1).replace(".", ",")} %</span>
        <span>
          {min != null ? `límite ≥ ${min.toFixed(1).replace(".", ",")} %` : "sin límite definido"}
        </span>
        <span>{to.toFixed(1).replace(".", ",")} %</span>
      </div>
    </div>
  );
}

export function SignIcon() {
  return <PenLine aria-hidden className="size-4" />;
}

export type EquipmentRow = {
  id: string;
  code: string;
  name: string;
  valid: boolean;
  reasons: string[];
  calibrationDue: string | null;
  maintenanceDue: string | null;
  cleaningUntil: string | null;
};

/** Vigencia de los equipos de la etapa (S-17, S-19): calibración, mantenimiento y limpieza con semáforo y texto. */
export function EquipmentTable({ rows, now }: { rows: EquipmentRow[]; now: string }) {
  const nowMs = Date.parse(now);
  const due = (v: string | null, hours: number) => {
    if (v === "N.A.") return { cls: "text-text-secondary", label: "No aplica", text: "" };
    if (!v) return { cls: "bg-q-off-bg text-q-off-fg ring-q-off-bd", label: "Sin dato", text: "" };
    const ms = Date.parse(v.length === 10 ? `${v}T23:59:59-05:00` : v);
    const text =
      v.length === 10 ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : formatDateTime(v);
    if (ms < nowMs)
      return {
        cls: "bg-q-bad-bg text-q-bad-fg ring-q-bad-bd",
        label: "Vencido",
        text: `Venció ${text}`,
      };
    if (ms - nowMs <= hours * 3_600_000)
      return {
        cls: "bg-q-warn-bg text-q-warn-fg ring-q-warn-bd",
        label: "Por vencer",
        text: `Hasta ${text}`,
      };
    return { cls: "bg-q-ok-bg text-q-ok-fg ring-q-ok-bd", label: "Vigente", text: `Hasta ${text}` };
  };
  const cell = (v: string | null, hours: number) => {
    const d = due(v, hours);
    return (
      <td className="px-3 py-2.5">
        {d.label === "No aplica" ? (
          <span className="text-xs text-text-secondary">No aplica</span>
        ) : (
          <>
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset",
                d.cls,
              )}
            >
              {d.label}
            </span>
            {d.text ? <span className="block text-xs text-text-secondary">{d.text}</span> : null}
          </>
        )}
      </td>
    );
  };
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-sm" data-testid="equipment-validity">
        <thead className="bg-surface-sunken">
          <tr>
            {["Equipo", "Calibración", "Mantenimiento", "Limpieza"].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 text-label uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={cn("border-t border-divider", !r.valid && "bg-q-bad-bg/60")}
              data-equipment={r.code}
            >
              <td className="px-3 py-2.5">
                <b className="font-mono font-semibold">{r.code}</b>
                <span className="block text-xs text-text-secondary">{r.name}</span>
              </td>
              {cell(r.calibrationDue, 30 * 24)}
              {cell(r.maintenanceDue, 30 * 24)}
              {cell(r.cleaningUntil, 48)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
