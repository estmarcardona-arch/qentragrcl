"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { ERROR_MESSAGES, toAppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { callRpc } from "@/lib/rpc";

// Acciones de Bodega y de la liberación de insumos (S-11…S-14, S-41, S-42). Las reglas viven en las RPC.

export type WhResult<T = object> =
  | ({ ok: true } & T)
  | {
      ok: false;
      code: string;
      rule: string;
      action: string;
      detail?: string;
      remaining?: number;
    };

function fail(error: unknown): WhResult<never> {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      code: "INVALID_FIELD",
      ...ERROR_MESSAGES.INVALID_FIELD,
      detail: error.issues[0]?.message,
    };
  }
  const e = toAppError(error);
  log.warn("warehouse.action_failed", { code: e.code, detail: e.details });
  return { ok: false, code: e.code, rule: e.rule, action: e.action, detail: e.details };
}

function soft(res: Record<string, unknown>): WhResult<never> {
  const code = String(res.code) as keyof typeof ERROR_MESSAGES;
  return {
    ok: false,
    code,
    ...(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.REAUTH_FAILED),
    remaining: typeof res.remaining === "number" ? res.remaining : undefined,
  };
}

const uuid = z.uuid();
const password = z.string().min(1, "Escriba su contraseña").max(200);
const NULL = null as unknown as string;

function refresh(...paths: string[]) {
  for (const p of [
    "/bodega/inventario",
    "/bodega/estructura",
    "/bodega/traslados",
    "/calidad/insumos",
    ...paths,
  ])
    revalidatePath(p);
}

// ---------------------------------------------------------------------------
// Recepción (RF-20) e importación (D-03)
// ---------------------------------------------------------------------------
export type ReceiptInput = {
  material_id: string;
  supplier_id: string;
  supplier_lot: string;
  expiry_date: string;
  qty: number | null;
  unit: string;
  coa_ref: string;
  observations: string;
};

export async function receiveLot(input: {
  data: ReceiptInput;
  locationId: string;
}): Promise<WhResult<{ id: string; code: string; location: string }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "receive_material_lot", {
      p_data: input.data as never,
      p_location: input.locationId ? uuid.parse(input.locationId) : NULL,
    })) as { id: string; code: string; location: string };
    log.info("warehouse.lot_received", { code: res.code });
    refresh("/bodega/recepcion");
    return { ok: true, ...res };
  } catch (e) {
    return fail(e);
  }
}

export async function suggestLocations(input: {
  materialId: string;
}): Promise<WhResult<{ locations: { id: string; code: string; zone: string }[] }>> {
  try {
    const supabase = await createClient();
    const res = await callRpc(supabase, "suggest_locations", {
      p_material: uuid.parse(input.materialId),
      p_status: "cuarentena",
      p_limit: 8,
    });
    return {
      ok: true,
      locations: (res ?? []).map((r) => ({ id: r.location_id, code: r.code, zone: r.zone })),
    };
  } catch (e) {
    return fail(e);
  }
}

export type ImportRow = Record<string, string>;

export async function importReceipts(input: {
  rows: ImportRow[];
}): Promise<WhResult<{ imported: number }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "import_material_receipts", {
      p_rows: input.rows as never,
    })) as { imported: number };
    refresh("/bodega/recepcion");
    return { ok: true, imported: Number(res.imported) };
  } catch (e) {
    return fail(e);
  }
}

export async function logLabelPrint(input: { lotId: string }): Promise<WhResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "log_label_print", { p_lot: uuid.parse(input.lotId) });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Kardex: traslado interno y ajuste (RF-21, RF-24)
// ---------------------------------------------------------------------------
export async function relocateLot(input: {
  lotId: string;
  fromId: string;
  toId: string;
  qty: number;
  reason: string;
}): Promise<WhResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "relocate_lot", {
      p_lot: uuid.parse(input.lotId),
      p_from: uuid.parse(input.fromId),
      p_to: input.toId ? uuid.parse(input.toId) : NULL,
      p_qty: input.qty,
      p_reason: input.reason,
    });
    refresh(`/bodega/inventario/${input.lotId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function adjustLot(input: {
  lotId: string;
  locationId: string;
  qty: number;
  kind: string;
  reason: string;
}): Promise<WhResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "adjust_lot", {
      p_lot: uuid.parse(input.lotId),
      p_location: uuid.parse(input.locationId),
      p_qty: input.qty,
      p_kind: input.kind,
      p_reason: input.reason,
    });
    refresh(`/bodega/inventario/${input.lotId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Liberación de insumos (RF-22)
// ---------------------------------------------------------------------------
export async function recordResults(input: {
  lotId: string;
  results: { test_id: string; value: string; conforming: boolean }[];
}): Promise<WhResult<{ pending: number }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "record_lot_results", {
      p_lot: uuid.parse(input.lotId),
      p_results: input.results as never,
    })) as { pending: number };
    refresh();
    return { ok: true, pending: Number(res.pending) };
  } catch (e) {
    return fail(e);
  }
}

export async function releaseLot(input: {
  lotId: string;
  decision: "aprobado" | "rechazado";
  reason: string;
  password: string;
}): Promise<WhResult<{ status: string }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "release_material_lot", {
      p_lot: uuid.parse(input.lotId),
      p_decision: input.decision,
      p_reason: input.reason,
      p_password: password.parse(input.password),
    })) as Record<string, unknown>;
    if (res.ok !== true) return soft(res);
    log.info("warehouse.lot_released", { decision: input.decision });
    refresh(`/bodega/inventario/${input.lotId}`);
    return { ok: true, status: String(res.status) };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Estructura de bodegas y terceros (RF-23, D-17, D-20)
// ---------------------------------------------------------------------------
export async function createWarehouse(input: {
  data: {
    code: string;
    name: string;
    function: string;
    site_type: "interna" | "externa";
    external_party_id: string | null;
    location_prefix: string;
    address: string;
    secured: boolean;
  };
  allowed: string[];
  racks: number;
  levels: number;
  positions: number;
}): Promise<WhResult<{ id: string; code: string; status: string; locations: number }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "create_warehouse", {
      p_data: input.data as never,
      p_allowed: input.allowed,
      p_racks: input.racks,
      p_levels: input.levels,
      p_positions: input.positions,
    })) as { id: string; code: string; status: string; locations: number };
    refresh();
    return { ok: true, ...res };
  } catch (e) {
    return fail(e);
  }
}

export async function addLocations(input: {
  warehouseId: string;
  racks: number;
  levels: number;
  positions: number;
  code: string;
}): Promise<WhResult<{ created: number }>> {
  try {
    const supabase = await createClient();
    const n = await callRpc(supabase, "generate_locations", {
      p_warehouse: uuid.parse(input.warehouseId),
      p_racks: input.racks,
      p_levels: input.levels,
      p_positions: input.positions,
    });
    refresh(`/bodega/estructura/${input.code}`);
    return { ok: true, created: Number(n) };
  } catch (e) {
    return fail(e);
  }
}

export async function decideExternalWarehouse(input: {
  id: string;
  approve: boolean;
  reason: string;
  password: string;
  code: string;
}): Promise<WhResult<{ status: string }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "decide_external_warehouse", {
      p_id: uuid.parse(input.id),
      p_approve: input.approve,
      p_reason: input.reason,
      p_password: password.parse(input.password),
    })) as Record<string, unknown>;
    if (res.ok !== true) return soft(res);
    refresh(`/bodega/estructura/${input.code}`);
    return { ok: true, status: String(res.status) };
  } catch (e) {
    return fail(e);
  }
}

export async function setRackZone(input: {
  rackId: string;
  zone: string;
  reason: string;
  code: string;
}): Promise<WhResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "set_rack_zone", {
      p_rack: uuid.parse(input.rackId),
      p_zone: input.zone,
      p_reason: input.reason,
    });
    refresh(`/bodega/estructura/${input.code}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setLocationBlocked(input: {
  locationId: string;
  blocked: boolean;
  reason: string;
  code: string;
}): Promise<WhResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "set_location_blocked", {
      p_location: uuid.parse(input.locationId),
      p_blocked: input.blocked,
      p_reason: input.reason,
    });
    refresh(`/bodega/estructura/${input.code}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveParty(input: {
  id: string | null;
  data: { name: string; kind: string; tax_id: string; contact: string; address: string };
  reason: string;
}): Promise<WhResult<{ id: string }>> {
  try {
    const supabase = await createClient();
    const id = await callRpc(supabase, "save_external_party", {
      p_id: input.id ? uuid.parse(input.id) : NULL,
      p_data: input.data as never,
      p_reason: input.reason,
    });
    refresh("/bodega/estructura/terceros");
    return { ok: true, id: String(id) };
  } catch (e) {
    return fail(e);
  }
}

export async function qualifyParty(input: {
  id: string;
  qualified: boolean;
  expires: string;
  reference: string;
  reason: string;
}): Promise<WhResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "qualify_external_party", {
      p_id: uuid.parse(input.id),
      p_qualified: input.qualified,
      p_expires: input.expires || NULL,
      p_reference: input.reference,
      p_reason: input.reason,
    });
    refresh("/bodega/estructura/terceros");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Traslados (RF-25)
// ---------------------------------------------------------------------------
export type TransferLineInput = {
  lot_id: string;
  qty: number;
  from_location_id: string;
  to_location_id: string | null;
};

export async function saveTransfer(input: {
  id: string | null;
  fromId: string;
  toId: string;
  reason: string;
  lines: TransferLineInput[];
}): Promise<WhResult<{ id: string; code: string }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "save_transfer_draft", {
      p_id: input.id ? uuid.parse(input.id) : NULL,
      p_from: input.fromId ? uuid.parse(input.fromId) : NULL,
      p_to: input.toId ? uuid.parse(input.toId) : NULL,
      p_reason: input.reason,
      p_lines: input.lines as never,
    })) as { id: string; code: string };
    refresh(`/bodega/traslados/${res.id}`);
    return { ok: true, ...res };
  } catch (e) {
    return fail(e);
  }
}

export async function dispatchTransfer(input: {
  id: string;
  password: string;
}): Promise<WhResult<{ status: string }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "dispatch_transfer", {
      p_id: uuid.parse(input.id),
      p_password: password.parse(input.password),
    })) as Record<string, unknown>;
    if (res.ok !== true) return soft(res);
    refresh(`/bodega/traslados/${input.id}`);
    return { ok: true, status: String(res.status) };
  } catch (e) {
    return fail(e);
  }
}

export async function receiveTransfer(input: {
  id: string;
  locations: Record<string, string>;
  reference: string;
  password: string;
}): Promise<WhResult> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "receive_transfer", {
      p_id: uuid.parse(input.id),
      p_locations: input.locations as never,
      p_reference: input.reference,
      p_password: password.parse(input.password),
    })) as Record<string, unknown>;
    if (res.ok !== true) return soft(res);
    refresh(`/bodega/traslados/${input.id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelTransfer(input: { id: string; reason: string }): Promise<WhResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "cancel_transfer", {
      p_id: uuid.parse(input.id),
      p_reason: input.reason,
    });
    refresh(`/bodega/traslados/${input.id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
