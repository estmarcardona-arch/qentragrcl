import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { TransferForm, type StockOpt } from "@/components/warehouse/transfer-form";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import { CLASS_LABELS } from "@/lib/warehouse/labels";
import { loadWarehouses, qualification, todayBogota } from "@/lib/warehouse/structure";

export const metadata: Metadata = { title: "Nuevo traslado · GRUFARCOL eBR" };

// S-42b · Nuevo traslado entre bodegas o envío a una bodega externa (RF-25).
export default async function NewTransferPage() {
  const a = await getWarehouseAccess();
  if (!a.trCreate) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="Los traslados los prepara bodega"
          text="Su rol no tiene «C» en «Traslados y envíos a bodegas externas» (PRD 2.2)."
        />
      </main>
    );
  }
  const [whs, { data: stock }, { data: lots }, { data: dest }] = await Promise.all([
    loadWarehouses(a),
    a.supabase
      .from("stock_by_location")
      .select("lot_id, qty, location_id, storage_locations(code, warehouse_id)")
      .gt("qty", 0),
    a.supabase
      .from("v_lot_stock")
      .select("id, internal_code, supplier_lot, material_name, effective_status, unit"),
    a.supabase
      .from("v_location_status")
      .select("id, code, warehouse_id, status")
      .eq("status", "libre")
      .order("code"),
  ]);
  const today = todayBogota();
  const options: StockOpt[] = (stock ?? []).flatMap((s) => {
    const lot = (lots ?? []).find((l) => l.id === s.lot_id);
    const loc = s.storage_locations as { code: string; warehouse_id: string } | null;
    if (!lot || !loc) return [];
    return [
      {
        key: `${s.lot_id}:${s.location_id}`,
        lotId: s.lot_id,
        lotCode: String(lot.internal_code),
        supplierLot: String(lot.supplier_lot),
        material: String(lot.material_name),
        status: String(lot.effective_status === "agotado" ? "aprobado" : lot.effective_status),
        qty: Number(s.qty),
        unit: String(lot.unit),
        locationId: s.location_id,
        locationCode: loc.code,
        warehouseId: loc.warehouse_id,
      },
    ];
  });
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Nuevo traslado"
        description={`Prepara ${a.ctx.fullName} · firma el despacho y lo aprueba el jefe de bodega`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Traslados", href: "/bodega/traslados" },
          { label: "Nuevo traslado" },
        ]}
      />
      <TransferForm
        warehouses={whs
          .filter((w) => w.status === "activa")
          .map((w) => {
            const q = qualification(w.party, today);
            return {
              id: w.id,
              code: w.code,
              name: w.name,
              external: w.site_type === "externa",
              partyName: w.party?.name ?? null,
              qualified: q.ok,
              qualificationLabel: q.label,
              allowed: w.allowed.map((c) => CLASS_LABELS[c]).join(", "),
            };
          })}
        stock={options}
        destinations={(dest ?? []).map((d) => ({
          id: String(d.id),
          code: String(d.code),
          warehouseId: String(d.warehouse_id),
        }))}
      />
    </main>
  );
}
