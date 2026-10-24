import "server-only";

import type { DbClient } from "@/lib/rpc";

type Wh = {
  id: string;
  code: string;
  name: string;
  site_type: string;
  address: string | null;
  external_parties: {
    name: string;
    qualified: boolean;
    qualification_expires: string | null;
  } | null;
} | null;

// Traslado con origen, destino, líneas, firmas y personas (S-42c y remisión PDF).
export async function loadTransfer(supabase: DbClient, id: string) {
  const { data: t } = await supabase
    .from("stock_transfers")
    .select(
      "*, from:warehouses!stock_transfers_from_warehouse_id_fkey(id, code, name, site_type, address, external_parties(name, qualified, qualification_expires)), to:warehouses!stock_transfers_to_warehouse_id_fkey(id, code, name, site_type, address, external_parties(name, qualified, qualification_expires))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!t) return null;
  const [{ data: lines }, { data: sigs }, { data: people }] = await Promise.all([
    supabase
      .from("stock_transfer_lines")
      .select(
        "id, qty, from_location_id, to_location_id, material_lots(id, internal_code, supplier_lot, unit, status, materials(code, name)), from:storage_locations!stock_transfer_lines_from_location_id_fkey(code), to:storage_locations!stock_transfer_lines_to_location_id_fkey(code)",
      )
      .eq("transfer_id", id),
    supabase
      .from("signatures")
      .select("meaning, signer_name, short_signature, signed_at, user_id")
      .eq("record_table", "stock_transfers")
      .eq("record_id", id),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const name = (uid: string | null) => people?.find((p) => p.id === uid)?.full_name ?? "—";
  return {
    t: { ...t, from: t.from as Wh, to: t.to as Wh },
    lines: (lines ?? []).map((l) => {
      const lot = l.material_lots as {
        id: string;
        internal_code: string;
        supplier_lot: string;
        unit: string;
        status: string;
        materials: { code: string; name: string } | null;
      } | null;
      return {
        id: l.id,
        qty: Number(l.qty),
        lot,
        fromCode: (l.from as { code: string } | null)?.code ?? "",
        toCode: (l.to as { code: string } | null)?.code ?? null,
        toLocationId: l.to_location_id,
      };
    }),
    sig: (m: string) => (sigs ?? []).find((s) => s.meaning === m) ?? null,
    preparedBy: name(t.created_by),
    name,
  };
}

export type TransferView = NonNullable<Awaited<ReturnType<typeof loadTransfer>>>;
