import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/db/database.types";
import { getPublicSupabaseEnv } from "@/lib/db/env";
import { log } from "@/lib/log";

// Enlaces de un solo uso de invitación y de restablecimiento (los genera Administración).
// Verifica el token, abre la sesión y lleva a crear la contraseña. Un enlace usado o vencido no sirve.
// Las cookies de sesión se escriben directamente en la respuesta de redirección.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || (type !== "invite" && type !== "recovery")) {
    return NextResponse.redirect(new URL("/login?motivo=enlace", request.url));
  }

  const target = `/cuenta/contrasena?origen=${type === "invite" ? "invitacion" : "recuperacion"}`;
  const response = NextResponse.redirect(new URL(target, request.url));
  const { url: supabaseUrl, key } = getPublicSupabaseEnv();
  const supabase = createServerClient<Database>(supabaseUrl, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    log.warn("auth.link_invalid", { type, code: error.code ?? error.message });
    return NextResponse.redirect(new URL("/login?motivo=enlace", request.url));
  }
  log.info("auth.link_used", { type });
  return response;
}
