import type { Metadata } from "next";
import {
  ChartColumn,
  ClipboardCheck,
  Clock,
  Factory,
  FileText,
  Flag,
  FlaskConical,
  Boxes,
  Eye,
  ListChecks,
  Lock,
  OctagonAlert,
  PenLine,
  RefreshCw,
  Send,
  TriangleAlert,
  Users,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/gxp/status-badge";
import { requireSession } from "@/lib/auth/session";
import { cardsForRoles, greeting, isoWeek, type CardIcon } from "@/lib/dashboard/cards";
import { TIME_ZONE, formatDate, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Inicio · GRUFARCOL eBR" };

const ICONS: Record<CardIcon, LucideIcon> = {
  factory: Factory,
  sign: PenLine,
  clock: Clock,
  lock: Lock,
  file: FileText,
  flag: Flag,
  box: Boxes,
  triangle: TriangleAlert,
  eye: Eye,
  approve: ClipboardCheck,
  release: Send,
  diamond: OctagonAlert,
  users: Users,
  flask: FlaskConical,
  audit: ListChecks,
  chart: ChartColumn,
};

// S-02 · Panel por rol (Prompt 1). En E1 las tarjetas no tienen datos: muestran «Sin datos» y la
// etapa en que se habilitan. Los conteos se conectan a las listas reales en cada módulo (RF-02).
export default async function InicioPage() {
  const ctx = await requireSession();
  const now = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("es-CO", {
      timeZone: TIME_ZONE,
      weekday: "long",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = parts.weekday.charAt(0).toUpperCase() + parts.weekday.slice(1);
  const week = isoWeek(Number(parts.year), Number(parts.month), Number(parts.day));
  const cards = cardsForRoles(ctx.roles);

  return (
    <main className="grid content-start gap-[22px] px-8 pt-7 pb-9 max-[1279px]:px-4">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-page-title">{greeting(ctx.fullName, Number(parts.hour))}</h1>
          <p className="text-sm leading-[22px] text-text-secondary">
            {weekday} {formatDate(now)} · Semana {week} · {ctx.jobTitle ?? ""}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-small text-text-secondary">
          <RefreshCw aria-hidden className="size-3.5" />
          Actualizado {formatTime(now)}
        </span>
      </div>

      <section
        aria-label="Tareas de hoy"
        className="grid grid-cols-4 gap-4 max-[1279px]:grid-cols-2"
      >
        {cards.map((card) => {
          const Icon = ICONS[card.icon];
          return (
            <article
              key={card.id}
              data-testid="dashboard-card"
              className="grid content-start gap-2.5 rounded-[10px] border border-border bg-surface-sunken px-[18px] py-4"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-divider text-text-secondary">
                  <Icon aria-hidden className="size-[18px]" />
                </span>
                <h2 className="text-sm leading-5 font-semibold">{card.label}</h2>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-figure text-text-secondary" aria-hidden>
                  —
                </span>
                <StatusBadge status="sin_dato" label="Sin datos" />
              </div>
              <p className="min-h-[38px] text-[13px] leading-[19px] text-neutral-strong">
                Se mostrará cuando el módulo esté disponible (etapa {card.stage}).
              </p>
              <span
                aria-disabled="true"
                className="flex items-center gap-1 text-[13px] leading-[18px] font-semibold text-text-muted"
              >
                {card.link}
                <ChevronRight aria-hidden className="size-3.5" />
              </span>
            </article>
          );
        })}
      </section>
    </main>
  );
}
