"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

export type DocTab = { href: string; label: string; match: string[]; exact?: boolean };

/** Secciones del sistema de gestión documental (S-43…S-49) según el rol. */
export function DocumentsTabs({ tabs }: { tabs: DocTab[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones de Documentos"
      className="flex flex-wrap gap-1 border-b border-border bg-surface px-8 max-[1279px]:px-4"
    >
      {tabs.map((t) => {
        const active = t.match.some((m) =>
          t.exact ? pathname === m : pathname === m || pathname.startsWith(`${m}/`),
        );
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-3 text-sm no-underline",
              active
                ? "border-primary font-semibold text-primary"
                : "border-transparent font-medium text-text-strong",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
