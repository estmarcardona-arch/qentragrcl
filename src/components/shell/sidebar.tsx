"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import type { NavItem } from "@/lib/auth/navigation";
import { NAV_ICONS } from "./nav-icons";

type SidebarProps = { items: NavItem[]; roleLabel: string };

/** Menú lateral (232 px; riel en tablet). Las secciones de etapas futuras se ven deshabilitadas. */
export function Sidebar({ items, roleLabel }: SidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="flex w-[232px] shrink-0 flex-col gap-0.5 border-r border-border bg-surface px-3 py-3.5 max-[1279px]:w-[72px] max-[1279px]:px-2">
      <div className="flex items-center gap-2.5 px-2 pt-0.5 pb-3.5 max-[1279px]:justify-center max-[1279px]:px-0">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-primary text-white">
          <ShieldCheck aria-hidden className="size-[18px]" />
        </span>
        <span className="text-[15px] leading-5 font-semibold max-[1279px]:sr-only">
          GRUFARCOL eBR
        </span>
      </div>
      <nav aria-label="Menú principal" className="grid gap-0.5">
        {items.map((item) => {
          const Icon = NAV_ICONS[item.key];
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const base =
            "flex h-10 items-center gap-3 rounded-md px-2.5 text-sm leading-5 max-[1279px]:h-11 max-[1279px]:justify-center max-[1279px]:px-0";
          if (item.stage) {
            return (
              <span
                key={item.key}
                aria-disabled="true"
                title={`Disponible en la etapa ${item.stage}`}
                className={cn(base, "cursor-not-allowed font-medium text-text-muted")}
              >
                <Icon aria-hidden className="size-5 shrink-0" />
                <span className="flex-1 max-[1279px]:sr-only">{item.label}</span>
                <span className="sr-only">(disponible en la etapa {item.stage})</span>
              </span>
            );
          }
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                base,
                "no-underline",
                isActive
                  ? "bg-primary-tint font-semibold text-primary-hover"
                  : "font-medium text-text-strong hover:bg-surface-sunken",
              )}
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              <span className="flex-1 max-[1279px]:sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-divider px-2 pt-3 text-xs leading-4 text-text-secondary max-[1279px]:sr-only">
        Rol activo
        <br />
        <b className="text-[13px] font-semibold text-foreground">{roleLabel}</b>
      </div>
    </aside>
  );
}
