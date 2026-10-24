"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { ERROR_MESSAGES, toAppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { callRpc } from "@/lib/rpc";

// Acciones de I+D y documentos maestros (S-05…S-10, S-36, S-37). Las reglas viven en las RPC.

export type RdResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; code: string; rule: string; action: string; detail?: string; remaining?: number };

function fail(error: unknown): RdResult<never> {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      code: "INVALID_FIELD",
      ...ERROR_MESSAGES.INVALID_FIELD,
      detail: error.issues[0]?.message,
    };
  }
  const e = toAppError(error);
  log.warn("rd.action_failed", { code: e.code, detail: e.details });
  return { ok: false, code: e.code, rule: e.rule, action: e.action, detail: e.details };
}

function soft(res: Record<string, unknown>): RdResult<never> {
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
  for (const p of ["/idi/briefs", "/idi/prototipos", "/aprobaciones", ...paths]) revalidatePath(p);
}

// ---------------------------------------------------------------------------
// Brief (RF-10)
// ---------------------------------------------------------------------------
export type BriefInput = {
  product_id?: string | null;
  execution_date?: string | null;
  project_name: string;
  project_type?: string | null;
  product_category?: string | null;
  justification: string;
  sources_description: string;
  sensorial: Record<string, string>;
  target: Record<string, string>;
  channels: string[];
  channels_other?: string;
  margin_pct?: number | null;
  suggested_price_by_presentation: { presentation: string; price: number | null }[];
  legal_requirements: string;
  implementation_costs: string;
  recommendations: string;
};

export type CompetitorInput = {
  manufacturer: string;
  product_name: string;
  container?: string;
  cap_type?: string;
  label_type?: string;
  claims?: string;
  actives?: string;
  price?: number | null;
  net_content_ml?: number | null;
  aroma?: string;
  color?: string;
  appearance?: string;
};

export async function saveBrief(input: {
  id?: string | null;
  data: BriefInput;
  competitors: CompetitorInput[];
}): Promise<RdResult<{ id: string; code: string }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "save_brief", {
      p_id: input.id ? uuid.parse(input.id) : NULL,
      p_data: input.data as never,
      p_competitors: input.competitors as never,
    })) as { id: string; code: string };
    refresh(`/idi/briefs/${res.id}`);
    return { ok: true, id: res.id, code: res.code };
  } catch (e) {
    return fail(e);
  }
}

export async function submitBrief(input: { id: string; password: string }): Promise<RdResult> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "submit_brief", {
      p_id: uuid.parse(input.id),
      p_password: password.parse(input.password),
    })) as Record<string, unknown>;
    if (res.ok !== true) return soft(res);
    log.info("rd.brief_submitted", {});
    refresh(`/idi/briefs/${input.id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function decideBrief(input: {
  id: string;
  decision: "aprobado" | "devuelto";
  reason: string;
  password: string;
}): Promise<RdResult> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "decide_brief", {
      p_id: uuid.parse(input.id),
      p_decision: input.decision,
      p_reason: input.reason,
      p_password: password.parse(input.password),
    })) as Record<string, unknown>;
    if (res.ok !== true) return soft(res);
    refresh(`/idi/briefs/${input.id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Prototipos y estabilidad (RF-15, RF-16)
// ---------------------------------------------------------------------------
export type ItemInput = { material_id: string; pct: number; phase?: string; function?: string };

export async function savePrototype(input: {
  id?: string | null;
  briefId?: string | null;
  data: {
    product_type: string;
    target_description: string;
    benefit: string;
    concept: string;
    draft_instruction: string;
  };
  items: ItemInput[];
}): Promise<RdResult<{ id: string; code: string }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "save_prototype", {
      p_id: input.id ? uuid.parse(input.id) : NULL,
      p_brief: input.briefId ? uuid.parse(input.briefId) : NULL,
      p_data: input.data,
      p_items: input.items as never,
    })) as { id: string; code: string };
    refresh(`/idi/prototipos/${res.id}`);
    return { ok: true, id: res.id, code: res.code };
  } catch (e) {
    return fail(e);
  }
}

export async function createImprovement(input: {
  parentId: string;
  reason: string;
}): Promise<RdResult<{ id: string; code: string }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "create_prototype_improvement", {
      p_parent: uuid.parse(input.parentId),
      p_reason: input.reason,
    })) as { id: string; code: string };
    refresh();
    return { ok: true, id: res.id, code: res.code };
  } catch (e) {
    return fail(e);
  }
}

export async function discardPrototype(input: { id: string; reason: string }): Promise<RdResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "discard_prototype", {
      p_id: uuid.parse(input.id),
      p_reason: input.reason,
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function startStudy(input: {
  prototypeId: string;
  densityRequired: boolean;
}): Promise<RdResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "start_stability_study", {
      p_prototype: uuid.parse(input.prototypeId),
      p_density_required: input.densityRequired,
    });
    refresh(`/idi/prototipos/${input.prototypeId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Registra las repeticiones de un tiempo de una prueba (una llamada por repetición). */
export async function recordReadings(input: {
  testId: string;
  timePoint: string;
  readings: { replicate: number; values: Record<string, unknown> }[];
  path: string;
}): Promise<RdResult<{ recorded: number }>> {
  const supabase = await createClient();
  let n = 0;
  try {
    for (const r of input.readings) {
      await callRpc(supabase, "record_stability_reading", {
        p_test: uuid.parse(input.testId),
        p_time_point: input.timePoint,
        p_replicate: r.replicate,
        p_values: r.values as never,
      });
      n++;
    }
    revalidatePath(input.path);
    return { ok: true, recorded: n };
  } catch (e) {
    revalidatePath(input.path);
    const f = fail(e);
    return n > 0 && !f.ok
      ? { ...f, detail: `${f.detail ?? ""} (se registraron ${n} antes del error)` }
      : f;
  }
}

export async function closeStudy(input: {
  studyId: string;
  result: "cumple" | "no_cumple";
  reason: string;
  conclusions: string;
  password: string;
  path: string;
}): Promise<RdResult> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "close_stability_study", {
      p_study: uuid.parse(input.studyId),
      p_result: input.result,
      p_reason: input.reason,
      p_conclusions: input.conclusions,
      p_password: password.parse(input.password),
    })) as Record<string, unknown>;
    if (res.ok !== true) return soft(res);
    refresh(input.path);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setCriteria(input: {
  productId: string;
  values: {
    ph_max_variation: number | null;
    viscosity_max_variation_pct: number | null;
    density_max_variation: number | null;
    micro_limits: { mesofilos_max: number | null; ausentes: string[] } | null;
    organoleptic_changes_allowed: boolean | null;
    reading_window_hours: number | null;
    notes: string;
  };
  reason: string;
  path: string;
}): Promise<RdResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "set_stability_criteria", {
      p_product: uuid.parse(input.productId),
      p_values: input.values as never,
      p_reason: input.reason,
    });
    revalidatePath(input.path);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function approvePrototype(input: {
  id: string;
  asClient: boolean;
  clientReference: string;
  reason: string;
  password: string;
}): Promise<RdResult<{ status: string }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "approve_prototype", {
      p_prototype: uuid.parse(input.id),
      p_as_client: input.asClient,
      p_client_reference: input.clientReference,
      p_reason: input.reason,
      p_password: password.parse(input.password),
    })) as Record<string, unknown>;
    if (res.ok !== true) return soft(res);
    refresh(`/idi/prototipos/${input.id}`);
    return { ok: true, status: String(res.status) };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Documentos maestros (RF-11…RF-13) y costos (RF-17)
// ---------------------------------------------------------------------------
/** Crea la solicitud y la versión en borrador de un documento maestro (sobre el SGD). */
export async function newMasterDocument(input: {
  typeCode: "FM" | "EP" | "IN";
  title: string;
  reason: string;
}): Promise<RdResult<{ versionId: string }>> {
  try {
    const supabase = await createClient();
    const [{ data: area }, { data: type }] = await Promise.all([
      supabase.from("organizational_areas").select("id").eq("code", "IDI").maybeSingle(),
      supabase.from("document_types").select("id").eq("type_code", input.typeCode).maybeSingle(),
    ]);
    const res = (await callRpc(supabase, "request_document", {
      p_kind: "creacion",
      p_document_id: NULL,
      p_process_id: area?.id ?? NULL,
      p_type_id: type?.id ?? NULL,
      p_parent_document_id: NULL,
      p_title: input.title,
      p_reason: input.reason,
      p_distribution: [],
    })) as { version_id: string };
    refresh("/documentos");
    return { ok: true, versionId: res.version_id };
  } catch (e) {
    return fail(e);
  }
}

export async function saveFormula(input: {
  versionId: string;
  productId: string;
  batchSize: number;
  items: ItemInput[] | null;
  prototypeId?: string | null;
  path: string;
}): Promise<RdResult<{ sum: number }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "save_formula_draft", {
      p_version: uuid.parse(input.versionId),
      p_product: uuid.parse(input.productId),
      p_batch_size: input.batchSize,
      p_items: (input.items ?? null) as never,
      p_prototype: input.prototypeId ? uuid.parse(input.prototypeId) : undefined,
    })) as { sum: number };
    revalidatePath(input.path);
    return { ok: true, sum: Number(res.sum) };
  } catch (e) {
    return fail(e);
  }
}

export async function saveSpecification(input: {
  versionId: string;
  scope: "mp" | "envase" | "granel" | "pt";
  productId?: string | null;
  materialId?: string | null;
  params: {
    name: string;
    method: string;
    min_value: number | null;
    max_value: number | null;
    unit: string;
    text_limit: string;
  }[];
  path: string;
}): Promise<RdResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "save_specification_draft", {
      p_version: uuid.parse(input.versionId),
      p_scope: input.scope,
      p_product: input.productId ?? NULL,
      p_material: input.materialId ?? NULL,
      p_params: input.params as never,
    });
    revalidatePath(input.path);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveInstruction(input: {
  versionId: string;
  productId: string;
  stage: "fabricacion" | "envase" | "acondicionamiento";
  presentationId?: string | null;
  steps: {
    label: string;
    text: string;
    requires_equipment: string;
    requires_verification: boolean;
    params: {
      name: string;
      unit: string;
      min: number | null;
      max: number | null;
      frequency: string;
    }[];
  }[];
  path: string;
}): Promise<RdResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "save_instruction_draft", {
      p_version: uuid.parse(input.versionId),
      p_product: uuid.parse(input.productId),
      p_stage: input.stage,
      p_presentation: input.presentationId ?? NULL,
      p_steps: input.steps as never,
    });
    revalidatePath(input.path);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveCostSheet(input: {
  formulaId: string;
  batchSize: number;
  density: number;
  ingredientCosts: Record<string, number>;
  packaging: {
    presentation_id: string;
    kind: string;
    description: string;
    unit_cost: number;
    qty: number;
  }[];
  units: Record<string, number>;
  reason: string;
  path: string;
}): Promise<RdResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "save_cost_sheet", {
      p_formula: uuid.parse(input.formulaId),
      p_prototype: NULL,
      p_batch_size: input.batchSize,
      p_density: input.density,
      p_ingredient_costs: input.ingredientCosts as never,
      p_packaging: input.packaging as never,
      p_units: input.units as never,
      p_reason: input.reason,
    });
    revalidatePath(input.path);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
