import type { Metadata } from "next";
import { Clock, CircleX, Search } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/format";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import { expiryBadge, LOT_STATUS } from "@/lib/warehouse/labels";

export const metadata: Metadata = { title: "Inventario · GRUFARCOL eBR" };

const STATES = ["todos", "aprobado", "cuarentena", "rechazado", "vencido", "agotado"] as const;

// S-12 · Inventario por lote (RF-21, RF-24): kardex FEFO, estado de calidad y vigencia con ícono y texto,
// alertas de vencimiento a 30/60/90 días, ubicación de cada lote y localizador «¿Dónde está este lote?».
export default async function InventoryPage({ searchParams }: PageProps<"/bodega/inventario">) {
  const a = await getWarehouseAccess();
  if (!a.invRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso al inventario"
          text="Su rol no tiene permiso en «Recepción / Inventario» (PRD 2.2)."
        />
      </main>
    );
  }
  const sp = await searchParams;
  const estado = (STATES.find((s) => s === sp.estado) ?? "todos") as (typeof STATES)[number];
  const fefo = sp.orden !== "codigo";
  const q = String(sp.q ?? "")
    .trim()
    .toLowerCase();

  const [{ data: lots }, { data: stock }] = await Promise.all([
    a.supabase.from("v_lot_stock").select("*"),
    a.supabase
      .from("stock_by_location")
      .select("lot_id, qty, storage_locations(code, warehouses(code))")
      .gt("qty", 0),
  ]);
  const all = (lots ?? []).filter((l) => l.id);
  const where = new Map<string, string[]>();
  for (const s of stock ?? []) {
    const loc = s.storage_locations as { code: string; warehouses: { code: string } | null } | null;
    if (!loc) continue;
    where.set(s.lot_id, [...(where.get(s.lot_id) ?? []), `${loc.warehouses?.code} · ${loc.code}`]);
  }
  const live = all.filter(
    (l) =>
      Number(l.qty_on_hand) > 0 && l.effective_status !== "vencido" && l.status !== "rechazado",
  );
  const rank = all
    .filter(
      (l) =>
        l.effective_status === "aprobado" && Number(l.qty_on_hand) > 0 && l.expiry_date != null,
    )
    .sort((x, y) => String(x.expiry_date).localeCompare(String(y.expiry_date)))
    .map((l) => l.id);
  const inWindow = (lo: number, hi: number) =>
    live.filter((l) => Number(l.days_to_expiry) >= lo && Number(l.days_to_expiry) <= hi);
  const first = (xs: typeof all) =>
    xs[0]
      ? `${xs[0].material_name} ${xs[0].internal_code} · ${formatDate(String(xs[0].expiry_date))}`
      : "—";
  const expired = all.filter((l) => l.effective_status === "vencido" && Number(l.qty_on_hand) > 0);
  const alerts = [
    { n: inWindow(0, 30), label: "Vencen en ≤ 30 días", bad: false },
    { n: inWindow(31, 60), label: "Vencen en 31–60 días", bad: false },
    { n: inWindow(61, 90), label: "Vencen en 61–90 días", bad: false },
    { n: expired, label: "Vencidos con saldo", bad: true },
  ];

  const rows = all
    .filter((l) => estado === "todos" || l.effective_status === estado)
    .filter(
      (l) =>
        !q ||
        [l.material_name, l.material_code, l.internal_code, l.supplier_lot]
          .join(" ")
          .toLowerCase()
          .includes(q) ||
        (where.get(String(l.id)) ?? []).join(" ").toLowerCase().includes(q),
    )
    .sort((x, y) =>
      fefo
        ? String(x.expiry_date).localeCompare(String(y.expiry_date))
        : String(x.internal_code).localeCompare(String(y.internal_code)),
    );
  const link = (o: Record<string, string>) => {
    const p = new URLSearchParams({
      ...(estado !== "todos" ? { estado } : {}),
      ...(fefo ? {} : { orden: "codigo" }),
      ...(q ? { q } : {}),
      ...o,
    });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/bodega/inventario${p.size ? `?${p}` : ""}`;
  };
  const th = "border-b border-border px-3 py-2.5 text-label uppercase";

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Inventario por lote"
        description={`Kardex FEFO · ${all.length} lotes de insumo`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Bodega" },
          { label: "Inventario" },
        ]}
        actions={
          a.receive ? (
            <Button asChild>
              <Link href="/bodega/recepcion">Recibir material</Link>
            </Button>
          ) : null
        }
      />

      <section
        aria-label="Alertas de vencimiento"
        className="grid grid-cols-4 gap-3 max-[1279px]:grid-cols-2"
      >
        {alerts.map((x) => (
          <div
            key={x.label}
            data-testid="expiry-alert"
            className={cn(
              "grid gap-1 rounded-[10px] border px-4 py-3",
              x.bad
                ? "border-q-bad-bd bg-q-bad-bg text-q-bad-fg"
                : "border-q-warn-bd bg-q-warn-bg text-q-warn-fg",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              {x.bad ? (
                <CircleX aria-hidden className="size-4" />
              ) : (
                <Clock aria-hidden className="size-4" />
              )}
              <span className="text-2xl leading-none">{x.n.length}</span> {x.label}
            </span>
            <span className="truncate text-xs">{first(x.n)}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form action="/bodega/inventario" className="flex items-end gap-2" role="search">
          {estado !== "todos" ? <input type="hidden" name="estado" value={estado} /> : null}
          {!fefo ? <input type="hidden" name="orden" value="codigo" /> : null}
          <label className="grid gap-1.5">
            <span className="text-label uppercase">¿Dónde está este lote?</span>
            <span className="relative">
              <Search aria-hidden className="absolute top-3 left-2.5 size-4 text-text-muted" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Material, código interno, lote del proveedor o ubicación"
                className="h-10 w-[380px] rounded-md border border-border-control bg-white pr-2.5 pl-8 text-sm max-[1279px]:w-[260px]"
              />
            </span>
          </label>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Estado de calidad" className="flex flex-wrap gap-1.5">
            {STATES.map((s) => (
              <Link
                key={s}
                href={link({ estado: s === "todos" ? "" : s })}
                aria-current={s === estado ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[13px] no-underline",
                  s === estado
                    ? "border-primary bg-primary font-semibold text-white"
                    : "border-border-control bg-white font-medium text-text-strong",
                )}
              >
                {s === "todos" ? "Todos" : LOT_STATUS[s].label}
              </Link>
            ))}
          </nav>
          <Link
            href={link({ orden: fefo ? "codigo" : "" })}
            className="rounded-md border border-primary px-3 py-1.5 text-[13px] font-semibold no-underline"
          >
            {fefo ? "Orden FEFO (primero que vence)" : "Orden por código"}
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={q ? "No se encontró el lote" : "No hay lotes con este estado"}
          text={q ? "Revise el código o busque por material o ubicación." : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm" data-testid="inventory">
            <caption className="sr-only">
              Lotes de insumo con saldo, estado de calidad, vigencia y ubicación
            </caption>
            <thead className="bg-surface-sunken">
              <tr>
                {[
                  "FEFO",
                  "Material",
                  "Código interno",
                  "Lote proveedor",
                  "Vence",
                  "Recibido",
                  "Saldo",
                  "Calidad",
                  "Vigencia",
                ].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const st = LOT_STATUS[String(l.effective_status)] ?? LOT_STATUS.cuarentena;
                const quality = LOT_STATUS[String(l.status)] ?? st;
                const r = rank.indexOf(String(l.id));
                const bad = l.effective_status === "vencido" || l.status === "rechazado";
                const locs = where.get(String(l.id)) ?? [];
                return (
                  <tr
                    key={l.id}
                    data-code={l.internal_code}
                    className={cn(
                      "border-b border-divider last:border-0",
                      bad ? "bg-q-bad-bg/40" : l.status === "cuarentena" ? "bg-q-warn-bg/40" : "",
                    )}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold">
                      {r >= 0 ? r + 1 : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold">{l.material_name}</span>
                      <span className="block text-xs text-text-secondary">
                        {locs.length
                          ? `Ubicación ${locs.join(", ")}`
                          : Number(l.qty_in_transit) > 0
                            ? "En tránsito hacia otra bodega"
                            : "Sin existencias"}
                        {l.status_reason ? ` · ${l.status_reason}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[13px] font-semibold">
                      <Link href={`/bodega/inventario/${l.id}`}>{l.internal_code}</Link>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{l.supplier_lot}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {formatDate(String(l.expiry_date))}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {formatNumber(Number(l.qty_received), 2)} {l.unit}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[13px] font-semibold">
                      {formatNumber(Number(l.qty_on_hand), 2)} {l.unit}
                      {Number(l.qty_in_transit) > 0 ? (
                        <span className="block text-xs font-normal">
                          + {formatNumber(Number(l.qty_in_transit), 2)} en tránsito
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={quality.status} label={quality.label} />
                    </td>
                    <td className="px-3 py-2.5">
                      {l.effective_status === "agotado" ? (
                        <StatusBadge status="sin_dato" label="Agotado" />
                      ) : (
                        <StatusBadge {...expiryBadge(Number(l.days_to_expiry))} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-divider px-3 py-2 text-xs text-text-secondary">
            {rows.length} de {all.length} lotes · FEFO: el primero que vence es el primero que sale.
            Vencidos y rechazados no entran en la cola.
          </p>
        </div>
      )}
    </main>
  );
}
