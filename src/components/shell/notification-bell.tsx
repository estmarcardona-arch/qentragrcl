"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markNotificationsRead } from "@/lib/equipment/actions";
import { formatDateTime } from "@/lib/format";

export type BellNotification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
};

/** Avisos internos (RF-51): vencimientos de equipos y, en fases siguientes, otros recordatorios. */
export function NotificationBell({ items }: { items: BellNotification[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const n = items.length;
  const label = n ? `${n} aviso${n === 1 ? "" : "s"} sin leer` : "Sin avisos pendientes";
  const read = (ids?: string[]) =>
    start(async () => {
      await markNotificationsRead(ids);
      router.refresh();
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex size-9 items-center justify-center rounded-md text-text-strong"
        aria-label={label}
        title={label}
        data-testid="bell"
      >
        <Bell aria-hidden className="size-[22px]" />
        {n ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-q-bad-ic px-1 text-[11px] font-semibold text-white">
            {n > 9 ? "9+" : n}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Avisos</span>
          {n ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => read()}
              className="text-xs font-normal text-primary underline"
            >
              Marcar todos como leídos
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {n === 0 ? (
          <p className="px-2 py-3 text-sm text-text-secondary">No tiene avisos pendientes.</p>
        ) : (
          items.map((i) => (
            <DropdownMenuItem key={i.id} asChild onSelect={() => read([i.id])}>
              <Link href={i.link ?? "/inicio"} className="grid gap-0.5 no-underline">
                <span className="text-sm font-semibold text-foreground">{i.title}</span>
                {i.body ? <span className="text-xs text-text-secondary">{i.body}</span> : null}
                <span className="font-mono text-[11px] text-text-muted">
                  {formatDateTime(i.created_at)}
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
