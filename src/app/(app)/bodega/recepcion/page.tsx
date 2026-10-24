import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { ReceiptImport, ReceptionForm } from "@/components/warehouse/reception-form";
import { formatDateTime } from "@/lib/format";
import { getWarehouseAccess } from "@/lib/warehouse/access";

export const metadata: Metadata = { title: "Recepción · GRUFARCOL eBR" };

// S-11 · Recepción de materia prima y materiales (RF-20) e importación CSV (D-03).
export default async function ReceptionPage() {
  const a = await getWarehouseAccess();
  if (!a.receive) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="La recepción la registra el auxiliar de bodega"
          text="Su rol no tiene «C» en «Recepción / Inventario» (PRD 2.2)."
        />
      </main>
    );
  }
  const [{ data: materials }, { data: suppliers }, { data: locations }] = await Promise.all([
    a.supabase
      .from("materials")
      .select("id, code, name, unit, requires_coa")
      .eq("active", true)
      .order("name"),
    a.supabase
      .from("external_parties")
      .select("id, name")
      .eq("kind", "proveedor")
      .eq("active", true)
      .order("name"),
    a.supabase
      .from("v_location_status")
      .select("id, code, warehouse_code, status")
      .eq("status", "libre")
      .eq("active", true)
      .order("code"),
  ]);
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Recepción de materia prima"
        description="Complete los datos del lote del proveedor"
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Bodega" },
          { label: "Recepción" },
        ]}
      />
      <ReceptionForm
        materials={(materials ?? []).map((m) => ({
          id: m.id,
          code: m.code,
          name: m.name,
          unit: m.unit,
          requiresCoa: m.requires_coa,
        }))}
        suppliers={(suppliers ?? []).map((s) => ({ id: s.id, label: s.name }))}
        locations={(locations ?? []).map((l) => ({
          id: String(l.id),
          label: `${l.warehouse_code} · ${l.code}`,
        }))}
        receivedBy={a.ctx.fullName}
        now={formatDateTime(new Date())}
      />
      <ReceiptImport />
    </main>
  );
}
