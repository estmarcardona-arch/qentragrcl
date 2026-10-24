import type { StatusKey } from "@/components/gxp/status";

// Estados de trámite de I+D (familia trámite: neutro y azul; Prompt 3 y 3B).
export const BRIEF_STATUS: Record<string, { status: StatusKey; label: string }> = {
  borrador: { status: "preliminar", label: "Borrador" },
  enviado: { status: "doc_en_revision", label: "Enviado a I+D" },
  aprobado: { status: "publicado", label: "Aprobado" },
  devuelto: { status: "bloqueada", label: "Devuelto" },
};

export const PROTOTYPE_STATUS: Record<string, { status: StatusKey; label: string }> = {
  borrador: { status: "preliminar", label: "Borrador" },
  en_estabilidad: { status: "en_curso", label: "En estabilidad" },
  reformular: { status: "en_estandarizacion", label: "Reformular" },
  seleccionado: { status: "en_aprobacion", label: "Seleccionado" },
  aprobado: { status: "publicado", label: "Aprobado como fórmula" },
  descartado: { status: "obsoleto", label: "Descartado" },
};

export const TEST_LABELS: Record<string, string> = {
  calentamiento: "Calentamiento",
  enfriamiento: "Enfriamiento",
  microbiologica: "Microbiológica",
  viscosidad: "Viscosidad",
  densidad: "Densidad",
};

export const TIME_POINTS = ["0h", "12h", "24h", "3d", "7d", "15d", "30d"] as const;
export const TIME_LABELS: Record<string, string> = {
  "0h": "0 h",
  "12h": "12 h",
  "24h": "24 h",
  "3d": "3 d",
  "7d": "7 d",
  "15d": "15 d",
  "30d": "30 d",
};

export const ANALYTES: [string, string][] = [
  ["mesofilos", "Mesófilos aerobios"],
  ["pseudomonas", "Pseudomonas aeruginosa"],
  ["staphylococcus", "Staphylococcus aureus"],
  ["ecoli", "Escherichia coli"],
];

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  innovador: "Innovador",
  nuevo_portafolio: "Nuevo en el portafolio",
  modificacion_renovacion: "Modificación o renovación",
  extension_linea: "Extensión de línea",
  maquila_tercero: "Maquila a tercero",
};

export const SPEC_SCOPE_LABELS: Record<string, string> = {
  mp: "Materia prima",
  envase: "Material de envase",
  granel: "Granel",
  pt: "Producto terminado",
};

export const STAGE_LABELS: Record<string, string> = {
  fabricacion: "Fabricación",
  envase: "Envase",
  acondicionamiento: "Acondicionamiento",
};
