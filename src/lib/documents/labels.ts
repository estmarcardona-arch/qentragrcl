import type { StatusKey } from "@/components/gxp/status";

// Etiquetas y estados del sistema de gestión documental (PRD 2.5, 9; Prompt 2C).

export type VersionStatus =
  | "solicitado"
  | "preliminar"
  | "en_estandarizacion"
  | "codificado"
  | "en_revision"
  | "en_aprobacion"
  | "vigente"
  | "obsoleto";

export type Validity = "vigente" | "por_vencer" | "vencido" | "sin_dato" | "obsoleto";

/** Estado de trámite de una versión → insignia (familia trámite: neutro y azul). */
export const VERSION_BADGE: Record<VersionStatus, { status: StatusKey; label: string }> = {
  solicitado: { status: "preliminar", label: "Solicitado" },
  preliminar: { status: "preliminar", label: "Preliminar" },
  en_estandarizacion: { status: "en_estandarizacion", label: "En estandarización" },
  codificado: { status: "codificado", label: "Codificado" },
  en_revision: { status: "doc_en_revision", label: "En revisión" },
  en_aprobacion: { status: "en_aprobacion", label: "En aprobación" },
  vigente: { status: "publicado", label: "Vigente" },
  obsoleto: { status: "obsoleto", label: "Obsoleto" },
};

/** Vigencia → semáforo (familia calidad), siempre con ícono y texto. */
export const VALIDITY_BADGE: Record<Validity, { status: StatusKey; label: string }> = {
  vigente: { status: "vigente", label: "Vigente" },
  por_vencer: { status: "por_vencer", label: "Por vencer" },
  vencido: { status: "vencido", label: "Revisión vencida" },
  sin_dato: { status: "sin_dato", label: "Sin dato" },
  obsoleto: { status: "sin_dato", label: "Obsoleto" },
};

export const LEVELS: Record<number, string> = {
  1: "Normatividad",
  2: "Manuales",
  3: "Procedimientos",
  4: "Instructivos, técnicas y matrices",
  5: "Formatos",
};

/** Secciones mínimas del cuerpo (PRD 2.5.3). Los formatos e instructivos no llevan alcance. */
export const SECTIONS: { key: string; label: string; hint: string }[] = [
  { key: "objetivo", label: "Objetivo", hint: "Inicie con un verbo en infinitivo: «Establecer…»." },
  { key: "alcance", label: "Alcance", hint: "A qué procesos, productos o áreas aplica." },
  {
    key: "responsables",
    label: "Responsables",
    hint: "Cargos que ejecutan, verifican y aprueban.",
  },
  {
    key: "desarrollo",
    label: "Desarrollo del documento",
    hint: "Un paso por renglón, en infinitivo y con unidades del Sistema Internacional.",
  },
  {
    key: "documentos_relacionados",
    label: "Documentos relacionados y anexos",
    hint: "Códigos de los documentos asociados; «N.A.» si no aplica.",
  },
  {
    key: "control_cambios",
    label: "Control de cambios",
    hint: "Qué cambia en esta versión respecto a la anterior.",
  },
];

export const ORIGIN_LABELS: Record<string, string> = {
  desviacion: "Desviación",
  capa: "CAPA",
  auditoria: "Auditoría",
  mejora: "Mejora",
  regulatorio: "Regulatorio",
  renovacion_registro: "Renovación del registro sanitario",
};

export const REQUEST_KIND_LABELS: Record<string, string> = {
  creacion: "Creación",
  modificacion: "Modificación",
  anulacion: "Anulación",
};

export const PARENT_REVIEW_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  sin_cambio: "Sin cambio",
  nueva_version: "Nueva versión",
};

/** Versión de dos dígitos («03»). */
export function versionLabel(n: number | null | undefined): string {
  return n == null ? "—" : String(n).padStart(2, "0");
}

/** Fecha de documento DD-MM-AAAA (PRD 2.5.3) a partir de AAAA-MM-DD. */
export function docDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

/** Ejemplo de la estructura del código para mostrar en pantalla (RF-93). */
export const CODE_EXAMPLE =
  "GCA-PR-001 = proceso GCA · tipo PR (procedimiento) · consecutivo 001. PRD-PR-003-FR-01 = formato 01 del procedimiento PRD-PR-003.";
