"use server";

import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { ERROR_MESSAGES, toAppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { callRpc } from "@/lib/rpc";
import { ROLE_LABELS, type AppRole } from "@/lib/auth/roles";
import type { SignatureMeaning } from "./meanings";

// Acciones de servidor de los componentes GxP. Toda regla vive en la base (sign_record, check_sod,
// record_correction); aquí solo se valida la forma de la entrada y se traduce la respuesta.

const meaning = z.enum(["ejecuto", "verifico", "reviso", "aprobo", "libero", "actualizo"]);
const recordRef = z.object({ table: z.string().min(1).max(63), id: z.uuid() });

export type ActionError = {
  ok: false;
  code: string;
  rule: string;
  action: string;
  detail?: string;
};

function fail(error: unknown): ActionError {
  const e = toAppError(error);
  return { ok: false, code: e.code, rule: e.rule, action: e.action, detail: e.details };
}

export async function getServerTime(): Promise<string | null> {
  const supabase = await createClient();
  try {
    return (await callRpc(supabase, "server_now")) as string;
  } catch {
    return null;
  }
}

export type Signer = { fullName: string; roleLabel: string } | null;

export async function getSigner(): Promise<Signer> {
  const supabase = await createClient();
  try {
    const ctx = (await callRpc(supabase, "get_my_context")) as {
      full_name?: string;
      job_title?: string | null;
      roles?: AppRole[];
    } | null;
    if (!ctx?.full_name) return null;
    return {
      fullName: ctx.full_name,
      roleLabel: ctx.job_title ?? (ctx.roles ?? []).map((r) => ROLE_LABELS[r]).join(" · "),
    };
  } catch {
    return null;
  }
}

export type CanSignResult = { allowed: true } | { allowed: false; code: string; message: string };

export async function canSign(input: {
  table: string;
  id: string;
  meaning: SignatureMeaning;
}): Promise<CanSignResult> {
  const parsed = recordRef.extend({ meaning }).safeParse(input);
  if (!parsed.success)
    return { allowed: false, code: "RECORD_NOT_FOUND", message: "Registro no válido" };
  const supabase = await createClient();
  const res = (await callRpc(supabase, "can_sign", {
    p_table: parsed.data.table,
    p_record_id: parsed.data.id,
    p_meaning: parsed.data.meaning,
  })) as CanSignResult;
  return res;
}

export type SignResult =
  | {
      ok: true;
      signatureId: string;
      signedAt: string;
      shortSignature: string;
      signerName: string;
      recordHash: string;
    }
  | (ActionError & { remaining?: number; lockedUntil?: string });

export async function signRecord(input: {
  table: string;
  id: string;
  meaning: SignatureMeaning;
  password: string;
  reason?: string;
}): Promise<SignResult> {
  const parsed = recordRef
    .extend({
      meaning,
      password: z.string().min(1).max(200),
      reason: z.string().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "REAUTH_FAILED", ...ERROR_MESSAGES.REAUTH_FAILED };
  }
  const supabase = await createClient();
  try {
    const res = (await callRpc(supabase, "sign_record", {
      p_table: parsed.data.table,
      p_record_id: parsed.data.id,
      p_meaning: parsed.data.meaning,
      p_password: parsed.data.password,
      p_reason: parsed.data.reason,
    })) as Record<string, unknown>;

    if (res.ok !== true) {
      const code = String(res.code) as keyof typeof ERROR_MESSAGES;
      log.warn("gxp.sign_rejected", { code, table: parsed.data.table });
      return {
        ok: false,
        code,
        ...(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.REAUTH_FAILED),
        remaining: typeof res.remaining === "number" ? res.remaining : undefined,
        lockedUntil: typeof res.locked_until === "string" ? res.locked_until : undefined,
      };
    }
    log.info("gxp.signed", { table: parsed.data.table, meaning: parsed.data.meaning });
    return {
      ok: true,
      signatureId: String(res.signature_id),
      signedAt: String(res.signed_at),
      shortSignature: String(res.short_signature),
      signerName: String(res.signer_name),
      recordHash: String(res.record_hash),
    };
  } catch (error) {
    return fail(error);
  }
}

export type CorrectionResult =
  | {
      ok: true;
      count: number;
      threshold: number;
      warning: boolean;
      oldValue: unknown;
      newValue: unknown;
    }
  | ActionError;

export async function recordCorrection(input: {
  table: string;
  id: string;
  field: string;
  newValue: string;
  reason: string;
}): Promise<CorrectionResult> {
  const parsed = recordRef
    .extend({
      field: z.string().min(1).max(63),
      newValue: z.string().max(2000),
      reason: z.string().max(1000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_FIELD", ...ERROR_MESSAGES.INVALID_FIELD };
  const supabase = await createClient();
  try {
    const res = (await callRpc(supabase, "record_correction", {
      p_table: parsed.data.table,
      p_record_id: parsed.data.id,
      p_field: parsed.data.field,
      p_new_value: parsed.data.newValue,
      p_reason: parsed.data.reason,
    })) as Record<string, unknown>;
    return {
      ok: true,
      count: Number(res.count),
      threshold: Number(res.threshold),
      warning: res.warning === true,
      oldValue: res.old_value,
      newValue: res.new_value,
    };
  } catch (error) {
    return fail(error);
  }
}

export type AuditEntry = {
  id: number;
  at: string;
  actorName: string | null;
  actorShortSignature: string | null;
  action: string;
  tableName: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
};

export async function getAuditTrail(input: {
  table: string;
  id: string;
}): Promise<AuditEntry[] | ActionError> {
  const parsed = recordRef.safeParse(input);
  if (!parsed.success)
    return { ok: false, code: "RECORD_NOT_FOUND", ...ERROR_MESSAGES.RECORD_NOT_FOUND };
  const supabase = await createClient();
  try {
    const rows = (await callRpc(supabase, "get_audit_trail", {
      p_table: parsed.data.table,
      p_record_id: parsed.data.id,
    })) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: Number(r.id),
      at: String(r.at),
      actorName: (r.actor_name as string | null) ?? null,
      actorShortSignature: (r.actor_short_signature as string | null) ?? null,
      action: String(r.action),
      tableName: String(r.table_name),
      before: (r.before as Record<string, unknown> | null) ?? null,
      after: (r.after as Record<string, unknown> | null) ?? null,
      reason: (r.reason as string | null) ?? null,
    }));
  } catch (error) {
    return fail(error);
  }
}
