"use client";

import { ChevronDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/login/actions";

type UserMenuProps = {
  fullName: string;
  roleLabel: string;
  initials: string;
  shortSignature: string | null;
};

export function UserMenu({ fullName, roleLabel, initials, shortSignature }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-md py-1 pr-1 pl-2 text-left"
        aria-label={`Menú de usuario de ${fullName}`}
      >
        <span className="flex size-[34px] items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary-hover">
          {initials}
        </span>
        <span className="text-xs leading-4 text-text-secondary max-[1279px]:hidden">
          <b className="block text-[13px] leading-4 font-semibold text-foreground">{fullName}</b>
          {roleLabel}
        </span>
        <ChevronDown aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="grid gap-0.5">
          <span className="font-semibold">{fullName}</span>
          <span className="text-xs font-normal text-text-secondary">{roleLabel}</span>
          {shortSignature ? (
            <span className="text-xs font-normal text-text-secondary">
              Firma corta: {shortSignature}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void signOut("salida");
          }}
        >
          <LogOut aria-hidden />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
