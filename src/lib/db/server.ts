import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./database.types";
import { getPublicSupabaseEnv } from "./env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Usa la sesión del usuario (cookies) y la clave pública: toda lectura pasa por RLS.
 * Se crea uno nuevo por solicitud.
 */
export async function createClient() {
  // Toda lectura con la sesión es de tiempo de solicitud (nunca entra al prerender).
  await connection();
  const { url, key } = getPublicSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Llamado desde un Server Component: las cookies se refrescan en el proxy (E1).
        }
      },
    },
  });
}
