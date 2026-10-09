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
  log.warn("admin.action_failed", { code: e.code, detail: e.details });
  return { ok: false, code: e.code, rule: e.rule, action: e.action, detail: e.details };
}

async function requireAdmin() {
  const { allowed } = await checkRoles(["admin"]);
  if (!allowed) throw new Error("FORBIDDEN_ROLE: solo el administrador del sistema");
}

/** Código de rol (del sistema o adicional); la base valida que exista y esté activo. */
const roleCode = z.string().regex(/^[a-z][a-z0-9_]{1,30}$/, "Código de rol no válido");

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
    .array(z.object({ role: roleCode, expiresOn: isoDate.optional() }))
    .min(1, "Asigne al menos un rol"),
});

export async function inviteUser(
  input: z.input<typeof inviteSchema>,
): Promise<AdminResult<{ userId: string; link: string; email: string }>> {
  try {
    await requireAdmin();
    const data = inviteSchema.parse(input);
    const supabase = await createClient();

    // Roles existentes, activos y con vencimiento cuando el rol lo exige (antes de crear el usuario).
    const { data: catalog } = await supabase
      .from("roles")
      .select("code, name, active, requires_expiry");
    for (const r of data.roles) {
      const info = catalog?.find((c) => c.code === r.role);
      if (!info || !info.active) {
        return { ok: false, code: "ROLE_RETIRED", ...ERROR_MESSAGES.ROLE_RETIRED, detail: r.role };
      }
      if (info.requires_expiry && !r.expiresOn) {
        return {
          ok: false,
          code: "INVALID_FIELD",
          ...ERROR_MESSAGES.INVALID_FIELD,
          detail: `El rol «${info.name}» exige fecha de vencimiento`,
        };
      }
    }

    // Combinaciones prohibidas antes de crear el usuario.
    const { data: rules } = await supabase
      .from("role_incompatibilities")
      .select("role_a, role_b, rule_code, message, active");
    const chosen = new Set<string>(data.roles.map((r) => r.role));
    const conflict = (rules ?? []).find(
      (r) => r.active && chosen.has(r.role_a) && chosen.has(r.role_b),
    );
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
      p_role: roleCode.parse(input.role),
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

// ---------------------------------------------------------------------------
// Roles configurables (PRD 2.6, RF-07): cada cambio es una solicitud que se aplica al aprobarse.
// Rol adicional: aprueba Aseguramiento de calidad (D-39). Permisos de un rol del sistema: doble
// aprobación, Aseguramiento de calidad y Dirección técnica (D-40). La base valida todo al solicitar.
// ---------------------------------------------------------------------------
const roleOptions = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80),
  description: z.string().trim().max(400).default(""),
  requiresExpiry: z.boolean().default(false),
  readOnly: z.boolean().default(false),
});

export type RoleChangeKind =
  "create" | "update" | "permissions" | "incompatibilities" | "retire" | "reactivate";

export type RequestResult = AdminResult<{ requestNumber: string; requiredRoles: string[] }>;

async function requestRoleChange(
  kind: RoleChangeKind,
  code: string,
  payload: Record<string, unknown>,
  why: string,
): Promise<RequestResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const res = (await callRpc(supabase, "admin_request_role_change", {
      p_kind: kind,
      p_role: code,
      p_payload: payload as never,
      p_reason: reason.parse(why),
    })) as { request_number: string; required_roles: string[] };
    log.info("admin.role_change_requested", { kind, code, request: res.request_number });
    revalidatePath("/admin/catalogos");
    revalidatePath(`/admin/roles/${code}`);
    revalidatePath("/cambios-roles");
    return { ok: true, requestNumber: res.request_number, requiredRoles: res.required_roles };
  } catch (e) {
    return fail(e);
  }
}

const newRoleCode = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z][a-z0-9_]{2,30}$/,
    "El código debe tener de 3 a 31 caracteres: minúsculas, números o «_»",
  );

export async function createRole(input: {
  code: string;
  name: string;
  description: string;
  requiresExpiry: boolean;
  readOnly: boolean;
  reason: string;
}): Promise<RequestResult> {
  const parsed = roleOptions.extend({ code: newRoleCode }).safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  const o = parsed.data;
  return requestRoleChange(
    "create",
    o.code,
    {
      name: o.name,
      description: o.description,
      requires_expiry: o.requiresExpiry,
      read_only: o.readOnly,
    },
    input.reason,
  );
}

export async function updateRole(input: {
  code: string;
  name: string;
  description: string;
  requiresExpiry: boolean;
  readOnly: boolean;
  reason: string;
}): Promise<RequestResult> {
  const parsed = roleOptions.extend({ code: roleCode }).safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  const o = parsed.data;
  return requestRoleChange(
    "update",
    o.code,
    {
      name: o.name,
      description: o.description,
      requires_expiry: o.requiresExpiry,
      read_only: o.readOnly,
    },
    input.reason,
  );
}

export type ModulePermission = {
  module: string;
  read: boolean;
  create: boolean;
  sign: boolean;
  approve: boolean;
};

const modulePermission = z.object({
  module: z.string().regex(/^[a-z0-9_]{1,63}$/),
  read: z.boolean(),
  create: z.boolean(),
  sign: z.boolean(),
  approve: z.boolean(),
});

/** Permisos por módulo: rol adicional (D-39) o rol del sistema con doble aprobación (D-40). */
export async function setRolePermissions(input: {
  code: string;
  permissions: ModulePermission[];
  reason: string;
}): Promise<RequestResult> {
  const parsed = z
    .object({ code: roleCode, permissions: z.array(modulePermission).min(1).max(19) })
    .safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  return requestRoleChange(
    "permissions",
    parsed.data.code,
    { permissions: parsed.data.permissions },
    input.reason,
  );
}

export async function setRoleIncompatibilities(input: {
  code: string;
  others: string[];
  reason: string;
}): Promise<RequestResult> {
  const parsed = z.object({ code: roleCode, others: z.array(roleCode).max(40) }).safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  return requestRoleChange(
    "incompatibilities",
    parsed.data.code,
    { others: parsed.data.others },
    input.reason,
  );
}

/** Retirar («eliminar») o reactivar un rol adicional. */
export async function setRoleActive(input: {
  code: string;
  active: boolean;
  reason: string;
}): Promise<RequestResult> {
  const code = roleCode.safeParse(input.code);
  if (!code.success) return fail(code.error);
  return requestRoleChange(input.active ? "reactivate" : "retire", code.data, {}, input.reason);
}

/** Quien solicitó anula su solicitud pendiente. */
export async function cancelRoleChange(input: {
  requestId: string;
  reason: string;
}): Promise<AdminResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    await callRpc(supabase, "admin_cancel_role_change", {
      p_request: z.uuid().parse(input.requestId),
      p_reason: reason.parse(input.reason),
    });
    revalidatePath("/admin/catalogos");
    revalidatePath("/cambios-roles");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export type DecisionResult =
  | {
      ok: true;
      status: "pendiente" | "aprobada" | "rechazada";
      approvals: number;
      required: number;
    }
  | (AdminResult<never> & { remaining?: number; lockedUntil?: string });

/**
 * Aprobar o rechazar una solicitud (Aseguramiento de calidad o Dirección técnica) con contraseña.
 * La base valida rol, segregación (quien solicita no aprueba; dos personas distintas) y la contraseña.
 */
export async function decideRoleChange(input: {
  requestId: string;
  decision: "aprobada" | "rechazada";
  reason: string;
  password: string;
}): Promise<DecisionResult> {
  try {
    const parsed = z
      .object({
        requestId: z.uuid(),
        decision: z.enum(["aprobada", "rechazada"]),
        reason,
        password: z.string().min(1, "Escriba su contraseña").max(200),
      })
      .parse(input);
    const supabase = await createClient();
    const res = (await callRpc(supabase, "decide_role_change", {
      p_request: parsed.requestId,
      p_decision: parsed.decision,
      p_reason: parsed.reason,
      p_password: parsed.password,
    })) as Record<string, unknown>;
    if (res.ok !== true) {
      const code = String(res.code) as keyof typeof ERROR_MESSAGES;
      log.warn("admin.role_change_reauth_failed", { code });
      return {
        ok: false,
        code,
        ...(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.REAUTH_FAILED),
        remaining: typeof res.remaining === "number" ? res.remaining : undefined,
        lockedUntil: typeof res.locked_until === "string" ? res.locked_until : undefined,
      };
    }
    log.info("admin.role_change_decided", { decision: parsed.decision, status: res.status });
    revalidatePath("/cambios-roles");
    revalidatePath("/admin/catalogos");
    return {
      ok: true,
      status: res.status as "pendiente" | "aprobada" | "rechazada",
      approvals: Number(res.approvals),
      required: Number(res.required),
    };
  } catch (e) {
    return fail(e);
  }
}
