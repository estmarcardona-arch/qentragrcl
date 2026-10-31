import type { Metadata } from "next";
import { Info, Lock, Play, Plus, Search } from "lucide-react";
import Link from "next/link";
import { EmptyState, ErrorState, NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Card, CodeChip, ProcessTrack } from "@/components/production/ui";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/format";
import { getProductionAccess } from "@/lib/production/access";
import { loadBatch } from "@/lib/production/batch";
import { BATCH_STATUS, STAGE_LABELS, type Presentation } from "@/lib/production/labels";
import { buildTrack } from "@/lib/production/track";

export const metadata: Metadata = { title: "Órdenes y lotes · GRUFARCOL eBR" };

const STATES = [
  ["", "Todos"],
  ["en_proceso", "En curso"],
  ["creado", "Sin iniciar"],
  ["en_revision", "En cuarentena"],
  ["liberado", "Aprobada"],
] as const;

const selectCls = "h-11 rounded-md border border-border-control bg-white px-3 text-sm";

// S-16 · Tablero de órdenes y lotes (RF-31, diseño «Producción S-15 a S-17»): lote activo con su línea de proceso y
// las acciones siguientes; tabla con búsqueda, filtros por etapa y estado, responsable y fecha.
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
  const q = String(sp.q ?? "")
    .trim()
    .toLowerCase();
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
  const ids = all.map((r) => String(r.batch_id));
  const [{ data: stages }, { data: people }, { data: steps }] = await Promise.all([
    ids.length
      ? a.supabase
          .from("stage_orders")
          .select("id, batch_id, stage, status, started_by, order_no")
          .in("batch_id", ids)
      : Promise.resolve({ data: [] }),
    a.supabase.from("profiles").select("id, full_name"),
    ids.length
      ? a.supabase.from("step_records").select("stage_order_id")
      : Promise.resolve({ data: [] }),
  ]);
  const nameOf = (id: string | null | undefined) =>
    (people ?? []).find((p) => p.id === id)?.full_name ?? "—";
  const activeRow = all.find((r) => r.batch_status === "en_proceso");
  const active = activeRow ? await loadBatch(a, String(activeRow.batch_id)) : null;
  const track = active ? buildTrack(active) : null;
  const stepTotals = active ? track!.progress : {};
  const stageText = (r: (typeof all)[number]) => {
    if (r.order_status === "borrador") return "Orden en borrador";
    if (r.batch_status === "creado" && !r.current_stage) return "Creado · sin iniciar";
    if (r.batch_status === "en_revision") return "Revisión final · listo para liberar";
    if (r.batch_status === "liberado") return "Liberado";
    const so = (stages ?? []).find((s) => s.batch_id === r.batch_id && s.stage === r.current_stage);
    if (!so) return "—";
    if (so.status === "pendiente") return `${STAGE_LABELS[so.stage]} · por iniciar`;
    const p = stepTotals[so.id];
    const done = (steps ?? []).filter((x) => x.stage_order_id === so.id).length;
    return p?.total
      ? `${STAGE_LABELS[so.stage]} · paso ${Math.min(done + 1, p.total)} de ${p.total}`
      : `${STAGE_LABELS[so.stage]} · en curso`;
  };
  const responsible = (r: (typeof all)[number]) => {
    const so = (stages ?? []).find((s) => s.batch_id === r.batch_id && s.stage === r.current_stage);
    return nameOf(so?.started_by ?? r.created_by);
  };
  const rows = all.filter(
    (r) =>
      (!filter ||
        r.batch_status === filter ||
        (filter === "creado" && r.order_status === "borrador")) &&
      (!stageFilter || r.current_stage === stageFilter) &&
      (!q || `${r.batch_code} ${r.product_name} ${r.order_code}`.toLowerCase().includes(q)),
  );
  const count = (s: string) => all.filter((r) => r.batch_status === s).length;
  const th = "px-4 py-3 text-label uppercase";
  const cur = track?.current;
  const presText = (p: Presentation[] | null) => (p ?? []).map((x) => x.name).join(" · ");
  return (
    <main className="grid content-start gap-5 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Producción › Órdenes y lotes</p>
          <h1 className="text-[32px] leading-10 font-semibold">Órdenes y lotes</h1>
          <p className="text-sm text-text-secondary">
            {all.length} lotes · {count("en_proceso")} en curso · {count("creado")} sin iniciar
          </p>
        </div>
        {a.createOrder ? (
          <Button asChild size="lg" className="min-h-12 px-5 text-[15px]">
            <Link href="/produccion/ordenes/nueva">
              <Plus aria-hidden /> Crear orden de producción
            </Link>
          </Button>
        ) : null}
      </header>

      {active && track ? (
        <Card tone="primary" testId="active-batch">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-label font-semibold text-primary uppercase">Lote activo</span>
            <CodeChip size="lg">
              <Link href={`/produccion/lotes/${active.batch.id}`} className="no-underline">
                {active.batch.batch_code}
              </Link>
            </CodeChip>
            <b className="text-[18px] font-semibold">{active.product.name}</b>
            <span className="text-sm text-text-secondary">
              {active.order.code} · {formatNumber(Number(active.batch.batch_size), 1)}{" "}
              {active.batch.batch_unit} ·{" "}
              {active.order.presentations.map((p) => p.name).join(" y ")}
            </span>
            <StatusBadge status="en_curso" label="En curso" />
            <span className="ml-auto text-sm text-text-secondary">
              Responsable: {cur ? nameOf(cur.started_by ?? active.order.created_by) : "—"}
            </span>
          </div>
          <ProcessTrack nodes={track.nodes} />
          <div className="flex flex-wrap items-center gap-3 border-t border-divider pt-4">
            {cur?.status === "en_curso" ? (
              <Button asChild size="lg" className="min-h-12 px-5">
                <Link href={`/produccion/lotes/${active.batch.id}/${cur.stage}`}>
                  <Play aria-hidden /> Continuar {STAGE_LABELS[cur.stage].toLowerCase()}
                  {track.progress[cur.id]?.total
                    ? ` · paso ${Math.min(track.progress[cur.id].done + 1, track.progress[cur.id].total)}`
                    : ""}
                </Link>
              </Button>
            ) : null}
            {track.next ? (
              <>
                {!track.next.clearanceOk ? (
                  <Button asChild size="lg" variant="secondary" className="min-h-12 px-5">
                    <Link
                      href={`/produccion/lotes/${active.batch.id}/despeje?etapa=${track.next.stage.stage}`}
                    >
                      Hacer despeje de {STAGE_LABELS[track.next.stage.stage]}
                    </Link>
                  </Button>
                ) : !track.next.cleaningOk ? (
                  <Button asChild size="lg" variant="secondary" className="min-h-12 px-5">
                    <Link
                      href={`/produccion/lotes/${active.batch.id}/limpieza?etapa=${track.next.stage.stage}`}
                    >
                      Limpieza de {STAGE_LABELS[track.next.stage.stage]}
                    </Link>
                  </Button>
                ) : null}
                {track.next.clearanceOk &&
                track.next.cleaningOk &&
                cur?.id === track.next.stage.id ? (
                  <Button asChild size="lg" className="min-h-12 px-5">
                    <Link href={`/produccion/lotes/${active.batch.id}/${track.next.stage.stage}`}>
                      <Play aria-hidden /> Iniciar{" "}
                      {STAGE_LABELS[track.next.stage.stage].toLowerCase()}
                    </Link>
                  </Button>
                ) : (
                  <Button size="lg" disabled className="min-h-12 px-5" aria-describedby="next-why">
                    <Lock aria-hidden /> Iniciar{" "}
                    {STAGE_LABELS[track.next.stage.stage].toLowerCase()}
                  </Button>
                )}
              </>
            ) : null}
            {track.next &&
            !(
              track.next.clearanceOk &&
              track.next.cleaningOk &&
              cur?.id === track.next.stage.id
            ) ? (
              <p id="next-why" className="w-full text-sm text-text-secondary">
                «Iniciar {STAGE_LABELS[track.next.stage.stage].toLowerCase()}» no está disponible:{" "}
                {!track.next.clearanceOk
                  ? `el despeje de línea de ${STAGE_LABELS[track.next.stage.stage]} no está verificado.`
                  : !track.next.cleaningOk
                    ? "la limpieza de equipos y utensilios no está verificada."
                    : "primero se completa la etapa en curso."}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      <section className="overflow-hidden rounded-[10px] border border-border bg-surface">
        <form
          action="/produccion/lotes"
          role="search"
          className="flex flex-wrap items-center gap-3 p-4"
        >
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Buscar lote, producto u orden</span>
            <Search
              aria-hidden
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
            />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar lote, producto u orden"
              className={`${selectCls} w-full pl-9`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Etapa</span>
            <select
              name="etapa"
              defaultValue={stageFilter}
              className={selectCls}
              aria-label="Etapa"
            >
              <option value="">Etapa: Todas</option>
              {["dispensacion", "fabricacion", "envase", "acondicionamiento"].map((s) => (
                <option key={s} value={s}>
                  Etapa: {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <select name="estado" defaultValue={filter} className={selectCls} aria-label="Estado">
            {STATES.map(([v, l]) => (
              <option key={v} value={v}>
                Estado: {l}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" size="lg">
            Filtrar
          </Button>
          {filter || stageFilter || q ? (
            <Link href="/produccion/lotes" className="text-sm font-semibold">
              Limpiar filtros
            </Link>
          ) : null}
        </form>
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No hay lotes con este filtro"
              text={
                a.createOrder ? "Cree una orden de producción para generar su lote." : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="batches">
              <caption className="sr-only">Lotes de producción</caption>
              <thead className="bg-surface-sunken">
                <tr>
                  {[
                    "Lote",
                    "Producto",
                    "Cantidad",
                    "OP",
                    "Etapa actual",
                    "Estado",
                    "Responsable",
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
                  const st =
                    r.order_status === "borrador" ||
                    (r.batch_status === "creado" && !r.current_stage)
                      ? { status: "pendiente" as const, label: "Sin iniciar" }
                      : (BATCH_STATUS[String(r.batch_status)] ?? BATCH_STATUS.creado);
                  return (
                    <tr
                      key={r.batch_id}
                      data-code={r.batch_code}
                      className={`border-t border-divider ${r.batch_status === "en_proceso" ? "bg-primary-soft/40" : ""}`}
                    >
                      <td className="px-4 py-3 font-mono text-[13px] font-semibold">
                        <Link href={`/produccion/lotes/${r.batch_id}`}>{r.batch_code}</Link>
                      </td>
                      <td className="px-4 py-3">{r.product_name}</td>
                      <td className="px-4 py-3">
                        <b className="font-semibold">
                          {formatNumber(Number(r.batch_size), 1)} {r.batch_unit}
                        </b>
                        <span className="block text-xs text-text-secondary">
                          {presText(r.presentations as Presentation[] | null)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/produccion/ordenes/${r.order_id}/documentos`}
                          className="font-mono text-xs"
                        >
                          {r.order_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{stageText(r)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={st.status} label={st.label} />
                      </td>
                      <td className="px-4 py-3">{responsible(r)}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {r.planned_date ? formatDate(r.planned_date) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex flex-wrap justify-between gap-2 border-t border-divider px-4 py-3 text-sm text-text-secondary">
          <span>
            1–{rows.length} de {rows.length} lotes
          </span>
          <span className="flex items-center gap-1.5">
            <Info aria-hidden className="size-4" /> Azul y gris: avance del trámite. Verde y ámbar:
            solo el estado de calidad del lote.
          </span>
        </footer>
      </section>
    </main>
  );
}
