"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { ERROR_MESSAGES, toAppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { callRpc } from "@/lib/rpc";

// Acciones del sistema de gestión documental (S-43…S-49). Toda regla vive en las RPC de la base
// (rol, estado, SOD, reautenticación y bitácora); aquí solo se valida la forma y se traduce la respuesta.

export type DocResult<T = object> =
  | ({ ok: true } & T)
  | {
      ok: false;
      code: string;
      rule: string;
      action: string;
      detail?: string;
      remaining?: number;
      observations?: Observation[];
    };

export type Observation = { section: string; rule: string; message: string };

function fail(error: unknown): DocResult<never> {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      code: "INVALID_FIELD",
      ...ERROR_MESSAGES.INVALID_FIELD,
      detail: error.issues[0]?.message,
    };
  }
  const e = toAppError(error);
  log.warn("documents.action_failed", { code: e.code, detail: e.details });
  return { ok: false, code: e.code, rule: e.rule, action: e.action, detail: e.details };
}

/** Respuesta {ok:false, code} de una RPC con reautenticación o regla registrada (no excepción). */
function soft(res: Record<string, unknown>): DocResult<never> {
  const code = String(res.code) as keyof typeof ERROR_MESSAGES;
  return {
    ok: false,
    code,
    ...(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.REAUTH_FAILED),
    remaining: typeof res.remaining === "number" ? res.remaining : undefined,
    observations: Array.isArray(res.observations) ? (res.observations as Observation[]) : undefined,
  };
}

const uuid = z.uuid();
const reason = z.string().trim().min(1, "El motivo es obligatorio").max(1000);
const password = z.string().min(1, "Escriba su contraseña").max(200);

function refresh(...paths: string[]) {
  for (const p of ["/documentos", ...paths]) revalidatePath(p);
}

// ---------------------------------------------------------------------------
// Solicitud y preliminar
// ---------------------------------------------------------------------------
export async function requestDocument(input: {
  kind: "creacion" | "modificacion" | "anulacion";
  documentId?: string | null;
  processId?: string | null;
  typeId?: string | null;
  parentDocumentId?: string | null;
  title?: string;
  reason: string;
  distribution: string[];
}): Promise<DocResult<{ requestCode: string; versionId?: string; documentId?: string }>> {
  try {
    const p = z
      .object({
        kind: z.enum(["creacion", "modificacion", "anulacion"]),
        documentId: uuid.nullish(),
        processId: uuid.nullish(),
        typeId: uuid.nullish(),
        parentDocumentId: uuid.nullish(),
        title: z.string().trim().max(200).optional(),
        reason,
        distribution: z.array(uuid).max(30),
      })
      .parse(input);
    const supabase = await createClient();
    const res = (await callRpc(supabase, "request_document", {
      p_kind: p.kind,
      p_document_id: p.documentId ?? (null as unknown as string),
      p_process_id: p.processId ?? (null as unknown as string),
      p_type_id: p.typeId ?? (null as unknown as string),
      p_parent_document_id: p.parentDocumentId ?? (null as unknown as string),
      p_title: p.title ?? "",
      p_reason: p.reason,
      p_distribution: p.distribution,
    })) as { request_code: string; version_id: string | null };
    log.info("documents.requested", { kind: p.kind, code: res.request_code });
    refresh("/documentos/cambios");
    return {
      ok: true,
      requestCode: res.request_code,
      versionId: res.version_id ?? undefined,
      documentId: p.documentId ?? undefined,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function saveDraft(input: {
  versionId: string;
  content: Record<string, string>;
  changeDescription?: string;
  technicalChange?: boolean;
}): Promise<DocResult> {
  try {
    const p = z
      .object({
        versionId: uuid,
        content: z.record(z.string(), z.string().max(20000)),
        changeDescription: z.string().max(1000).optional(),
        technicalChange: z.boolean().optional(),
      })
      .parse(input);
    const supabase = await createClient();
    await callRpc(supabase, "save_document_draft", {
      p_version: p.versionId,
      p_content: p.content,
      p_change_description: p.changeDescription,
      p_technical_change: p.technicalChange,
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function submitForStandardization(input: { versionId: string }): Promise<DocResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "submit_for_standardization", {
      p_version: uuid.parse(input.versionId),
    });
    refresh("/documentos/estandarizacion");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Revisor de redacción en vivo (misma función que usa la estandarización). */
export async function previewStyle(input: {
  content: Record<string, string>;
  typeId: string;
}): Promise<Observation[]> {
  try {
    const supabase = await createClient();
    return ((await callRpc(supabase, "style_observations", {
      p_content: input.content,
      p_type_id: uuid.parse(input.typeId),
    })) ?? []) as Observation[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Estandarización y código (solo aq_doc)
// ---------------------------------------------------------------------------
export async function runStyleCheck(input: {
  versionId: string;
  checklist: { encabezado: boolean; unidades_si: boolean; na: boolean };
}): Promise<DocResult> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "run_style_check", {
      p_version: uuid.parse(input.versionId),
      p_checklist: input.checklist,
    })) as Record<string, unknown>;
    refresh("/documentos/estandarizacion");
    if (res.ok !== true) return soft(res);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function assignCode(input: {
  versionId: string;
  title?: string;
  routeId?: string | null;
  regulatoryExpiry?: string | null;
  validityRule?: string | null;
}): Promise<DocResult<{ code: string; documentId: string }>> {
  try {
    const p = z
      .object({
        versionId: uuid,
        title: z.string().trim().max(200).optional(),
        routeId: uuid.nullish(),
        regulatoryExpiry: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish()
          .or(z.literal("")),
        validityRule: z
          .enum(["periodo", "registro_sanitario", "validacion_tecnica"])
          .nullish()
          .or(z.literal("")),
      })
      .parse(input);
    const supabase = await createClient();
    const res = (await callRpc(supabase, "request_document_code", {
      p_version: p.versionId,
      p_title: p.title,
      p_route_id: p.routeId ?? undefined,
      p_regulatory_expiry: p.regulatoryExpiry || undefined,
      p_validity_rule: p.validityRule || undefined,
    })) as { code: string; document_id: string };
    log.info("documents.coded", { code: res.code });
    refresh("/documentos/estandarizacion");
    return { ok: true, code: res.code, documentId: res.document_id };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Firmas del ciclo: actualizó, revisó, aprobó (con contraseña)
// ---------------------------------------------------------------------------
export async function signVersion(input: {
  versionId: string;
  step: "actualizo" | "reviso" | "aprobo";
  password: string;
  reason?: string;
}): Promise<DocResult> {
  try {
    const p = z
      .object({
        versionId: uuid,
        step: z.enum(["actualizo", "reviso", "aprobo"]),
        password,
        reason: z.string().max(1000).optional(),
      })
      .parse(input);
    const supabase = await createClient();
    const res = (
      p.step === "actualizo"
        ? await callRpc(supabase, "submit_for_review", {
            p_version: p.versionId,
            p_password: p.password,
          })
        : p.step === "reviso"
          ? await callRpc(supabase, "review_document", {
              p_version: p.versionId,
              p_password: p.password,
              p_reason: p.reason,
            })
          : await callRpc(supabase, "approve_document", {
              p_version: p.versionId,
              p_password: p.password,
              p_reason: p.reason,
            })
    ) as Record<string, unknown>;
    if (res.ok !== true) return soft(res);
    log.info("documents.signed", { step: p.step });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function publishVersion(input: {
  versionId: string;
  distribution: string[];
}): Promise<DocResult<{ code: string; reviewDueDate: string }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "publish_document", {
      p_version: uuid.parse(input.versionId),
      p_distribution: z.array(uuid).parse(input.distribution),
    })) as { code: string; review_due_date: string };
    log.info("documents.published", { code: res.code });
    refresh("/documentos/cambios", "/master/plantillas");
    return { ok: true, code: res.code, reviewDueDate: res.review_due_date };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Copias y control de documentos
// ---------------------------------------------------------------------------
export async function recallCopy(input: {
  distributionId: string;
  note: string;
}): Promise<DocResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "recall_copy", {
      p_distribution: uuid.parse(input.distributionId),
      p_note: input.note,
    });
    refresh("/documentos/cambios");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function issueCopy(input: {
  versionId: string;
  areaId?: string | null;
  recipient?: string;
  copyType: "controlada" | "no_controlada";
}): Promise<DocResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "issue_copy", {
      p_version: uuid.parse(input.versionId),
      p_area_id: input.areaId ? uuid.parse(input.areaId) : (null as unknown as string),
      p_recipient: input.recipient ?? "",
      p_copy_type: input.copyType,
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Control de cambios y anulación
// ---------------------------------------------------------------------------
export async function registerChangeRequest(input: {
  documentId: string;
  origin: string;
  originRef: string;
  reason: string;
  impact: string;
  technicalChange: boolean;
  authorId?: string | null;
}): Promise<DocResult<{ code: string }>> {
  try {
    const p = z
      .object({
        documentId: uuid,
        origin: z.enum([
          "desviacion",
          "capa",
          "auditoria",
          "mejora",
          "regulatorio",
          "renovacion_registro",
        ]),
        originRef: z.string().max(80),
        reason,
        impact: z.string().max(1000),
        technicalChange: z.boolean(),
        authorId: uuid.nullish(),
      })
      .parse(input);
    const supabase = await createClient();
    const res = (await callRpc(supabase, "register_change_request", {
      p_document_id: p.documentId,
      p_origin: p.origin,
      p_origin_ref: p.originRef,
      p_reason: p.reason,
      p_impact: p.impact,
      p_technical_change: p.technicalChange,
      p_author_id: p.authorId ?? undefined,
    })) as { code: string };
    refresh("/documentos/cambios");
    return { ok: true, code: res.code };
  } catch (e) {
    return fail(e);
  }
}

export async function setParentReview(input: {
  changeRequestId: string;
  decision: "sin_cambio" | "nueva_version";
  note: string;
}): Promise<DocResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "set_parent_review", {
      p_change_request: uuid.parse(input.changeRequestId),
      p_decision: input.decision,
      p_note: reason.parse(input.note),
    });
    refresh("/documentos/cambios");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function decideAnnulment(input: {
  annulmentId: string;
  decision: "aprobada" | "rechazada";
  reason: string;
  password: string;
}): Promise<DocResult> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "decide_annulment", {
      p_annulment: uuid.parse(input.annulmentId),
      p_decision: input.decision,
      p_reason: reason.parse(input.reason),
      p_password: password.parse(input.password),
    })) as Record<string, unknown>;
    if (res.ok !== true) return soft(res);
    refresh("/documentos/cambios");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function closeAnnulment(input: {
  annulmentId: string;
  reason: string;
}): Promise<DocResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "close_annulment", {
      p_annulment: uuid.parse(input.annulmentId),
      p_reason: reason.parse(input.reason),
    });
    refresh("/documentos/cambios");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Capacitación
// ---------------------------------------------------------------------------
export type QuizQuestion = { q: string; options: string[]; answer: number };

export async function assignTraining(input: {
  versionId: string;
  users: string[];
  dueDate: string;
  questions: QuizQuestion[];
}): Promise<DocResult> {
  try {
    const p = z
      .object({
        versionId: uuid,
        users: z.array(uuid).min(1, "Asigne al menos una persona"),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indique la fecha límite"),
        questions: z
          .array(
            z.object({
              q: z.string().trim().min(1),
              options: z.array(z.string().trim().min(1)).min(2),
              answer: z.number().int().min(0),
            }),
          )
          .max(50),
      })
      .parse(input);
    const supabase = await createClient();
    await callRpc(supabase, "assign_training", {
      p_version: p.versionId,
      p_users: p.users,
      p_due_date: p.dueDate,
      p_questions: p.questions,
    });
    refresh("/documentos/capacitacion");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function submitQuiz(input: {
  trainingId: string;
  answers: number[];
}): Promise<DocResult<{ score: number; certificateCode: string }> & { score?: number }> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "register_training_attempt", {
      p_training: uuid.parse(input.trainingId),
      p_answers: z.array(z.number().int()).parse(input.answers),
    })) as Record<string, unknown>;
    refresh("/documentos/capacitacion");
    if (res.ok !== true) return { ...soft(res), score: Number(res.score) };
    return { ok: true, score: Number(res.score), certificateCode: String(res.certificate_code) };
  } catch (e) {
    return fail(e);
  }
}

export async function acknowledgeRead(input: {
  trainingId: string;
}): Promise<DocResult<{ certificateCode: string }>> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "acknowledge_read", {
      p_training: uuid.parse(input.trainingId),
    })) as { certificate_code: string };
    refresh("/documentos/capacitacion");
    return { ok: true, certificateCode: res.certificate_code };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Edición maestra de plantillas (RF-05)
// ---------------------------------------------------------------------------
export type TemplateStepInput = {
  label: string;
  text: string;
  params: {
    name: string;
    unit: string;
    min: number | null;
    max: number | null;
    frequency: string;
  }[];
  requires_equipment: string;
  requires_verification: boolean;
  checklist_item: boolean;
};

export async function saveTemplateDraft(input: {
  stageCode: string;
  versionId?: string | null;
  steps: TemplateStepInput[];
  reason: string;
}): Promise<DocResult<{ versionId: string; versionNo: number }>> {
  try {
    const p = z
      .object({
        stageCode: z.string().regex(/^[a-z_]{3,40}$/),
        versionId: uuid.nullish(),
        steps: z
          .array(
            z.object({
              label: z.string().trim().max(10),
              text: z.string().trim().min(1, "Cada paso necesita texto").max(500),
              params: z.array(
                z.object({
                  name: z.string().max(80),
                  unit: z.string().max(20),
                  min: z.number().nullable(),
                  max: z.number().nullable(),
                  frequency: z.string().max(40),
                }),
              ),
              requires_equipment: z.string().max(80),
              requires_verification: z.boolean(),
              checklist_item: z.boolean(),
            }),
          )
          .min(1, "La plantilla necesita al menos un paso"),
        reason,
      })
      .parse(input);
    const supabase = await createClient();
    const res = (await callRpc(supabase, "save_template_draft", {
      p_stage_code: p.stageCode,
      p_version: p.versionId ?? (null as unknown as string),
      p_steps: p.steps,
      p_reason: p.reason,
    })) as { version_id: string; version_no: number };
    revalidatePath("/master/plantillas");
    return { ok: true, versionId: res.version_id, versionNo: res.version_no };
  } catch (e) {
    return fail(e);
  }
}
