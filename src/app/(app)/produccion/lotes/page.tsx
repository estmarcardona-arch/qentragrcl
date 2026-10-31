import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState, NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { ProcessLine } from "@/components/production/process-line";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/format";
import { getProductionAccess } from "@/lib/production/access";
import {
  BATCH_STATUS,
  ORDER_STATUS,
  STAGE_LABELS,
  type Presentation,
} from "@/lib/production/labels";

export const metadata: Metadata = { title: "Producción · GRUFARCOL eBR" };

const FILTERS = [
  ["", "Todos"],
  ["en_proceso", "En curso"],
  ["creado", "Por iniciar"],
  ["en_revision", "En cuarentena"],
  ["liberado", "Aprobados"],
] as const;

// S-16 · Tablero de órdenes y lotes (RF-31): producto, lote, cantidad, presentaciones, OP, etapa actual y estado, con el
// lote activo destacado y su línea de proceso.
export default async function ProductionBoardPage({
  searchParams,
}: PageProps<"/produccion/lotes">) {
  const a = await getProductionAccess();
  if (!a.read) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso a Producción"
          text="Su rol no tiene permiso en los módulos de producción (PRD 2.2)."
        />
      </main>
    );
  }
  const sp = await searchParams;
  const filter = String(sp.estado ?? "");
  const stageFilter = String(sp.etapa ?? "");
  const { data, error } = await a.supabase
    .from("v_production_board")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <ErrorState title="No se pudo cargar el tablero" text={error.message} />
      </main>
    );
  }
  const all = data ?? [];
  const rows = all.filter(
    (r) =>
      (!filter || r.batch_status === filter) && (!stageFilter || r.current_stage === stageFilter),
  );
  const active = all.find((r) => r.batch_status === "en_proceso");
  const { data: activeStages } = active
    ? await a.supabase
        .from("stage_orders")
        .select("id, stage, status")
        .eq("batch_id", String(active.batch_id))
        .order("order_no")
    : { data: [] };
  const th = "border-b border-border px-3 py-2.5 text-label uppercase";
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Órdenes y lotes"
        description="Lotes de producción con su orden, etapa actual y estado. Ninguna etapa inicia sin despeje y limpieza verificados."
        breadcrumbs={[{ label: "Inicio", href: "/inicio" }, { label: "Producción" }]}
        actions={
          a.createOrder ? (
            <Button asChild size="lg">
              <Link href="/produccion/ordenes/nueva">
                <Plus aria-hidden /> Crear orden de producción
              </Link>
            </Button>
          ) : null
        }
      />
      {active ? (
        <section
          aria-labelledby="activo"
          className="grid gap-3 rounded-[10px] border border-primary bg-surface p-5"
          data-testid="active-batch"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="activo" className="text-card-title">
              Lote activo{" "}
              <Link href={`/produccion/lotes/${active.batch_id}`} className="font-mono">
                {active.batch_code}
              </Link>
            </h2>
            <span className="text-sm text-text-secondary">
              {active.product_name} · {active.order_code} · etapa actual:{" "}
              <b>{STAGE_LABELS[String(active.current_stage)] ?? "—"}</b>
            </span>
          </div>
          <ProcessLine batchId={String(active.batch_id)} stages={activeStages ?? []} />
        </section>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <nav aria-label="Estado" className="flex flex-wrap gap-1.5">
          {FILTERS.map(([f, l]) => (
            <Link
              key={l}
              href={f ? `/produccion/lotes?estado=${f}` : "/produccion/lotes"}
              aria-current={f === filter ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full border px-3 text-[13px] no-underline",
                f === filter
                  ? "border-primary bg-primary font-semibold text-white"
                  : "border-border-control bg-white font-medium text-text-strong",
              )}
            >
              {l}
            </Link>
          ))}
        </nav>
        <form action="/produccion/lotes" className="ml-auto flex items-center gap-2">
          {filter ? <input type="hidden" name="estado" value={filter} /> : null}
          <label className="flex items-center gap-2 text-sm">
            <span className="text-label uppercase">Etapa</span>
            <select
              name="etapa"
              defaultValue={stageFilter}
              className="h-10 rounded-md border border-border-control bg-white px-2.5 text-sm"
            >
              <option value="">Todas</option>
              {["dispensacion", "fabricacion", "envase", "acondicionamiento"].map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No hay lotes con este filtro"
          text={a.createOrder ? "Cree una orden de producción para generar su lote." : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm" data-testid="batches">
            <caption className="sr-only">Lotes de producción</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {[
                  "Lote",
                  "Producto",
                  "Cantidad",
                  "Presentaciones",
                  "Orden",
                  "Etapa actual",
                  "Estado",
                  "Fecha",
                ].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = BATCH_STATUS[String(r.batch_status)] ?? BATCH_STATUS.creado;
                const os = ORDER_STATUS[String(r.order_status)] ?? ORDER_STATUS.borrador;
                return (
                  <tr
                    key={r.batch_id}
                    data-code={r.batch_code}
                    className="border-b border-divider last:border-0"
                  >
                    <td className="px-3 py-3 font-mono text-[13px] font-semibold">
                      <Link href={`/produccion/lotes/${r.batch_id}`}>{r.batch_code}</Link>
                    </td>
                    <td className="px-3 py-3">
                      {r.product_name}
                      <span className="block font-mono text-xs text-text-secondary">
                        {r.product_code}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {formatNumber(Number(r.batch_size), 1)} {r.batch_unit}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {((r.presentations as Presentation[] | null) ?? [])
                        .map((p) => p.name)
                        .join(" · ")}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/produccion/ordenes/${r.order_id}/documentos`}
                        className="font-mono text-xs"
                      >
                        {r.order_code}
                      </Link>
                      <span className="mt-1 block">
                        <StatusBadge status={os.status} label={os.label} />
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {STAGE_LABELS[String(r.current_stage)] ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={st.status} label={st.label} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {r.planned_date ? formatDate(r.planned_date) : "—"}
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
