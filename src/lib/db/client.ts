"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "./env";

/** Cliente de Supabase para componentes cliente (sesión del usuario, RLS). */
export function createClient() {
  const { url, key } = getPublicSupabaseEnv();
  return createBrowserClient(url, key);
}
