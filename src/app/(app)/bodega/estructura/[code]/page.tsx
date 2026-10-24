import type { Metadata } from "next";
import { Ban, Info } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { LocationMap, type MapLocation, type MapLot } from "@/components/warehouse/location-map";
import { AddRacks, ExternalApproval } from "@/components/warehouse/warehouse-actions";
import { formatNumber } from "@/lib/format";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import {
  CLASS_LABELS,
  FUNCTION_LABELS,
  TRANSFER_STATUS,
  WAREHOUSE_STATUS,
} from "@/lib/warehouse/labels";
import { loadWarehouses, qualification, todayBogota } from "@/lib/warehouse/structure";

export const metadata: Metadata = { title: "Bodega · GRUFARCOL eBR" };

// S-41c / S-41d · Una bodega: mapa de ubicaciones, existencias; si es externa, su tercero y calificación, lo que
// está en tránsito hacia ella y la aprobación de Aseguramiento de la calidad (D-20).
export default async function WarehousePage({ params }: PageProps<"/bodega/estructura/[code]">) {
  const { code } = await params;
  const a = await getWarehouseAccess();
  if (!a.structRead && !a.structEdit && !a.structApprove) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a la estructura de bodegas" />
      </main>
    );
  }
  const w = (await loadWarehouses(a)).find((x) => x.code === decodeURIComponent(code));
  if (!w) notFound();
  const [{ data: locs }, { data: stock }, { data: transit }] = await Promise.all([
    a.supabase.from("v_location_status").select("*").eq("warehouse_id", w.id).order("code"),
    a.supabase
      .from("stock_by_location")
      .select(
        "location_id, qty, lot_id, material_lots(internal_code, unit, status, materials(name)), storage_locations!inner(warehouse_id)",
      )
      .eq("storage_locations.warehouse_id", w.id)
      .gt("qty", 0),
    a.supabase
      .from("stock_transfers")
      .select(
        "id, code, status, stock_transfer_lines(qty, material_lots(internal_code, supplier_lot, unit, materials(name)))",
      )
      .eq("to_warehouse_id", w.id)
      .eq("status", "despachado"),
  ]);
  const ext = w.site_type === "externa";
  const q = qualification(w.party, todayBogota());
  const st = WAREHOUSE_STATUS[w.status];
  const locations: MapLocation[] = (locs ?? []).map((l) => ({
    id: String(l.id),
    code: String(l.code),
    rackId: String(l.rack_id),
    level: Number(l.level_no),
    position: Number(l.position_no),
    status: l.status as MapLocation["status"],
    blockReason: l.block_reason,
  }));
  const lots: MapLot[] = (stock ?? []).map((s) => {
    const lot = s.material_lots as {
      internal_code: string;
      unit: string;
      status: string;
      materials: { name: string } | null;
    } | null;
    return {
      locationId: s.location_id,
      lotId: s.lot_id,
      code: String(lot?.internal_code),
      material: String(lot?.materials?.name),
      qty: `${formatNumber(Number(s.qty), 2)} ${lot?.unit ?? ""}`,
      status: String(lot?.status),
    };
  });
  const nextRack = Math.max(0, ...w.racks.map((r) => Number(r.code.slice(1)))) + 1;
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={`${w.code} · ${w.name}`}
        description={`${ext ? `Externa · ${w.party?.name}` : "Interna"} · ${FUNCTION_LABELS[w.function]} · ${w.structure} · ${w.occupied} ocupadas`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Bodegas y ubicaciones", href: "/bodega/estructura" },
          { label: w.code },
        ]}
        meta={
          <>
            {w.status !== "activa" ? <StatusBadge status={st.status} label={st.label} /> : null}
            {ext ? (
              <StatusBadge
                status={q.ok ? "vigente" : "vencido"}
                label={q.ok ? "Calificación vigente" : "Calificación vencida"}
              />
            ) : null}
            {w.quarantineRacks.length ? (
              <StatusBadge
                status="cuarentena"
                label={`Cuarentena en ${w.quarantineRacks.join(", ")}`}
              />
            ) : null}
          </>
        }
      />
      <p className="text-small">
        <b className="font-semibold">Admite:</b> {w.allowed.map((c) => CLASS_LABELS[c]).join(", ")}
        {w.secured ? " · Bajo llave" : ""}
      </p>

      {ext ? (
        <section
          aria-label="Tercero"
          className={`grid gap-2 rounded-[10px] border-2 border-dashed bg-surface p-4 ${q.ok ? "border-primary" : "border-q-bad-fg"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="font-semibold">
              Externa · {w.party?.name}
              {q.label ? ` · ${q.label.toLowerCase()}` : ""}
            </b>
            <StatusBadge status={q.ok ? "vigente" : "vencido"} label={q.label} />
          </div>
          {!q.ok ? (
            <div
              role="alert"
              className="grid grid-cols-[24px_1fr] gap-2 rounded-md border border-q-bad-bd bg-q-bad-bg p-3 text-sm text-q-bad-fg"
            >
              <Ban aria-hidden className="size-5" />
              <span>
                <b>No se pueden enviar materiales.</b> {w.party?.name}: {q.label.toLowerCase()}.
                Pida a Aseguramiento de la calidad recalificar al tercero, o use otra bodega
                calificada.
              </span>
            </div>
          ) : null}
          {w.status === "pendiente_aprobacion" ? (
            <p
              role="note"
              className="flex items-start gap-2 rounded-md border border-tram-en-curso-bd bg-tram-en-curso-bg p-3 text-sm text-tram-en-curso-fg"
            >
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              Pendiente de aprobación de Aseguramiento de la calidad. La bodega {w.code} no recibirá
              envíos hasta que se apruebe.
            </p>
          ) : null}
          {a.structApprove && w.status === "pendiente_aprobacion" ? (
            <ExternalApproval
              id={w.id}
              code={w.code}
              party={String(w.party?.name)}
              signer={a.signer}
            />
          ) : null}
        </section>
      ) : null}

      {ext && (transit ?? []).length ? (
        <section aria-labelledby="transito" className="grid gap-2">
          <h2 id="transito" className="text-card-title">
            En tránsito hacia {w.code}
          </h2>
          <ul className="grid gap-2">
            {(transit ?? []).flatMap((t) =>
              (t.stock_transfer_lines ?? []).map((l, i) => {
                const lot = l.material_lots as {
                  internal_code: string;
                  supplier_lot: string;
                  unit: string;
                  materials: { name: string } | null;
                } | null;
                return (
                  <li
                    key={`${t.id}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary bg-tram-en-curso-bg/40 px-4 py-3 text-sm"
                  >
                    <span>
                      <b className="font-mono font-semibold">{lot?.supplier_lot}</b> ·{" "}
                      {lot?.materials?.name} ·{" "}
                      <Link href={`/bodega/traslados/${t.id}`} className="font-mono">
                        {t.code}
                      </Link>{" "}
                      · {formatNumber(Number(l.qty), 0)} {lot?.unit} · ubicación por asignar
                    </span>
                    <StatusBadge
                      status={TRANSFER_STATUS.despachado.status}
                      label={TRANSFER_STATUS.despachado.label}
                    />
                  </li>
                );
              }),
            )}
          </ul>
        </section>
      ) : null}

      {locations.length ? (
        <LocationMap
          warehouseCode={w.code}
          racks={w.racks.map((r) => ({
            id: r.id,
            code: r.code,
            zone: r.zone,
            levels: r.levels_count,
            positions: r.positions_per_level,
          }))}
          locations={locations}
          lots={lots}
          canEdit={a.structEdit}
        />
      ) : (
        <p className="text-sm text-text-secondary">Esta bodega aún no tiene ubicaciones.</p>
      )}
      {a.structEdit && w.status !== "rechazada" ? (
        <AddRacks warehouseId={w.id} code={w.code} prefix={w.location_prefix} nextRack={nextRack} />
      ) : null}
    </main>
  );
}
