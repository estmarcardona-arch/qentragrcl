"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { ERROR_MESSAGES, toAppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { callRpc, type RpcArgs, type RpcName } from "@/lib/rpc";

// Acciones de Producción (S-15…S-21, S-38, S-39). Las reglas (vigencia, SOD, equipos, lotes, capacitación) viven en
// las RPC de 0029 y 0030; aquí solo se validan formatos y se traducen los errores.

export type PrResult<T = object> =
  | ({ ok: true } & T)
  | {
      ok: false;
      code: string;
      rule: string;
      action: string;
      detail?: string;
      remaining?: number;
    };

function fail(error: unknown): PrResult<never> {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      code: "INVALID_FIELD",
      ...ERROR_MESSAGES.INVALID_FIELD,
      detail: error.issues[0]?.message,
    };
  }
  const e = toAppError(error);
  log.warn("production.action_failed", { code: e.code, detail: e.details });
  return { ok: false, code: e.code, rule: e.rule, action: e.action, detail: e.details };
}

function soft(res: Record<string, unknown>): PrResult<never> {
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

/** Llama una RPC firmada y devuelve su resultado; un resultado con ok=false es un intento de contraseña fallido. */
async function signed<N extends RpcName>(
  name: N,
  args: RpcArgs<N>,
  paths: string[],
): Promise<PrResult<{ data: Record<string, unknown> }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, name, ...([args] as never))) as Record<string, unknown>;
    if (res && res.ok === false) return soft(res);
    log.info("production.action", { rpc: name });
    for (const p of paths) revalidatePath(p);
    return { ok: true, data: res ?? {} };
  } catch (e) {
    return fail(e);
  }
}

const batchPaths = (batchId?: string) => [
  "/produccion/lotes",
  ...(batchId ? [`/produccion/lotes/${batchId}`] : []),
];

// ---------------------------------------------------------------------------
// Orden de producción (S-15, S-38)
// ---------------------------------------------------------------------------
export type OrderInput = {
  productId: string;
  batchSize: number;
  plannedDate: string;
  presentations: { presentation_id: string; bulk_qty: number; units: number }[];
  notes: string;
};

export async function createOrder(
  input: OrderInput,
): Promise<PrResult<{ orderId: string; code: string; batchCode: string }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "create_production_order", {
      p_product: uuid.parse(input.productId),
      p_batch_size: z.number().positive("Indique el tamaño del lote").parse(input.batchSize),
      p_planned_date: z.string().min(10, "Indique la fecha planeada").parse(input.plannedDate),
      p_presentations: input.presentations,
      p_notes: input.notes,
    })) as Record<string, string>;
    log.info("production.order_created");
    revalidatePath("/produccion/lotes");
    return { ok: true, orderId: res.order_id, code: res.code, batchCode: res.batch_code };
  } catch (e) {
    return fail(e);
  }
}

export async function approveOrder(orderId: string, pw: string) {
  return signed(
    "approve_production_order",
    { p_order: uuid.parse(orderId), p_password: password.parse(pw) },
    ["/produccion/lotes", `/produccion/ordenes/${orderId}/documentos`],
  );
}

// ---------------------------------------------------------------------------
// Prealistamiento: despeje y limpieza (S-17, S-39)
// ---------------------------------------------------------------------------
export async function executeClearance(
  batchId: string,
  stageOrderId: string,
  checklist: { item: string; ok: boolean; note?: string }[],
  pw: string,
) {
  return signed(
    "execute_line_clearance",
    {
      p_stage_order: uuid.parse(stageOrderId),
      p_checklist: checklist,
      p_password: password.parse(pw),
    },
    batchPaths(batchId),
  );
}

export async function verifyClearance(batchId: string, clearanceId: string, pw: string) {
  return signed(
    "verify_line_clearance",
    { p_clearance: uuid.parse(clearanceId), p_password: password.parse(pw) },
    batchPaths(batchId),
  );
}

export async function recordCleaning(
  batchId: string,
  stageOrderId: string,
  equipmentId: string | null,
  data: { valid_until: string; utensils: string[]; label_verified: boolean },
  pw: string,
) {
  return signed(
    "record_stage_cleaning",
    {
      p_stage_order: uuid.parse(stageOrderId),
      p_equipment: equipmentId ? uuid.parse(equipmentId) : NULL,
      p_data: data,
      p_password: password.parse(pw),
    },
    [...batchPaths(batchId), "/equipos"],
  );
}

export async function verifyCleaningRecord(batchId: string, cleaningId: string, pw: string) {
  return signed(
    "verify_stage_cleaning",
    { p_cleaning: uuid.parse(cleaningId), p_password: password.parse(pw) },
    [...batchPaths(batchId), "/equipos"],
  );
}

export async function startStage(batchId: string, stageOrderId: string) {
  return signed("start_stage", { p_stage_order: uuid.parse(stageOrderId) }, batchPaths(batchId));
}

export async function completeStage(batchId: string, stageOrderId: string, pw: string) {
  return signed(
    "complete_stage",
    { p_stage_order: uuid.parse(stageOrderId), p_password: password.parse(pw) },
    batchPaths(batchId),
  );
}

// ---------------------------------------------------------------------------
// Dispensación (S-18)
// ---------------------------------------------------------------------------
export async function dispenseLot(
  batchId: string,
  input: { lineId: string; lotId: string; qty: number; balanceId: string; tare: number | null },
  pw: string,
) {
  return signed(
    "dispense_lot",
    {
      p_line: uuid.parse(input.lineId),
      p_lot: uuid.parse(input.lotId),
      p_qty: z.number().positive("Indique el peso").parse(input.qty),
      p_balance: uuid.parse(input.balanceId),
      p_tare: input.tare as number,
      p_password: password.parse(pw),
    },
    [...batchPaths(batchId), "/bodega/inventario"],
  );
}

export async function verifyDispensing(batchId: string, dispensingId: string, pw: string) {
  return signed(
    "verify_dispensing",
    { p_dispensing: uuid.parse(dispensingId), p_password: password.parse(pw) },
    batchPaths(batchId),
  );
}

// ---------------------------------------------------------------------------
// Registros de etapa (S-19, S-20, S-21)
// ---------------------------------------------------------------------------
/** Borrador por campo; la hora la pone el servidor. Lo llama la cola local del navegador. */
export async function saveStepDraft(input: {
  stageOrderId: string;
  stepKey: string;
  presentationId: string | null;
  values: Record<string, unknown>;
}): Promise<PrResult<{ savedAt: string }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "save_step_draft", {
      p_stage_order: uuid.parse(input.stageOrderId),
      p_step_key: input.stepKey,
      p_presentation: input.presentationId ? uuid.parse(input.presentationId) : NULL,
      p_values: input.values as never,
    })) as Record<string, string>;
    return { ok: true, savedAt: res.saved_at };
  } catch (e) {
    return fail(e);
  }
}

export async function completeStep(
  batchId: string,
  input: {
    stageOrderId: string;
    stepKey: string;
    presentationId: string | null;
    values: Record<string, number>;
    equipment: string[];
    notes: string;
  },
  pw: string,
) {
  return signed(
    "complete_step",
    {
      p_stage_order: uuid.parse(input.stageOrderId),
      p_step_key: input.stepKey,
      p_presentation: input.presentationId ? uuid.parse(input.presentationId) : NULL,
      p_values: input.values,
      p_equipment: input.equipment.map((e) => uuid.parse(e)),
      p_notes: input.notes,
      p_password: password.parse(pw),
    },
    [...batchPaths(batchId), "/equipos"],
  );
}

export async function verifyStep(batchId: string, recordId: string, pw: string) {
  return signed(
    "verify_step",
    { p_record: uuid.parse(recordId), p_password: password.parse(pw) },
    batchPaths(batchId),
  );
}

export async function recordWeight(
  batchId: string,
  input: { stageOrderId: string; presentationId: string; value: number; action: string },
  pw: string,
) {
  return signed(
    "record_weight_control",
    {
      p_stage_order: uuid.parse(input.stageOrderId),
      p_presentation: uuid.parse(input.presentationId),
      p_value: z.number().positive("Registre el peso neto").parse(input.value),
      p_action: input.action,
      p_password: password.parse(pw),
    },
    batchPaths(batchId),
  );
}

export async function recordOutput(
  batchId: string,
  input: {
    stageOrderId: string;
    presentationId: string | null;
    data: Record<string, number | null>;
  },
  pw: string,
) {
  return signed(
    "record_stage_output",
    {
      p_stage_order: uuid.parse(input.stageOrderId),
      p_presentation: input.presentationId ? uuid.parse(input.presentationId) : NULL,
      p_data: input.data,
      p_password: password.parse(pw),
    },
    batchPaths(batchId),
  );
}

export async function recordInspection(
  batchId: string,
  input: {
    stageOrderId: string;
    presentationId: string;
    points: { n: number; label: string; result: string; note: string }[];
  },
  pw: string,
) {
  return signed(
    "record_pt_inspection",
    {
      p_stage_order: uuid.parse(input.stageOrderId),
      p_presentation: uuid.parse(input.presentationId),
      p_points: input.points,
      p_password: password.parse(pw),
    },
    batchPaths(batchId),
  );
}

export async function recordReturn(
  batchId: string,
  input: { lineId: string; used: number; damaged: number; returned: number },
  pw: string,
) {
  return signed(
    "record_material_return",
    {
      p_line: uuid.parse(input.lineId),
      p_data: { used: input.used, damaged: input.damaged, returned: input.returned },
      p_password: password.parse(pw),
    },
    batchPaths(batchId),
  );
}

export async function verifyCoding(batchId: string, pw: string) {
  return signed(
    "verify_coding",
    { p_batch: uuid.parse(batchId), p_password: password.parse(pw) },
    batchPaths(batchId),
  );
}

/** Corrección con motivo (DI-4, DI-12): el valor anterior queda tachado. */
export async function correctRecord(
  batchId: string,
  input: { table: string; recordId: string; field: string; value: unknown; reason: string },
): Promise<PrResult<{ warning: boolean; count: number }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "record_correction", {
      p_table: input.table,
      p_record_id: uuid.parse(input.recordId),
      p_field: input.field,
      p_new_value: input.value as never,
      p_reason: input.reason,
    })) as Record<string, unknown>;
    for (const p of batchPaths(batchId)) revalidatePath(p);
    return { ok: true, warning: res.warning === true, count: Number(res.count) };
  } catch (e) {
    return fail(e);
  }
}

/** Versiones que se congelarán y avisos de revisión vencida (S-15), sin crear nada. */
export async function previewOrder(productId: string): Promise<
  PrResult<{
    documents: unknown[];
    warnings: { code: string; message: string }[];
    batchSize: number;
  }>
> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "preview_production_order", {
      p_product: uuid.parse(productId),
    })) as Record<string, unknown>;
    return {
      ok: true,
      documents: (res.documents as unknown[]) ?? [],
      warnings: (res.warnings as { code: string; message: string }[]) ?? [],
      batchSize: Number(res.formula_batch_size ?? 0),
    };
  } catch (e) {
    return fail(e);
  }
}
