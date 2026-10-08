import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type Breadcrumb = { label: string; href?: string };

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Migas de pan: toda pantalla de detalle tiene ruta de regreso (PRD §12). */
  breadcrumbs?: Breadcrumb[];
  /** Acciones principales alineadas a la derecha. */
  actions?: ReactNode;
  /** Contenido bajo el título (sello de documento, insignias). */
  meta?: ReactNode;
};

export function PageHeader({ title, description, breadcrumbs, actions, meta }: PageHeaderProps) {
  return (
    <div className="grid gap-3 pb-6">
      {breadcrumbs?.length ? (
        <nav aria-label="Migas de pan">
          <ol className="flex flex-wrap items-center gap-1 text-small text-text-secondary">
            {breadcrumbs.map((b, i) => {
              const last = i === breadcrumbs.length - 1;
              return (
                <li key={`${b.label}-${i}`} className="flex items-center gap-1">
                  {b.href && !last ? (
                    <Link href={b.href} className="hover:underline">
                      {b.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? "page" : undefined}>{b.label}</span>
                  )}
                  {!last ? <ChevronRight aria-hidden className="size-3.5" /> : null}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-page-title">{title}</h1>
          {description ? <p className="max-w-prose text-text-secondary">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
    </div>
  );
}
