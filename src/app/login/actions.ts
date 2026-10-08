"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  DEFAULT_IDLE_MINUTES,
  IDLE_MINUTES_COOKIE,
  LAST_ACTIVITY_COOKIE,
  safeNextPath,
} from "@/lib/auth/constants";
import { createClient } from "@/lib/db/server";
import { log } from "@/lib/log";
import { callRpc } from "@/lib/rpc";

export type LoginState = {
  error?: "credentials" | "no_access" | "expired" | "invalid";
  email?: string;
  /** Fecha de vencimiento del acceso (auditor vencido, AC-11). */
  expiredAt?: string;
};

const schema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});

/**
 * Inicio de sesión (S-01, RF-01). El mensaje de error es único: no revela si el correo existe
 * ni si la cuenta está bloqueada (el bloqueo lo aplica el hook de Supabase Auth, migración 0007).
 */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password: String(formData.get("password") ?? ""),
    next: String(formData.get("next") ?? "") || undefined,
  });
  if (!parsed.success) {
    return { error: "invalid", email: String(formData.get("email") ?? "") };
  }
  const { email, password, next } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    log.warn("auth.login_failed", { code: error.code ?? error.message });
    return { error: "credentials", email };
  }

  // Sin rol activo (p. ej. auditor vencido): no entra.
  const ctx = (await callRpc(supabase, "get_my_context")) as {
    roles?: string[];
    active?: boolean;
    session_idle_minutes?: number;
    access_expired_at?: string | null;
    must_change_password?: boolean;
    password_expired?: boolean;
  } | null;
  if (!ctx || ctx.active === false || !ctx.roles?.length) {
    await supabase.auth.signOut();
    log.warn("auth.login_no_access", { expired: Boolean(ctx?.access_expired_at) });
    // AC-11: auditor (u otro rol) vencido. Solo se informa tras una contraseña correcta.
    if (ctx?.active !== false && ctx?.access_expired_at) {
      return { error: "expired", email, expiredAt: ctx.access_expired_at };
    }
    return { error: "no_access", email };
  }

  await callRpc(supabase, "log_session_event", { p_action: "login" });
  const store = await cookies();
  store.set(IDLE_MINUTES_COOKIE, String(ctx.session_idle_minutes ?? DEFAULT_IDLE_MINUTES), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  store.set(LAST_ACTIVITY_COOKIE, String(Date.now()), { path: "/", sameSite: "lax" });
  log.info("auth.login", {});
  if (ctx.must_change_password || ctx.password_expired) redirect("/cuenta/contrasena");
  redirect(safeNextPath(next));
}

/** Cierre de sesión voluntario o por inactividad (queda en la bitácora). */
export async function signOut(reason: "salida" | "inactividad" = "salida") {
  const supabase = await createClient();
  await supabase
    .rpc("log_session_event", { p_action: reason === "inactividad" ? "session_expired" : "logout" })
    .then(undefined, () => undefined);
  await supabase.auth.signOut();
  const store = await cookies();
  store.delete(LAST_ACTIVITY_COOKIE);
  redirect(`/login?motivo=${reason}`);
}
