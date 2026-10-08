import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_IDLE_MINUTES,
  IDLE_MINUTES_COOKIE,
  isPublicPath,
  LAST_ACTIVITY_COOKIE,
} from "@/lib/auth/constants";
import type { Database } from "@/lib/db/database.types";
import { getPublicSupabaseEnv } from "@/lib/db/env";

// Proxy (antes «middleware» en Next.js 15): refresca la sesión de Supabase, protege las rutas
// privadas y cierra la sesión por inactividad (RF-01). La autorización por rol se hace además
// en el servidor (lib/auth/session.ts) y en la base (RLS y RPC).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getPublicSupabaseEnv();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const target = NextResponse.redirect(new URL(path, request.url));
    for (const cookie of response.cookies.getAll()) target.cookies.set(cookie);
    return target;
  };

  if (!signedIn) {
    if (isPublicPath(pathname)) return response;
    const next = encodeURIComponent(pathname + search);
    return redirectTo(`/login?next=${next}`);
  }

  if (pathname === "/login") return redirectTo("/inicio");
  if (isPublicPath(pathname)) return response;

  // Inactividad: la última actividad la actualizan el cliente (eventos de usuario) y cada navegación.
  const idleMinutes =
    Number(request.cookies.get(IDLE_MINUTES_COOKIE)?.value) || DEFAULT_IDLE_MINUTES;
  const last = Number(request.cookies.get(LAST_ACTIVITY_COOKIE)?.value);
  const now = Date.now();
  if (last && now - last > idleMinutes * 60_000) {
    await supabase.rpc("log_session_event", { p_action: "session_expired" });
    await supabase.auth.signOut();
    response.cookies.delete(LAST_ACTIVITY_COOKIE);
    return redirectTo("/login?motivo=inactividad");
  }

  response.cookies.set(LAST_ACTIVITY_COOKIE, String(now), { path: "/", sameSite: "lax" });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
