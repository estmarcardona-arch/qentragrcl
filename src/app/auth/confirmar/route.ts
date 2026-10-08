import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { log } from "@/lib/log";

// Enlaces de un solo uso de invitación y de restablecimiento (los genera Administración).
// Verifica el token, abre la sesión y lleva a crear la contraseña. Un enlace usado o vencido no sirve.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const fail = NextResponse.redirect(new URL("/login?motivo=enlace", request.url));

  if (!tokenHash || (type !== "invite" && type !== "recovery")) return fail;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    log.warn("auth.link_invalid", { type, code: error.code ?? error.message });
    return fail;
  }
  log.info("auth.link_used", { type });
  return NextResponse.redirect(
    new URL(
      `/cuenta/contrasena?origen=${type === "invite" ? "invitacion" : "recuperacion"}`,
      request.url,
    ),
  );
}
