"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const TABS = [
  { href: "/admin/usuarios", label: "Usuarios y roles" },
  { href: "/admin/catalogos", label: "Catálogos y configuración" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones de Administración"
      className="flex gap-1 border-b border-border bg-surface px-8 max-[1279px]:px-4"
    >
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
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
