import type { StatusKey } from "@/components/gxp/status";

// Textos de Equipos (S-25, RF-50). El estado general usa el semáforo de vigencia; el operativo, trámite.
export const FITNESS: Record<string, { status: StatusKey; label: string }> = {
  apto: { status: "vigente", label: "Apto para uso" },
  apto_con_alerta: { status: "por_vencer", label: "Apto · con alerta" },
  no_apto: { status: "vencido", label: "No apto para uso" },
};

export const EQUIPMENT_STATUS: Record<string, { status: StatusKey; label: string }> = {
  disponible: { status: "completada", label: "Disponible" },
  en_uso: { status: "en_curso", label: "En uso" },
  en_limpieza: { status: "en_curso", label: "En limpieza" },
  en_mantenimiento: { status: "pendiente", label: "En mantenimiento" },
  fuera_de_servicio: { status: "bloqueada", label: "Fuera de servicio" },
  calibracion_vencida: { status: "vencido", label: "Calibración vencida" },
};

/** Estados que se fijan a mano; «calibración vencida» se deriva de la hoja de vida. */
export const SETTABLE_STATUS: [string, string][] = [
  ["disponible", "Disponible"],
  ["en_uso", "En uso"],
  ["en_limpieza", "En limpieza"],
  ["en_mantenimiento", "En mantenimiento"],
  ["fuera_de_servicio", "Fuera de servicio"],
];

export const EVENT_TYPES: [string, string][] = [
  ["instalacion", "Instalación"],
  ["calibracion", "Calibración"],
  ["verificacion", "Verificación"],
  ["mantenimiento", "Mantenimiento"],
  ["calificacion", "Calificación"],
  ["limpieza", "Limpieza"],
  ["uso", "Uso"],
  ["cambio_estado", "Cambio de estado"],
];
export const EVENT_LABELS: Record<string, string> = Object.fromEntries(EVENT_TYPES);

export const PLANT_AREAS: [string, string][] = [
  ["bodega", "Bodega"],
  ["dispensacion", "Dispensación"],
  ["fabricacion", "Fabricación"],
  ["envase", "Envase"],
  ["acondicionamiento", "Acondicionamiento"],
  ["laboratorio", "Laboratorio"],
  ["otra", "Otra"],
];
export const AREA_LABELS: Record<string, string> = Object.fromEntries(PLANT_AREAS);

export const EVIDENCE_TYPES = ["application/pdf", "image/png", "image/jpeg"];
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

/** Días que faltan para una fecha (AAAA-MM-DD) desde hoy en Bogotá. */
export function daysUntil(date: string | null, today: string): number | null {
  if (!date) return null;
  return Math.round((Date.parse(date.slice(0, 10)) - Date.parse(today)) / 86_400_000);
}

/** Vigencia de un vencimiento frente a los días de alerta (semáforo de la tarjeta). */
export function dueStatus(
  days: number | null,
  alertDays: number,
): { status: StatusKey; label: string } {
  if (days === null) return { status: "sin_dato", label: "Sin registro" };
  if (days < 0) return { status: "vencido", label: "Vencido" };
  if (days <= alertDays) return { status: "por_vencer", label: "Por vencer" };
  return { status: "vigente", label: "Vigente" };
}
