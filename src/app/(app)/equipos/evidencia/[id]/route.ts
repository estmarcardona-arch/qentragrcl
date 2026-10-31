import { connection } from "next/server";
import { createClient } from "@/lib/db/server";
import { log } from "@/lib/log";

// GET /equipos/evidencia/[id] · Abre un adjunto de la hoja de vida (RF-50, D-61, D-64): el archivo con un enlace temporal
// de 5 minutos o el enlace del proveedor. RLS y la política de Storage exigen permiso de lectura de Equipos.
export async function GET(_request: Request, ctx: RouteContext<"/equipos/evidencia/[id]">) {
  await connection();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Adjunto no válido", { status: 400 });
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("equipment_attachments")
    .select("path, url")
    .eq("id", id)
    .maybeSingle();
  if (!a) return new Response("Adjunto no encontrado o sin acceso", { status: 404 });
  if (a.url) return Response.redirect(a.url, 302);
  const { data, error } = await supabase.storage
    .from("evidencias")
    .createSignedUrl(String(a.path), 300);
  if (error || !data) {
    log.warn("equipment.evidence_unavailable", { detail: error?.message });
    return new Response("El archivo no está disponible", { status: 404 });
  }
  return Response.redirect(data.signedUrl, 302);
}
