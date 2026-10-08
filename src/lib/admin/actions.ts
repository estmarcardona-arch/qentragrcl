"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AppRole } from "@/lib/auth/roles";
import { checkRoles } from "@/lib/auth/session";
import { ADMIN_KEY_ENV, getAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { ERROR_MESSAGES, toAppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { callRpc } from "@/lib/rpc";

// Acciones de Administración (S-03, S-04). Cada una verifica que el usuario es administrador; la base
// lo vuelve a validar en cada RPC (rol, motivo, combinaciones prohibidas, vencimiento de auditor).

export type AdminResult<T = object> =
  ({ ok: true } & T) | { ok: false; code: string; rule: string; action: string; detail?: string };

function fail(error: unknown): AdminResult<never> {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      code: "INVALID_FIELD",
      ...ERROR_MESSAGES.INVALID_FIELD,
      detail: error.issues[0]?.message,
    };
  }
  const e = toAppError(error);
  return { ok: false, code: e.code, rule: e.rule, action: e.action, detail: e.details };
}

async function requireAdmin() {
  const { allowed } = await checkRoles(["admin"]);
  if (!allowed) throw new Error("FORBIDDEN_ROLE: solo el administrador del sistema");
}

const ROLES = [
  "comercial",
  "idi",
  "bodega_aux",
  "bodega_jefe",
  "prod_aux",
  "prod_coord",
  "lab_aux",
  "cc_jefe",
  "aq_dir",
  "dt",
  "admin",
  "master",
  "aq_doc",
  "gerencia",
  "auditor",
] as const satisfies readonly AppRole[];

const reason = z.string().trim().min(1, "El motivo es obligatorio").max(500);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Fin del día en Bogotá (UTC−5) para una fecha AAAA-MM-DD. */
function endOfDayBogota(date: string): string {
  return `${date}T23:59:59-05:00`;
}

async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3020";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function confirmLink(origin: string, hashedToken: string, type: "invite" | "recovery") {
  return `${origin}/auth/confirmar?token_hash=${encodeURIComponent(hashedToken)}&type=${type}`;
}

// ---------------------------------------------------------------------------
// Alta por invitación (enlace de un solo uso)
// ---------------------------------------------------------------------------
const inviteSchema = z.object({
  email: z.email().max(254),
  fullName: z.string().trim().min(3).max(120),
  jobTitle: z.string().trim().max(120).optional(),
  areaId: z.uuid().optional(),
  roles: z
    .array(z.object({ role: z.enum(ROLES), expiresOn: isoDate.optional() }))
    .min(1, "Asigne al menos un rol"),
});

export async function inviteUser(
  input: z.input<typeof inviteSchema>,
): Promise<AdminResult<{ userId: string; link: string; email: string }>> {
  try {
    await requireAdmin();
    const data = inviteSchema.parse(input);
    if (data.roles.some((r) => r.role === "auditor" && !r.expiresOn)) {
      return {
        ok: false,
        code: "INVALID_FIELD",
        ...ERROR_MESSAGES.INVALID_FIELD,
        detail: "El auditor exige fecha de vencimiento",
      };
    }
    const supabase = await createClient();

    // Combinaciones prohibidas antes de crear el usuario.
    const { data: rules } = await supabase
      .from("role_incompatibilities")
      .select("role_a, role_b, rule_code, message");
    const chosen = new Set(data.roles.map((r) => r.role));
    const conflict = (rules ?? []).find((r) => chosen.has(r.role_a) && chosen.has(r.role_b));
    if (conflict) {
      return {
        ok: false,
        code: "ROLE_INCOMPATIBLE",
        ...ERROR_MESSAGES.ROLE_INCOMPATIBLE,
        detail: `${conflict.rule_code}: ${conflict.message}`,
      };
    }

    const admin = getAdminClient();
    if (!admin) {
      return {
        ok: false,
        code: "CONFIG_MISSING",
        ...ERROR_MESSAGES.CONFIG_MISSING,
        detail: ADMIN_KEY_ENV,
      };
    }
    const { data: link, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email: data.email.toLowerCase(),
      options: { data: { full_name: data.fullName, job_title: data.jobTitle ?? null } },
    });
    if (error || !link.user) {
      log.warn("admin.invite_failed", { code: error?.code ?? "sin_usuario" });
      return {
        ok: false,
        code: "INVALID_FIELD",
        ...ERROR_MESSAGES.INVALID_FIELD,
        detail: error?.message ?? "No se pudo crear la invitación",
      };
    }
    const userId = link.user.id;
    const why = "Alta de usuario por invitación";
    await callRpc(supabase, "admin_update_profile", {
      p_user: userId,
      p_full_name: data.fullName,
      p_job_title: data.jobTitle ?? "",
      p_area_id: (data.areaId ?? null) as string,
      p_document_id: "",
      p_must_change_password: true,
      p_reason: why,
    });
    for (const r of data.roles) {
      await callRpc(supabase, "admin_grant_role", {
        p_user: userId,
        p_role: r.role,
        p_expires_at: (r.expiresOn ? endOfDayBogota(r.expiresOn) : null) as string,
        p_reason: why,
      });
    }
    log.info("admin.user_invited", { roles: data.roles.length });
    revalidatePath("/admin/usuarios");
    return {
      ok: true,
      userId,
      email: data.email.toLowerCase(),
      link: confirmLink(await appOrigin(), link.properties.hashed_token, "invite"),
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Datos, estado, roles y firma corta
// ---------------------------------------------------------------------------
export async function updateProfile(input: {
  userId: string;
  fullName: string;
  jobTitle: string;
  areaId: string | null;
  documentId: string;
  reason: string;
}): Promise<AdminResult> {
  try {
    await requireAdmin();
    const r = reason.parse(input.reason);
    const supabase = await createClient();
    await callRpc(supabase, "admin_update_profile", {
      p_user: z.uuid().parse(input.userId),
      p_full_name: input.fullName,
      p_job_title: input.jobTitle,
      p_area_id: (input.areaId || null) as string,
      p_document_id: input.documentId,
      p_must_change_password: null as unknown as boolean,
      p_reason: r,
    });
    revalidatePath(`/admin/usuarios/${input.userId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setUserActive(input: {
  userId: string;
  active: boolean;
  reason: string;
}): Promise<AdminResult> {
  try {
    await requireAdmin();
    const r = reason.parse(input.reason);
    const userId = z.uuid().parse(input.userId);
    const supabase = await createClient();
    await callRpc(supabase, "admin_set_user_active", {
      p_user: userId,
      p_active: input.active,
      p_reason: r,
    });
    // También en Supabase Auth: el usuario desactivado no puede renovar su sesión.
    const admin = getAdminClient();
    if (admin) {
      await admin.auth.admin.updateUserById(userId, {
        ban_duration: input.active ? "none" : "876000h",
      });
    }
    log.info("admin.user_active_changed", { active: input.active });
    revalidatePath("/admin/usuarios");
    revalidatePath(`/admin/usuarios/${userId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function grantRole(input: {
  userId: string;
  role: AppRole;
  expiresOn?: string;
  reason: string;
}): Promise<AdminResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    await callRpc(supabase, "admin_grant_role", {
      p_user: z.uuid().parse(input.userId),
      p_role: z.enum(ROLES).parse(input.role),
      p_expires_at: (input.expiresOn
        ? endOfDayBogota(isoDate.parse(input.expiresOn))
        : null) as string,
      p_reason: reason.parse(input.reason),
    });
    revalidatePath(`/admin/usuarios/${input.userId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setRoleExpiry(input: {
  userId: string;
  userRoleId: string;
  expiresOn?: string;
  reason: string;
}): Promise<AdminResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    await callRpc(supabase, "admin_set_role_expiry", {
      p_user_role: z.uuid().parse(input.userRoleId),
      p_expires_at: (input.expiresOn
        ? endOfDayBogota(isoDate.parse(input.expiresOn))
        : null) as string,
      p_reason: reason.parse(input.reason),
    });
    revalidatePath(`/admin/usuarios/${input.userId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeRole(input: {
  userId: string;
  userRoleId: string;
  reason: string;
}): Promise<AdminResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    await callRpc(supabase, "admin_revoke_role", {
      p_user_role: z.uuid().parse(input.userRoleId),
      p_reason: reason.parse(input.reason),
    });
    revalidatePath(`/admin/usuarios/${input.userId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setShortSignature(input: {
  userId: string;
  shortSignature: string;
  reason: string;
}): Promise<AdminResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    await callRpc(supabase, "admin_set_short_signature", {
      p_user: z.uuid().parse(input.userId),
      p_short: z.string().trim().min(2).max(40).parse(input.shortSignature),
      p_reason: reason.parse(input.reason),
    });
    revalidatePath(`/admin/usuarios/${input.userId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Enlace de restablecimiento de contraseña de un solo uso (D-34: lo genera Administración). */
export async function createRecoveryLink(input: {
  userId: string;
  email: string;
}): Promise<AdminResult<{ link: string }>> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) {
      return {
        ok: false,
        code: "CONFIG_MISSING",
        ...ERROR_MESSAGES.CONFIG_MISSING,
        detail: ADMIN_KEY_ENV,
      };
    }
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: z.email().parse(input.email),
    });
    if (error) throw new Error(`INVALID_FIELD: ${error.message}`);
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, job_title, area_id, document_id")
      .eq("id", z.uuid().parse(input.userId))
      .single();
    if (profile) {
      await callRpc(supabase, "admin_update_profile", {
        p_user: input.userId,
        p_full_name: profile.full_name,
        p_job_title: profile.job_title ?? "",
        p_area_id: profile.area_id as string,
        p_document_id: profile.document_id ?? "",
        p_must_change_password: true,
        p_reason: "Restablecimiento de contraseña solicitado a Administración",
      });
    }
    log.info("admin.recovery_link", {});
    return {
      ok: true,
      link: confirmLink(await appOrigin(), data.properties.hashed_token, "recovery"),
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Catálogos y configuración (S-04)
// ---------------------------------------------------------------------------
export async function saveCatalog(input: {
  table: string;
  id: string | null;
  values: Record<string, unknown>;
  reason: string;
}): Promise<AdminResult<{ id: string }>> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const id = (await callRpc(supabase, "admin_save_catalog", {
      p_table: input.table,
      p_id: input.id as string,
      p_values: input.values as never,
      p_reason: input.reason,
    })) as string;
    revalidatePath("/admin/catalogos");
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateSetting(input: {
  key: string;
  value: unknown;
  reason: string;
}): Promise<AdminResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    await callRpc(supabase, "admin_update_setting", {
      p_key: input.key,
      p_value: input.value as never,
      p_reason: reason.parse(input.reason),
    });
    revalidatePath("/admin/catalogos");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
