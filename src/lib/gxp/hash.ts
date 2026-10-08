// Huella de registros (PRD DI-7) del lado de la aplicación, idéntica a public.record_hash():
// SHA-256 (hex) del texto canónico de jsonb sin los campos que cambian al firmar.
//
// Postgres imprime jsonb con las claves ordenadas por longitud y luego por bytes, «": "» entre
// clave y valor y «", "» entre elementos. Nota: un numeric con ceros finales (60.00) llega a JS como
// 60 y su huella diferiría; la verificación oficial es verify_signature_integrity() en la base.

export const VOLATILE_FIELDS = ["status", "locked_at", "updated_at", "updated_by"] as const;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function compareKeys(a: string, b: string): number {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return ab.length - bb.length;
  for (let i = 0; i < ab.length; i++) if (ab[i] !== bb[i]) return ab[i] - bb[i];
  return 0;
}

/** Texto canónico igual a `jsonb::text` de Postgres. */
export function canonicalJsonb(value: Json): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJsonb).join(", ")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort(compareKeys);
    return `{${keys.map((k) => `${JSON.stringify(k)}: ${canonicalJsonb(value[k])}`).join(", ")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Huella de un registro tal como la calcula sign_record(). */
export async function recordHash(row: Record<string, Json>): Promise<string> {
  const content = Object.fromEntries(
    Object.entries(row).filter(([k]) => !(VOLATILE_FIELDS as readonly string[]).includes(k)),
  ) as Record<string, Json>;
  return sha256Hex(canonicalJsonb(content));
}
