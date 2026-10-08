import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/db/server";
import { callRpc } from "@/lib/rpc";
import { hasAnyRole, type AppRole } from "./roles";

// Capa de acceso a la sesión (una sola lectura por solicitud gracias a cache()).
// Con Cache Components, quien la use debe estar dentro de un <Suspense>.

export type SessionContext = {
  userId: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  shortSignature: string | null;
  roles: AppRole[];
  sessionIdleMinutes: number;
  reauthMethod: string;
  area: string | null;
  accessExpiredAt: string | null;
  mustChangePassword: boolean;
  passwordExpired: boolean;
};

export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  // La sesión es un dato de la solicitud: nunca forma parte del prerender (Supabase Auth usa la hora).
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const ctx = (await callRpc(supabase, "get_my_context")) as Record<string, unknown> | null;
  if (!ctx || ctx.active === false) return null;

  return {
    userId: String(ctx.user_id),
    fullName: String(ctx.full_name),
    email: String(ctx.email),
    jobTitle: (ctx.job_title as string | null) ?? null,
    shortSignature: (ctx.short_signature as string | null) ?? null,
    roles: (ctx.roles as AppRole[]) ?? [],
    sessionIdleMinutes: Number(ctx.session_idle_minutes ?? 15),
    reauthMethod: String(ctx.reauth_method ?? "password"),
    area: (ctx.area as string | null) ?? null,
    accessExpiredAt: (ctx.access_expired_at as string | null) ?? null,
    mustChangePassword: ctx.must_change_password === true,
    passwordExpired: ctx.password_expired === true,
  };
});

/**
 * Exige sesión con al menos un rol activo; si no, envía al inicio de sesión. Si la contraseña debe
 * cambiarse (invitación, restablecimiento o caducidad), envía primero a /cuenta/contrasena.
 */
export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx || ctx.roles.length === 0) redirect("/login");
  if (ctx.mustChangePassword || ctx.passwordExpired) redirect("/cuenta/contrasena");
  return ctx;
}

/** Guarda de rol en servidor: devuelve si el usuario tiene alguno de los roles pedidos. */
export async function checkRoles(wanted: readonly AppRole[]) {
  const ctx = await requireSession();
  return { ctx, allowed: hasAnyRole(ctx.roles, wanted) };
}
