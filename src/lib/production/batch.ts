import "server-only";

import { toAppError } from "@/lib/errors";
import { callRpc } from "@/lib/rpc";
import type { ProductionAccess } from "./access";
import type { FrozenDocument, Presentation } from "./labels";

type Person = { full_name: string } | null;

/** Todo lo del lote para las pantallas de ejecución (RLS: lectores de Producción). */
export async function loadBatch(a: ProductionAccess, batchId: string) {
  const sb = a.supabase;
  const { data: batch } = await sb
    .from("batches")
    .select(
      "*, production_orders!batches_order_id_fkey(*), products(code, name, titular, sanitary_registration)",
    )
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return null;
  const order = batch.production_orders as unknown as {
    id: string;
    code: string;
    status: string;
    presentations: Presentation[];
    frozen_documents: FrozenDocument[];
    document_warnings: { code: string; message: string }[];
    planned_date: string;
    created_by: string;
  };
  const { data: stages } = await sb
    .from("stage_orders")
    .select("*")
    .eq("batch_id", batchId)
    .order("order_no");
  const stageIds = (stages ?? []).map((s) => s.id);
  const [
    { data: clearances },
    { data: cleanings },
    { data: requests },
    { data: lots },
    { data: steps },
    { data: weights },
    { data: outputs },
    { data: inspections },
    { data: returns },
    { data: coding },
    { data: transfers },
    { data: drafts },
  ] = await Promise.all([
    sb
      .from("line_clearances")
      .select(
        "*, ex:profiles!line_clearances_executed_by_fkey(full_name), ve:profiles!line_clearances_verified_by_fkey(full_name)",
      )
      .in("stage_order_id", stageIds),
    sb
      .from("cleaning_records")
      .select(
        "*, equipment(code, name), ex:profiles!cleaning_records_cleaned_by_fkey(full_name), ve:profiles!cleaning_records_verified_by_fkey(full_name)",
      )
      .in("stage_order_id", stageIds)
      .order("cleaned_at"),
    sb
      .from("material_requests")
      .select("*, material_request_lines(*, materials(code, name, unit))")
      .eq("batch_id", batchId)
      .order("code"),
    sb
      .from("dispensing_line_lots")
      .select(
        "*, material_lots(internal_code, supplier_lot, expiry_date), equipment(code), storage_locations(code), ex:profiles!dispensing_line_lots_executed_by_fkey(full_name), ve:profiles!dispensing_line_lots_verified_by_fkey(full_name)",
      )
      .in("stage_order_id", stageIds)
      .order("executed_at"),
    sb
      .from("step_records")
      .select(
        "*, ex:profiles!step_records_executed_by_fkey(full_name), ve:profiles!step_records_verified_by_fkey(full_name), step_equipment(equipment_id, validity, equipment(code))",
      )
      .in("stage_order_id", stageIds)
      .order("step_no"),
    sb.from("weight_controls").select("*").in("stage_order_id", stageIds).order("sample_no"),
    sb.from("stage_outputs").select("*").in("stage_order_id", stageIds),
    sb
      .from("pt_inspections")
      .select("*, ins:profiles!pt_inspections_inspector_id_fkey(full_name)")
      .in("stage_order_id", stageIds),
    sb.from("material_returns").select("*"),
    sb.from("coding_orders").select("*").eq("batch_id", batchId).maybeSingle(),
    sb.from("bulk_transfers").select("*").eq("batch_id", batchId).order("created_at"),
    sb.from("step_drafts").select("*").in("stage_order_id", stageIds),
  ]);
  const stageSteps = Object.fromEntries(
    await Promise.all(
      (stages ?? []).map(async (s) => [
        s.id,
        (await callRpc(sb, "production_stage_steps", { p_stage_order: s.id }).catch(() => [])) ??
          [],
      ]),
    ),
  ) as Record<string, StageStep[]>;
  const recordIds = [
    ...(steps ?? []).map((r) => r.id),
    ...(weights ?? []).map((r) => r.id),
    ...(lots ?? []).map((r) => r.id),
  ];
  const { data: corrections } = recordIds.length
    ? await sb
        .from("corrections")
        .select("record_id, field, old_value, new_value, reason, short_signature, corrected_at")
        .in("record_id", recordIds)
        .order("corrected_at")
    : { data: [] };
  return {
    batch,
    order,
    product: batch.products as unknown as {
      code: string;
      name: string;
      titular: string | null;
      sanitary_registration: string | null;
    },
    stages: stages ?? [],
    stageSteps,
    clearances: (clearances ?? []).map((c) => ({
      ...c,
      executedBy: (c.ex as Person)?.full_name ?? "—",
      verifiedBy: (c.ve as Person)?.full_name ?? null,
    })),
    cleanings: (cleanings ?? []).map((c) => ({
      ...c,
      cleanedBy: (c.ex as Person)?.full_name ?? "—",
      verifiedBy: (c.ve as Person)?.full_name ?? null,
      equipmentCode: (c.equipment as { code: string } | null)?.code ?? null,
    })),
    requests: requests ?? [],
    lots: (lots ?? []).map((l) => ({
      ...l,
      lotCode: (l.material_lots as { internal_code: string } | null)?.internal_code ?? "—",
      balanceCode: (l.equipment as { code: string } | null)?.code ?? "—",
      locationCode: (l.storage_locations as { code: string } | null)?.code ?? "—",
      executedBy: (l.ex as Person)?.full_name ?? "—",
      verifiedBy: (l.ve as Person)?.full_name ?? null,
    })),
    steps: (steps ?? []).map((r) => ({
      ...r,
      executedBy: (r.ex as Person)?.full_name ?? "—",
      verifiedBy: (r.ve as Person)?.full_name ?? null,
      equipmentCodes: (
        (r.step_equipment as { equipment: { code: string } | null }[] | null) ?? []
      ).map((e) => e.equipment?.code ?? ""),
    })),
    weights: weights ?? [],
    outputs: outputs ?? [],
    inspections: (inspections ?? []).map((i) => ({
      ...i,
      inspector: (i.ins as Person)?.full_name ?? "—",
    })),
    returns: returns ?? [],
    coding,
    transfers: transfers ?? [],
    drafts: drafts ?? [],
    corrections: corrections ?? [],
  };
}

export type BatchData = NonNullable<Awaited<ReturnType<typeof loadBatch>>>;

export type StageStep = {
  step_key: string;
  order_no: number;
  label: string;
  text: string;
  params: {
    name: string;
    unit?: string;
    min?: number | null;
    max?: number | null;
    frequency?: string;
  }[];
  requires_equipment: string | null;
  requires_verification: boolean;
};

/** Equipos activos con su validez ahora (balanzas para dispensar; los demás para los pasos). */
export async function loadEquipment(a: ProductionAccess) {
  const { data } = await a.supabase
    .from("v_equipment_status")
    .select(
      "id, code, name, equipment_type, valid, fitness, reasons, calibration_due, maintenance_due, cleaning_until, requires_calibration, requires_cleaning",
    )
    .eq("active", true)
    .order("code");
  return (data ?? []).map((e) => ({
    id: String(e.id),
    code: String(e.code),
    name: String(e.name),
    type: String(e.equipment_type),
    valid: Boolean(e.valid),
    reasons: (e.reasons as string[] | null) ?? [],
    calibrationDue: e.requires_calibration ? (e.calibration_due ?? null) : "N.A.",
    maintenanceDue: e.maintenance_due ?? null,
    cleaningUntil: e.requires_cleaning ? (e.cleaning_until ?? null) : "N.A.",
  }));
}

export type EquipmentOption = Awaited<ReturnType<typeof loadEquipment>>[number];

/** Aviso o bloqueo por capacitación del formato que rige la etapa (AC-25, D-19). */
export async function trainingNotice(a: ProductionAccess, versionId: string | null | undefined) {
  if (!versionId || !a.execute) return null;
  try {
    const res = (await callRpc(a.supabase, "assert_training", {
      p_version: versionId,
      p_user: a.ctx.userId,
    })) as { warning?: string };
    return res?.warning ? { blocked: false, message: `${res.warning}.` } : null;
  } catch (e) {
    const err = toAppError(e);
    return err.code === "TRAINING_REQUIRED"
      ? { blocked: true, message: `${err.details ?? err.rule}.` }
      : null;
  }
}
