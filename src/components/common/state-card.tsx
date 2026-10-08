import { CircleX, Inbox, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Estados obligatorios de cada pantalla (AGENTS.md regla 11; Prompt 0, componente StateCard):
 * vacío, cargando, error y sin permiso.
 */

type StateProps = {
  title: string;
  text?: string;
  /** Código de referencia (p. ej. código de error o de lote). */
  code?: string;
  action?: ReactNode;
  className?: string;
};

const KINDS = {
  vacio: { label: "Vacío", icon: Inbox, tile: "bg-surface-sunken text-text-secondary" },
  error: { label: "Error", icon: CircleX, tile: "bg-q-bad-bg text-q-bad-ic" },
  permiso: { label: "Sin permiso", icon: Lock, tile: "bg-tram-bloqueada-bg text-white" },
} as const;

function StateCard({
  kind,
  title,
  text,
  code,
  action,
  className,
}: StateProps & { kind: keyof typeof KINDS }) {
  const k = KINDS[kind];
  const Icon = k.icon;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "grid content-start justify-items-center gap-2.5 rounded-[10px] border border-border bg-surface px-5 py-6 text-center",
        className,
      )}
    >
      <span className={cn("flex size-14 items-center justify-center rounded-full", k.tile)}>
        <Icon aria-hidden className="size-7" />
      </span>
      <div className="text-label text-text-muted uppercase">{k.label}</div>
      <div className="text-base leading-[22px] font-semibold">{title}</div>
      {text ? <div className="max-w-prose text-small text-text-secondary">{text}</div> : null}
      {code ? (
        <span className="rounded-md bg-surface-sunken px-2 py-0.5 font-mono text-xs font-medium text-neutral-strong">
          {code}
        </span>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <StateCard kind="vacio" {...props} />;
}

export function ErrorState(props: StateProps) {
  return <StateCard kind="error" {...props} />;
}

export function NoPermissionState(props: StateProps) {
  return <StateCard kind="permiso" {...props} />;
}

type LoadingSkeletonProps = {
  /** Texto accesible de lo que se está cargando. */
  label?: string;
  /** Variante: tarjeta (bloques) o tabla (filas). */
  variant?: "card" | "table";
  rows?: number;
  className?: string;
};

export function LoadingSkeleton({
  label = "Cargando…",
  variant = "card",
  rows = 5,
  className,
}: LoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn("grid gap-2.5 rounded-[10px] border border-border bg-surface p-5", className)}
    >
      <div className="text-label text-text-muted uppercase">Cargando</div>
      {variant === "card" ? (
        <>
          <Skeleton className="h-5 w-[55%] bg-divider" />
          <Skeleton className="h-3.5 w-full bg-divider" />
          <Skeleton className="h-3.5 w-[85%] bg-divider" />
          <Skeleton className="h-9 w-full bg-divider" />
        </>
      ) : (
        Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full bg-divider" />
        ))
      )}
      <span className="text-small text-text-secondary">{label}</span>
    </div>
  );
}
