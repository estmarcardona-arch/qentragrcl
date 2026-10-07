// Variables públicas de Supabase: solo la URL y la clave pública (publishable/anon)
// llegan al navegador. Las claves privilegiadas no se usan aquí (AGENTS.md, regla 5).

export function getPublicSupabaseEnv() {
  // Acceso estático para que Next.js inserte los valores en el bundle del cliente.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copie .env.example a .env.local y complételo.",
    );
  }
  return { url, key };
}
