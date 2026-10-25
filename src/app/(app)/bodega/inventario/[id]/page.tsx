import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { SignatureStamp } from "@/components/gxp/signature-stamp";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { AdjustForm, RelocateForm, type LocationOption } from "@/components/warehouse/lot-actions";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import { expiryBadge, LOT_STATUS, MOVEMENT_LABELS } from "@/lib/warehouse/labels";

export const metadata: Metadata = { title: "Kardex · GRUFARCOL eBR" };

type Loc = { code: string; warehouses: { code: string } | null } | null;

// S-12b · Kardex de un lote (RF-21): movimientos inmutables, saldo calculado (entradas − salidas ± ajustes),
// existencias por ubicación, resultados de análisis, historia de estado, traslado interno y ajuste con motivo.
export default async function LotPage({ params }: PageProps<"/bodega/inventario/[id]">) {
  const { id } = await params;
  const a = await getWarehouseAccess();
  if (!a.invRead && !a.releaseRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso al inventario" />
      </main>
    );
  }
  const { data: lot } = await a.supabase.from("v_lot_stock").select("*").eq("id", id).maybeSingle();
  if (!lot) notFound();
  const [
    { data: moves },
    { data: stock },
    { data: tests },
    { data: history },
    { data: sigs },
    { data: people },
    { data: targets },
  ] = await Promise.all([
    a.supabase
      .from("inventory_movements")
      .select(
        "id, type, qty, ref_code, reason, created_at, created_by, from:storage_locations!inventory_movements_from_location_id_fkey(code, warehouses(code)), to:storage_locations!inventory_movements_to_location_id_fkey(code, warehouses(code))",
      )
      .eq("lot_id", id)
      .order("created_at"),
    a.supabase
      .from("stock_by_location")
      .select("location_id, qty, storage_locations(code, warehouses(code, site_type))")
      .eq("lot_id", id)
      .gt("qty", 0),
    a.supabase.from("lot_tests").select("*").eq("lot_id", id).order("order_no"),
    a.supabase.from("lot_status_history").select("*").eq("lot_id", id).order("created_at"),
    a.supabase
      .from("signatures")
      .select("meaning, signer_name, short_signature, signed_at")
      .eq("record_table", "material_lots")
      .eq("record_id", id),
    a.supabase.from("profiles").select("id, full_name"),
    a.relocate
      ? a.supabase
          .from("v_location_status")
          .select("id, code, warehouse_code, zone, status, active, blocked")
          .eq("active", true)
          .eq("blocked", false)
          .order("code")
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const name = (uid: string | null) => people?.find((p) => p.id === uid)?.full_name ?? "—";
  const unit = String(lot.unit);
  // Entrada = llega a una ubicación sin salir de otra; salida = sale sin llegar (dispensación, envío en tránsito).
  const steps = (moves ?? []).map((m) => {
    const from = m.from as Loc;
    const to = m.to as Loc;
    const qty = Number(m.qty);
    return {
      ...m,
      from,
      to,
      inn: to && !from ? qty : 0,
      out: from && !to ? qty : 0,
      where: from && to ? `${from.code} → ${to.code}` : (to?.code ?? from?.code ?? ""),
    };
  });
  const rows = steps.reduce<((typeof steps)[number] & { balance: number })[]>(
    (acc, r) => [...acc, { ...r, balance: (acc.at(-1)?.balance ?? 0) + r.inn - r.out }],
    [],
  );
  const totalIn = rows.reduce((s, r) => s + r.inn, 0);
  const totalOut = rows.reduce((s, r) => s + r.out, 0);
  const atLocations = (stock ?? []).map((s) => {
    const l = s.storage_locations as {
      code: string;
      warehouses: { code: string; site_type: string } | null;
    } | null;
    return {
      locationId: s.location_id,
      code: String(l?.code),
      warehouse: String(l?.warehouses?.code),
      external: l?.warehouses?.site_type === "externa",
      qty: Number(s.qty),
    };
  });
  const internalStock = atLocations.filter((s) => !s.external);
  const quality = LOT_STATUS[String(lot.status)] ?? LOT_STATUS.cuarentena;
  const th = "border-b border-border px-3 py-2.5 text-label uppercase";
  const fmt = (n: number) => (n ? formatNumber(n, 2) : "—");

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={`Kardex · ${lot.internal_code}`}
        description={`${lot.material_name} ${lot.material_code} · lote proveedor ${lot.supplier_lot}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Inventario", href: "/bodega/inventario" },
          { label: String(lot.internal_code) },
        ]}
        meta={
          <>
            <StatusBadge status={quality.status} label={quality.label} />
            {lot.effective_status === "vencido" ? (
              <StatusBadge status="vencido" label="Vencido" />
            ) : null}
          </>
        }
        actions={
          <Button asChild variant="secondary">
            <Link href={`/bodega/rotulos/${id}`}>Rótulo</Link>
          </Button>
        }
      />

      <section
        aria-label="Datos del lote"
        className="grid grid-cols-5 gap-3 rounded-[10px] border border-border bg-surface p-5 max-[1279px]:grid-cols-2"
      >
        {[
          ["Material", `${lot.material_name} · ${lot.material_code}`],
          ["Proveedor", lot.supplier_name ?? "—"],
          ["Vence", formatDate(String(lot.expiry_date))],
          [
            "Recibido",
            `${formatNumber(Number(lot.qty_received), 2)} ${unit} · ${formatDateTime(String(lot.received_at))}`,
          ],
          ["Saldo calculado", `${formatNumber(Number(lot.qty_on_hand), 2)} ${unit}`],
        ].map(([k, v]) => (
          <div key={k} className="grid gap-0.5">
            <span className="text-label text-text-secondary uppercase">{k}</span>
            <span
              className={k === "Saldo calculado" ? "font-mono text-base font-semibold" : "text-sm"}
              data-testid={k === "Saldo calculado" ? "balance" : undefined}
            >
              {v}
            </span>
          </div>
        ))}
        <div className="col-span-5 flex flex-wrap items-center gap-2 max-[1279px]:col-span-2">
          <span className="text-label text-text-secondary uppercase">Vigencia</span>
          <StatusBadge {...expiryBadge(Number(lot.days_to_expiry))} />
          <span className="text-label text-text-secondary uppercase">Ubicación</span>
          {atLocations.length ? (
            atLocations.map((s) => (
              <span key={s.locationId} className="font-mono text-xs font-semibold">
                {s.warehouse} · {s.code} ({formatNumber(s.qty, 2)} {unit})
              </span>
            ))
          ) : (
            <span className="text-sm text-text-secondary">Sin existencias en bodega</span>
          )}
          {Number(lot.qty_in_transit) > 0 ? (
            <StatusBadge
              status="en_curso"
              label={`${formatNumber(Number(lot.qty_in_transit), 2)} ${unit} en tránsito`}
            />
          ) : null}
        </div>
      </section>

      <section aria-labelledby="movimientos" className="grid gap-2">
        <h2 id="movimientos" className="text-card-title">
          Movimientos
        </h2>
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm" data-testid="kardex">
            <caption className="sr-only">Kardex del lote</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {[
                  "Fecha y hora",
                  "Movimiento",
                  "Documento",
                  "Ubicación",
                  "Entrada",
                  "Salida",
                  "Saldo",
                  "Responsable",
                ].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-divider align-top last:border-0">
                  <td className="px-3 py-2.5 font-mono text-xs">{formatDateTime(r.created_at)}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold">{MOVEMENT_LABELS[r.type] ?? r.type}</span>
                    {r.reason ? (
                      <span className="block text-xs text-text-secondary">{r.reason}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{r.ref_code ?? "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{r.where}</td>
                  <td className="px-3 py-2.5 font-mono">{fmt(r.inn)}</td>
                  <td className="px-3 py-2.5 font-mono">{fmt(r.out)}</td>
                  <td className="px-3 py-2.5 font-mono font-semibold">
                    {formatNumber(r.balance, 2)}
                  </td>
                  <td className="px-3 py-2.5">{name(r.created_by)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p
            className="border-t border-divider px-3 py-2 text-xs text-text-secondary"
            data-testid="kardex-calc"
          >
            Saldo = entradas − salidas ± ajustes: {formatNumber(totalIn, 2)} −{" "}
            {formatNumber(totalOut, 2)} = {formatNumber(totalIn - totalOut, 2)} {unit}
            {Number(lot.qty_in_transit) > 0
              ? " (lo despachado en un traslado queda en tránsito hasta su recepción)"
              : ""}
            . El kardex es de solo lectura: los errores se corrigen con un ajuste con motivo.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 max-[1279px]:grid-cols-1">
        <section
          aria-labelledby="resultados"
          className="grid content-start gap-2 rounded-[10px] border border-border bg-surface p-5"
        >
          <h2 id="resultados" className="text-card-title">
            Resultados y liberación
          </h2>
          <ul className="grid gap-1.5">
            {(tests ?? []).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <b className="font-semibold">{t.name}</b>
                  {t.result_value ? ` · ${t.result_value}` : ""}
                </span>
                <StatusBadge
                  status={
                    t.conforming == null ? "sin_dato" : t.conforming ? "aprobado" : "rechazado"
                  }
                  label={
                    t.conforming == null ? "Pendiente" : t.conforming ? "Conforme" : "No conforme"
                  }
                />
              </li>
            ))}
          </ul>
          {(sigs ?? []).length ? (
            <SignatureStamp
              signatures={(sigs ?? []).map((s) => ({
                meaning: s.meaning,
                signerName: s.signer_name,
                shortSignature: s.short_signature,
                signedAt: s.signed_at,
              }))}
            />
          ) : null}
          {lot.status === "cuarentena" && a.releaseRead ? (
            <Link href={`/calidad/insumos?lote=${id}`} className="text-small">
              Ir a la liberación de insumos
            </Link>
          ) : null}
        </section>
        <section
          aria-labelledby="historia"
          className="grid content-start gap-2 rounded-[10px] border border-border bg-surface p-5"
        >
          <h2 id="historia" className="text-card-title">
            Historia de estado
          </h2>
          <ol className="grid gap-1.5 text-sm">
            {(history ?? []).map((h) => (
              <li key={h.id}>
                <span className="font-mono text-xs">{formatDateTime(h.created_at)}</span> ·{" "}
                {h.from_status ? `${LOT_STATUS[h.from_status]?.label ?? h.from_status} → ` : ""}
                <b className="font-semibold">{LOT_STATUS[h.to_status]?.label ?? h.to_status}</b>
                {h.reason ? ` · ${h.reason}` : ""} · {name(h.created_by)}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {internalStock.length && (a.relocate || a.adjust) ? (
        <div className="grid grid-cols-2 gap-4 max-[1279px]:grid-cols-1">
          {a.relocate ? (
            <RelocateForm
              lotId={id}
              unit={unit}
              stock={internalStock}
              targets={(targets ?? [])
                .filter((t) => !internalStock.some((s) => s.locationId === t.id))
                .map((t): LocationOption => ({
                  id: String(t.id),
                  code: String(t.code),
                  warehouse: String(t.warehouse_code),
                  zone: String(t.zone),
                }))}
            />
          ) : null}
          {a.adjust ? <AdjustForm lotId={id} unit={unit} stock={internalStock} /> : null}
        </div>
      ) : null}
    </main>
  );
}
