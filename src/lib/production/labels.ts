import type { StatusKey } from "@/components/gxp/status";

// Textos de Producción (S-15…S-21, S-38, S-39). Trámite en neutro/azul; calidad con semáforo.
export const STAGES = ["dispensacion", "fabricacion", "envase", "acondicionamiento"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<string, string> = {
  despeje: "Despeje",
  dispensacion: "Dispensación",
  fabricacion: "Fabricación",
  envase: "Envase",
  acondicionamiento: "Acondicionamiento",
};

export const STAGE_STATUS: Record<string, { status: StatusKey; label: string }> = {
  pendiente: { status: "pendiente", label: "Pendiente" },
  en_curso: { status: "en_curso", label: "En curso" },
  completada: { status: "completada", label: "Completada" },
  bloqueada: { status: "bloqueada", label: "Bloqueada" },
};

export const ORDER_STATUS: Record<string, { status: StatusKey; label: string }> = {
  borrador: { status: "preliminar", label: "Borrador" },
  aprobada: { status: "completada", label: "Aprobada" },
  en_ejecucion: { status: "en_curso", label: "En ejecución" },
  cerrada: { status: "completada", label: "Cerrada" },
  anulada: { status: "obsoleto", label: "Anulada" },
};

/** Estado de calidad del lote (semáforo solo para calidad, Prompt 5). */
export const BATCH_STATUS: Record<string, { status: StatusKey; label: string }> = {
  creado: { status: "pendiente", label: "Creado" },
  en_proceso: { status: "en_curso", label: "En curso" },
  en_revision: { status: "cuarentena", label: "En cuarentena" },
  liberado: { status: "aprobado", label: "Aprobado" },
  rechazado: { status: "rechazado", label: "Rechazado" },
};

export const REQUEST_LABELS: Record<string, string> = {
  dispensacion: "Solicitud de dispensación",
  envase: "Solicitud de material de envase",
  acondicionamiento: "Solicitud de material de acondicionamiento",
};

/** Inspección de producto terminado (Prompt 0B, 9 puntos). */
export const PT_POINTS = [
  "Integridad del envase",
  "Tapa y sello",
  "Etiqueta legible y centrada",
  "Lote y vencimiento impresos",
  "Notificación sanitaria visible",
  "Código de barras",
  "Plegadiza correcta",
  "Cantidad por caja",
  "Volumen neto",
];

export const STAGE_PATH: Record<string, string> = {
  dispensacion: "dispensacion",
  fabricacion: "fabricacion",
  envase: "envase",
  acondicionamiento: "acondicionamiento",
};

export type Presentation = {
  presentation_id: string;
  code: string;
  name: string;
  net_content: number;
  unit: string;
  bulk_qty: number;
  units: number;
};

export type FrozenDocument = {
  kind: string;
  stage: string | null;
  code: string;
  title: string;
  version_no: number;
  version_id: string;
  template_id?: string | null;
  instruction_id?: string | null;
};
