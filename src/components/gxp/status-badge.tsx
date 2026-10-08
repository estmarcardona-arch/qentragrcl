import { cn } from "cn";
import { STATUSES, type StatusKey } from "./status";

type StatusBadgeProps = {
  status: StatusKey;
  /** Texto alternativo al del catálogo (p. ej. «Liberado»), conservando ícono y color. */
  label?: string;
  size?: "sm" | "lg";
  className?: string;
};

/** Insignia de estado con color + ícono + texto (nunca solo color). */
export function StatusBadge({ status, label, size = "sm", className }: StatusBadgeProps) {
  const def = STATUSES[status];
  const Icon = def.icon;
  const lg = size === "lg";
  return (
    <span
      data-family={def.family}
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset",
        lg ? "h-8 pr-3.5 pl-3 text-sm" : "h-6 pr-2.5 pl-2 text-xs",
        def.className,
        className,
      )}
    >
      <Icon aria-hidden className={lg ? "size-[18px]" : "size-3.5"} />
      {label ?? def.label}
    </span>
  );
}
