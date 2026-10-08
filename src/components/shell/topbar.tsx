"use client";

import { Bell, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/auth/navigation";
import { UserMenu } from "./user-menu";

type TopbarProps = {
  fullName: string;
  roleLabel: string;
  initials: string;
  shortSignature: string | null;
};

/** Barra superior: sección actual, buscador, avisos y menú de usuario (Prompt 0). */
export function Topbar(props: TopbarProps) {
  const pathname = usePathname();
  const section =
    Object.values(NAV_ITEMS).find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))
      ?.label ?? "Inicio";
  return (
    <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-border bg-surface px-6 max-[1279px]:h-16 max-[1279px]:px-4">
      <span className="text-sm leading-5 font-semibold">{section}</span>
      <div
        className="ml-auto flex h-9 w-[300px] items-center gap-2 rounded-md border border-border-control px-3 text-sm text-text-muted max-[1279px]:w-auto"
        aria-disabled="true"
        title="El buscador se habilita con los módulos de datos"
      >
        <Search aria-hidden className="size-4" />
        <span className="flex-1 max-[1279px]:sr-only">Buscar lote, orden o equipo…</span>
      </div>
      <span
        className="flex size-9 items-center justify-center text-text-strong"
        title="Sin avisos pendientes"
      >
        <Bell aria-hidden className="size-[22px]" />
        <span className="sr-only">Sin avisos pendientes</span>
      </span>
      <UserMenu {...props} />
    </header>
  );
}
