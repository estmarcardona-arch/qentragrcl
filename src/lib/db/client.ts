"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getPublicSupabaseEnv } from "./env";

/** Cliente de Supabase para componentes cliente (sesión del usuario, RLS). */
export function createClient() {
  const { url, key } = getPublicSupabaseEnv();
  return createBrowserClient<Database>(url, key);
}
