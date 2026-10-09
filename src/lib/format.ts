// Formatos es-CO (RNF-03). La hora se guarda en UTC y se muestra en America/Bogota.

export const TIME_ZONE = "America/Bogota";
export const LOCALE = "es-CO";

const dateParts = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parts(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Fecha inválida: ${String(value)}`);
  }
  const map: Record<string, string> = {};
  for (const p of dateParts.formatToParts(date)) map[p.type] = p.value;
  return map;
}

/** Número con punto de miles y coma decimal: 2.000,0 */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: "always",
  }).format(value);
}

/** Pesos colombianos: $135.131.500 · $1.951,05 (decimales solo si los hay). */
export function formatCOP(value: number): string {
  const decimals = Number.isInteger(value) ? 0 : 2;
  const sign = value < 0 ? "-" : "";
  return `${sign}$${formatNumber(Math.abs(value), decimals)}`;
}

/** Porcentaje con espacio antes del signo: 98,2 % */
export function formatPercent(value: number, decimals = 1): string {
  return `${formatNumber(value, decimals)} %`;
}

/** Una fecha sin hora (AAAA-MM-DD, columnas date) no se corre de día por la zona horaria. */
function dateOnly(value: Date | string): string[] | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? [m[1], m[2], m[3]] : null;
}

/** Fecha de pantalla: DD/MM/AAAA */
export function formatDate(value: Date | string): string {
  const d = dateOnly(value);
  if (d) return `${d[2]}/${d[1]}/${d[0]}`;
  const p = parts(value);
  return `${p.day}/${p.month}/${p.year}`;
}

/** Fecha de encabezado de documento controlado: DD-MM-AAAA (PRD 2.5.3) */
export function formatDocumentDate(value: Date | string): string {
  if (typeof value === "string" && !/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const d = dateOnly(value);
  if (d) return `${d[2]}-${d[1]}-${d[0]}`;
  const p = parts(value);
  return `${p.day}-${p.month}-${p.year}`;
}

/** Hora de 24 h: 14:32 */
export function formatTime(value: Date | string): string {
  const p = parts(value);
  return `${p.hour}:${p.minute}`;
}

/** Fecha y hora: 05/10/2026 14:32 */
export function formatDateTime(value: Date | string): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}
