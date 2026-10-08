import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getPublicSupabaseEnv } from "./env";

/**
 * Cliente con la clave service_role (AGENTS.md regla 5): SOLO en el servidor y solo para tareas
 * administrativas puntuales de Supabase Auth (enlace de invitación o recuperación y bloqueo de
 * usuarios desactivados). Quien lo use debe verificar antes que el usuario actual es administrador.
 * Los datos de negocio nunca se escriben con este cliente: pasan por RPC con el rol del usuario.
 */
/** Nombre de la variable de entorno (para los mensajes de configuración faltante). */
export const ADMIN_KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY";

export function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const { url } = getPublicSupabaseEnv();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
