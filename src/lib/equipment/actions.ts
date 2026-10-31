"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { ERROR_MESSAGES, toAppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { callRpc } from "@/lib/rpc";
import { EVIDENCE_MAX_BYTES, EVIDENCE_TYPES } from "./labels";

// Acciones de Equipos y hoja de vida (S-25, RF-50) y de los avisos (RF-51). Las reglas viven en las RPC.

export type EqResult<T = object> =
  | ({ ok: true } & T)
  | {
      ok: false;
      code: string;
      rule: string;
      action: string;
      detail?: string;
      remaining?: number;
    };

function fail(error: unknown): EqResult<never> {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      code: "INVALID_FIELD",
      ...ERROR_MESSAGES.INVALID_FIELD,
      detail: error.issues[0]?.message,
    };
  }
  const e = toAppError(error);
  log.warn("equipment.action_failed", { code: e.code, detail: e.details });
  return { ok: false, code: e.code, rule: e.rule, action: e.action, detail: e.details };
}

function soft(res: Record<string, unknown>): EqResult<never> {
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

function refresh(code?: string) {
  revalidatePath("/equipos");
  if (code) revalidatePath(`/equipos/${code}`);
}

// ---------------------------------------------------------------------------
// Ficha del equipo
// ---------------------------------------------------------------------------
export type EquipmentInput = {
  code: string;
  name: string;
  equipment_type: string;
  plant_area: string;
  critical: boolean;
  governing_document_id: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  capacity: string;
  installed_on: string;
  requires_calibration: boolean;
  requires_qualification: boolean;
  requires_cleaning: boolean;
  active: boolean;
};

export async function saveEquipment(input: {
  id: string | null;
  data: EquipmentInput;
  reason?: string;
}): Promise<EqResult<{ id: string; code: string }>> {
  try {
    const supabase = await createClient();
    const id = await callRpc(supabase, "save_equipment", {
      p_id: input.id ? uuid.parse(input.id) : NULL,
      p_data: input.data,
      p_reason: input.reason ?? NULL,
    });
    const code = input.data.code.trim().toUpperCase();
    log.info("equipment.saved", { created: !input.id });
    refresh(code);
    return { ok: true, id: String(id), code };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Hoja de vida: eventos con firma y certificados con huella (AC-44)
// ---------------------------------------------------------------------------
export type EventInput = {
  equipmentId: string;
  code: string;
  type: string;
  performed_on: string;
  result: string;
  due_on: string;
  valid_until: string;
  provider: string;
  reference: string;
  notes: string;
  batch_ref: string;
  /** Archivos ya subidos por el navegador al bucket «evidencias» con la sesión del usuario. */
  files: { path: string; file_name: string }[];
  /** Enlaces del proveedor para verificar el certificado o informe (D-64). */
  links: { url: string; label: string }[];
};

/**
 * La huella SHA-256, el tamaño y el tipo se calculan aquí, en el servidor, sobre el archivo guardado: no se confía
 * en lo que declara el navegador.
 */
export async function recordEquipmentEvent(
  input: EventInput,
  pw: string,
): Promise<EqResult<{ valid: boolean }>> {
  try {
    const supabase = await createClient();
    const attachments = [];
    for (const f of input.files) {
      if (!f.path.startsWith(`equipos/${input.code}/`)) throw new Error("INVALID_FIELD: ruta");
      const { data: blob, error } = await supabase.storage.from("evidencias").download(f.path);
      if (error || !blob) {
        throw new Error(`INVALID_FIELD: no se pudo leer el archivo ${f.file_name}`);
      }
      if (blob.size > EVIDENCE_MAX_BYTES || !EVIDENCE_TYPES.includes(blob.type)) {
        throw new Error(`INVALID_FIELD: ${f.file_name} debe ser PDF, PNG o JPG de hasta 10 MB`);
      }
      const sha256 = createHash("sha256")
        .update(Buffer.from(await blob.arrayBuffer()))
        .digest("hex");
      attachments.push({
        path: f.path,
        file_name: f.file_name,
        mime_type: blob.type,
        size_bytes: blob.size,
        sha256,
      });
    }
    const { equipmentId, code, files, links, ...data } = input;
    const validLinks = links
      .map((l) => ({ url: l.url.trim(), label: l.label.trim() }))
      .filter((l) => l.url);
    for (const l of validLinks) {
      if (!/^https?:\/\/\S+$/.test(l.url)) {
        throw new Error(`INVALID_FIELD: el enlace ${l.url} debe empezar por http:// o https://`);
      }
    }
    void files;
    const res = (await callRpc(supabase, "record_equipment_event", {
      p_equipment: uuid.parse(equipmentId),
      p_type: input.type,
      p_data: { ...data, attachments, links: validLinks },
      p_password: password.parse(pw),
    })) as Record<string, unknown>;
    if (res.ok !== true) return soft(res);
    log.info("equipment.event_recorded", { type: input.type, files: attachments.length });
    refresh(code);
    return { ok: true, valid: res.valid === true };
  } catch (e) {
    return fail(e);
  }
}

export async function verifyCleaning(input: {
  eventId: string;
  code: string;
  password: string;
}): Promise<EqResult> {
  try {
    const supabase = await createClient();
    const res = (await callRpc(supabase, "verify_cleaning", {
      p_event: uuid.parse(input.eventId),
      p_password: password.parse(input.password),
    })) as Record<string, unknown>;
    if (res.ok !== true) return soft(res);
    log.info("equipment.cleaning_verified");
    refresh(input.code);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setEquipmentStatus(input: {
  equipmentId: string;
  code: string;
  status: string;
  reason: string;
}): Promise<EqResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "set_equipment_status", {
      p_equipment: uuid.parse(input.equipmentId),
      p_status: input.status,
      p_reason: input.reason,
    });
    log.info("equipment.status_changed", { status: input.status });
    refresh(input.code);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Avisos internos (campana, RF-51)
// ---------------------------------------------------------------------------
export async function markNotificationsRead(ids?: string[]): Promise<EqResult> {
  try {
    const supabase = await createClient();
    await callRpc(supabase, "mark_notifications_read", {
      p_ids: ids ? ids.map((i) => uuid.parse(i)) : (null as unknown as string[]),
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
