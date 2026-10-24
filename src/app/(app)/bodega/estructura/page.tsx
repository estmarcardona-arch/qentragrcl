import type { Metadata } from "next";
import {
  Box,
  Factory,
  FlaskConical,
  GitBranch,
  House,
  Lock,
  PackageCheck,
  Plus,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import { CLASS_LABELS, FUNCTION_LABELS, WAREHOUSE_STATUS } from "@/lib/warehouse/labels";
import { loadWarehouses, qualification, todayBogota } from "@/lib/warehouse/structure";

export const metadata: Metadata = { title: "Bodegas y ubicaciones · GRUFARCOL eBR" };

const ICONS: Record<string, LucideIcon> = {
  materias_primas: FlaskConical,
  material_envase: Box,
  material_empaque: Box,
  granel: Factory,
  producto_terminado: PackageCheck,
  rechazo: Lock,
  devolucion: RefreshCw,
};

// S-41a · Bodegas y ubicaciones (RF-23): tarjetas con código, función, sitio interno o externo (con su tercero y
// calificación), estructura estantes × pisos × posiciones y ocupación.
export default async function StructurePage() {
  const a = await getWarehouseAccess();
  if (!a.structRead && !a.structEdit && !a.structApprove) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a la estructura de bodegas" />
      </main>
    );
  }
  const whs = await loadWarehouses(a);
  const today = todayBogota();
  const internals = whs.filter((w) => w.site_type === "interna").length;
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Bodegas y ubicaciones"
        description={`${whs.length} bodegas · ${internals} internas y ${whs.length - internals} externas · ${whs.reduce((s, w) => s + w.total, 0)} ubicaciones`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Bodega" },
          { label: "Bodegas y ubicaciones" },
        ]}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/bodega/estructura/terceros">Terceros y calificación</Link>
            </Button>
            {a.structEdit ? (
              <Button asChild>
                <Link href="/bodega/estructura/nueva">
                  <Plus aria-hidden /> Nueva bodega
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      {whs.length === 0 ? (
        <EmptyState
          title="Aún no hay bodegas"
          text="Cree la primera bodega con su estructura de estantes, pisos y posiciones."
        />
      ) : (
        <ul className="grid grid-cols-3 gap-3 max-[1279px]:grid-cols-2" data-testid="warehouses">
          {whs.map((w) => {
            const Icon = ICONS[w.function] ?? Box;
            const ext = w.site_type === "externa";
            const q = qualification(w.party, today);
            const st = WAREHOUSE_STATUS[w.status];
            const pct = w.total ? (w.occupied / w.total) * 100 : 0;
            return (
              <li
                key={w.id}
                data-code={w.code}
                className={cn(
                  "grid content-start gap-2.5 rounded-[10px] bg-surface p-4",
                  ext ? "border-2 border-dashed border-primary" : "border border-border",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-md bg-surface-sunken">
                      <Icon aria-hidden className="size-5" />
                    </span>
                    <span className="grid">
                      <Link
                        href={`/bodega/estructura/${w.code}`}
                        className="font-mono text-[15px] font-semibold"
                      >
                        {w.code}
                      </Link>
                      <span className="text-sm">{w.name}</span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
                      ext
                        ? "border-2 border-text-strong bg-white"
                        : "border border-border-control bg-surface-sunken",
                    )}
                  >
                    {ext ? (
                      <GitBranch aria-hidden className="size-3.5" />
                    ) : (
                      <House aria-hidden className="size-3.5" />
                    )}
                    {ext ? `Externa · ${w.party?.name}` : "Interna"}
                  </span>
                </div>
                <span className="text-small">
                  <b className="font-semibold">Función:</b> {FUNCTION_LABELS[w.function]} ·{" "}
                  <b className="font-semibold">Admite:</b>{" "}
                  {w.allowed.map((c) => CLASS_LABELS[c]).join(", ")}
                </span>
                <span className="font-mono text-xs" data-testid="structure">
                  {w.structure}
                </span>
                {w.total ? (
                  <div className="grid gap-1">
                    <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs">
                      {w.occupied} de {w.total} ubicaciones ocupadas
                      {w.blocked ? ` · ${w.blocked} bloqueadas` : ""}
                    </span>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {w.status !== "activa" ? (
                    <StatusBadge status={st.status} label={st.label} />
                  ) : null}
                  {ext ? (
                    <StatusBadge status={q.ok ? "vigente" : "vencido"} label={q.label} />
                  ) : null}
                  {w.quarantineRacks.length ? (
                    <StatusBadge
                      status="cuarentena"
                      label={`Zona de cuarentena: estante ${w.quarantineRacks.join(", ")}`}
                    />
                  ) : null}
                  {w.secured ? <StatusBadge status="bloqueada" label="Bajo llave" /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
