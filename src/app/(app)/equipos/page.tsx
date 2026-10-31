import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState, NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";
import { getEquipmentAccess, loadAlertSettings } from "@/lib/equipment/access";
import {
  AREA_LABELS,
  EQUIPMENT_STATUS,
  FITNESS,
  daysUntil,
  dueStatus,
} from "@/lib/equipment/labels";

export const metadata: Metadata = { title: "Equipos · GRUFARCOL eBR" };

// S-25a · Equipos (RF-50): inventario con su estado general y los vencimientos de calibración, mantenimiento,
// calificación y limpieza. La vigencia la calcula la base (equipment_validity) a la hora del servidor.
export default async function EquipmentListPage({ searchParams }: PageProps<"/equipos">) {
  const a = await getEquipmentAccess();
  if (!a.read) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso a Equipos"
          text="Su rol no tiene permiso en «Equipos y hoja de vida» (PRD 2.2)."
        />
      </main>
    );
  }
  const sp = await searchParams;
  const onlyAlerts = sp.filtro === "alertas";
  const q = String(sp.q ?? "")
    .trim()
    .toLowerCase();
  const [{ data, error }, settings] = await Promise.all([
    a.supabase.from("v_equipment_status").select("*").order("code"),
    loadAlertSettings(a),
  ]);
  if (error) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <ErrorState title="No se pudo cargar el inventario de equipos" text={error.message} />
      </main>
    );
  }
  const all = (data ?? []).filter((e) => e.active);
  const count = (f: string) => all.filter((e) => e.fitness === f).length;
  const rows = all.filter(
    (e) =>
      (!onlyAlerts || e.fitness !== "apto") &&
      (!q || `${e.code} ${e.name}`.toLowerCase().includes(q)),
  );
  const th = "border-b border-border px-3 py-2.5 text-label uppercase";
  const kpis = [
    ["Equipos", all.length, "text-foreground"],
    ["Aptos", count("apto"), "text-q-ok-fg"],
    ["Aptos con alerta", count("apto_con_alerta"), "text-q-warn-fg"],
    ["No apto", count("no_apto"), "text-q-bad-fg"],
  ] as const;
  const due = (date: string | null, required: boolean | null) => {
    if (!required) return <span className="text-xs text-text-muted">No aplica</span>;
    const st = dueStatus(daysUntil(date, settings.today), settings.maxAlert);
    return (
      <span className="grid justify-items-start gap-1">
        <StatusBadge status={st.status} label={st.label} />
        <span className="font-mono text-xs">{date ? formatDate(date) : "—"}</span>
      </span>
    );
  };
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Equipos"
        description="Inventario de equipos con su hoja de vida. Producción solo usa equipos aptos: calibración, mantenimiento, calificación y limpieza vigentes."
        breadcrumbs={[{ label: "Inicio", href: "/inicio" }, { label: "Equipos" }]}
        actions={
          a.create ? (
            <Button asChild>
              <Link href="/equipos/nuevo">
                <Plus aria-hidden /> Nuevo equipo
              </Link>
            </Button>
          ) : null
        }
      />
      <section aria-label="Resumen" className="grid grid-cols-4 gap-3 max-[1023px]:grid-cols-2">
        {kpis.map(([label, n, cls]) => (
          <div
            key={label}
            className="grid gap-1 rounded-[10px] border border-border bg-surface p-4"
          >
            <span className="text-label uppercase">{label}</span>
            <span className={cn("text-2xl font-semibold", cls)} data-testid={`kpi-${label}`}>
              {n}
            </span>
          </div>
        ))}
      </section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <nav aria-label="Filtro" className="flex flex-wrap gap-1.5">
          {(
            [
              ["", "Todos"],
              ["alertas", "Con alertas"],
            ] as const
          ).map(([f, l]) => (
            <Link
              key={l}
              href={f ? `/equipos?filtro=${f}` : "/equipos"}
              aria-current={(f === "alertas") === onlyAlerts ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] no-underline",
                (f === "alertas") === onlyAlerts
                  ? "border-primary bg-primary font-semibold text-white"
                  : "border-border-control bg-white font-medium text-text-strong",
              )}
            >
              {l}
            </Link>
          ))}
        </nav>
        <form action="/equipos" role="search" className="flex items-end gap-2">
          {onlyAlerts ? <input type="hidden" name="filtro" value="alertas" /> : null}
          <label className="grid gap-1.5">
            <span className="text-label uppercase">Buscar</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Código o nombre"
              className="h-10 w-64 rounded-md border border-border-control bg-white px-2.5 text-sm"
            />
          </label>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title={onlyAlerts ? "No hay equipos con alertas" : "No hay equipos registrados"}
          text={
            !onlyAlerts && a.create
              ? "Regístrelos con «Nuevo equipo» y cargue su hoja de vida."
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm" data-testid="equipment">
            <caption className="sr-only">Equipos</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {[
                  "Código",
                  "Equipo",
                  "Estado",
                  "Calibración",
                  "Mantenimiento",
                  "Calificación",
                  "Limpieza",
                  "Estado general",
                ].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const fit = FITNESS[String(e.fitness)] ?? FITNESS.no_apto;
                const st =
                  EQUIPMENT_STATUS[String(e.effective_status)] ?? EQUIPMENT_STATUS.disponible;
                const cleanSt = !e.requires_cleaning
                  ? null
                  : !e.cleaning_until
                    ? { status: "sin_dato" as const, label: "Sin verificar" }
                    : Date.parse(e.cleaning_until) < Date.parse(settings.now)
                      ? { status: "vencido" as const, label: "Vencida" }
                      : Date.parse(e.cleaning_until) - Date.parse(settings.now) <=
                          settings.cleaningHours * 3_600_000
                        ? { status: "por_vencer" as const, label: "Por vencer" }
                        : { status: "vigente" as const, label: "Vigente" };
                return (
                  <tr
                    key={e.id}
                    data-code={e.code}
                    className="border-b border-divider align-top last:border-0"
                  >
                    <td className="px-3 py-2.5 font-mono text-[13px] font-semibold">
                      <Link href={`/equipos/${e.code}`}>{e.code}</Link>
                    </td>
                    <td className="px-3 py-2.5">
                      {e.name}
                      <span className="block text-xs text-text-secondary">
                        {AREA_LABELS[String(e.plant_area)]}
                        {e.critical ? " · crítico" : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={st.status} label={st.label} />
                    </td>
                    <td className="px-3 py-2.5">
                      {due(e.calibration_due, e.requires_calibration)}
                    </td>
                    <td className="px-3 py-2.5">{due(e.maintenance_due, true)}</td>
                    <td className="px-3 py-2.5">
                      {due(e.qualification_due, e.requires_qualification)}
                    </td>
                    <td className="px-3 py-2.5">
                      {cleanSt ? (
                        <span className="grid justify-items-start gap-1">
                          <StatusBadge status={cleanSt.status} label={cleanSt.label} />
                          <span className="font-mono text-xs">
                            {e.cleaning_until ? formatDateTime(e.cleaning_until) : "—"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">No aplica</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={fit.status} label={fit.label} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
