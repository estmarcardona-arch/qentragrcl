import "server-only";

// Registro estructurado en servidor: una línea JSON por evento (la recoge el hosting).
// No registra secretos ni datos personales; los campos se filtran por nombre.

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const REDACTED = /pass(word)?|secret|token|key|authorization|cookie|db_url/i;

export function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (REDACTED.test(k)) out[k] = "[oculto]";
    else if (v instanceof Error) out[k] = { name: v.name, message: v.message };
    else if (v && typeof v === "object" && !Array.isArray(v)) out[k] = redact(v as Fields);
    else out[k] = v;
  }
  return out;
}

function write(level: Level, event: string, fields: Fields = {}) {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    level,
    event,
    ...redact(fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, fields?: Fields) => write("debug", event, fields),
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
