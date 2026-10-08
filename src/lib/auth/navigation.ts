import type { AppRole } from "./roles";

// Menú lateral por rol (Prompt 0 y Prompt 1; diseño S-02). En E1 solo «Inicio» tiene pantalla;
// las demás secciones se habilitan en la etapa que las construye.

export type NavKey =
  | "inicio"
  | "aprobaciones"
  | "documentos"
  | "idi"
  | "bodega"
  | "produccion"
  | "calidad"
  | "equipos"
  | "desviaciones"
  | "trazabilidad"
  | "liberacion"
  | "auditoria"
  | "administracion";

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  /** Etapa en que se habilita (null = disponible). */
  stage: string | null;
};

export const NAV_ITEMS: Record<NavKey, NavItem> = {
  inicio: { key: "inicio", label: "Inicio", href: "/inicio", stage: null },
  aprobaciones: { key: "aprobaciones", label: "Aprobaciones", href: "/aprobaciones", stage: "E3" },
  documentos: { key: "documentos", label: "Documentos", href: "/documentos", stage: "E2B" },
  idi: { key: "idi", label: "I+D", href: "/idi/briefs", stage: "E3" },
  bodega: { key: "bodega", label: "Bodega", href: "/bodega/inventario", stage: "E4" },
  produccion: { key: "produccion", label: "Producción", href: "/produccion/lotes", stage: "E6" },
  calidad: { key: "calidad", label: "Calidad", href: "/calidad/supervision", stage: "E7" },
  equipos: { key: "equipos", label: "Equipos", href: "/equipos", stage: "E5" },
  desviaciones: {
    key: "desviaciones",
    label: "Desviaciones y CAPA",
    href: "/desviaciones",
    stage: "E8",
  },
  trazabilidad: {
    key: "trazabilidad",
    label: "Trazabilidad",
    href: "/trazabilidad/lote",
    stage: "E10",
  },
  liberacion: { key: "liberacion", label: "Liberación", href: "/liberacion", stage: "E9" },
  auditoria: { key: "auditoria", label: "Auditoría", href: "/auditoria/bitacora", stage: "E10" },
  administracion: {
    key: "administracion",
    label: "Administración",
    href: "/admin/usuarios",
    stage: "E2",
  },
};

const ORDER: NavKey[] = [
  "inicio",
  "aprobaciones",
  "documentos",
  "idi",
  "bodega",
  "produccion",
  "calidad",
  "equipos",
  "desviaciones",
  "trazabilidad",
  "liberacion",
  "auditoria",
  "administracion",
];

/** Secciones por rol según la matriz de permisos (PRD 2.2) y los menús del diseño S-02. */
export const NAV_BY_ROLE: Record<AppRole, NavKey[]> = {
  comercial: ["inicio", "documentos", "idi", "desviaciones"],
  idi: ["inicio", "documentos", "idi", "desviaciones", "trazabilidad"],
  bodega_aux: ["inicio", "documentos", "bodega", "equipos", "desviaciones", "trazabilidad"],
  bodega_jefe: ["inicio", "documentos", "bodega", "equipos", "desviaciones", "trazabilidad"],
  prod_aux: ["inicio", "documentos", "produccion", "equipos", "desviaciones", "trazabilidad"],
  prod_coord: [
    "inicio",
    "aprobaciones",
    "documentos",
    "produccion",
    "equipos",
    "desviaciones",
    "trazabilidad",
  ],
  lab_aux: ["inicio", "documentos", "calidad", "equipos", "desviaciones", "trazabilidad"],
  cc_jefe: [
    "inicio",
    "aprobaciones",
    "documentos",
    "calidad",
    "equipos",
    "desviaciones",
    "trazabilidad",
  ],
  aq_dir: [
    "inicio",
    "aprobaciones",
    "documentos",
    "calidad",
    "equipos",
    "desviaciones",
    "trazabilidad",
    "liberacion",
    "auditoria",
  ],
  dt: [
    "inicio",
    "aprobaciones",
    "documentos",
    "idi",
    "produccion",
    "calidad",
    "desviaciones",
    "trazabilidad",
    "liberacion",
    "auditoria",
  ],
  admin: ["inicio", "documentos", "auditoria", "administracion"],
  master: ["inicio", "documentos", "idi", "desviaciones", "trazabilidad"],
  aq_doc: ["inicio", "documentos", "desviaciones", "trazabilidad"],
  gerencia: ["inicio", "aprobaciones", "documentos", "idi", "trazabilidad"],
  auditor: [
    "inicio",
    "documentos",
    "idi",
    "bodega",
    "produccion",
    "calidad",
    "equipos",
    "desviaciones",
    "trazabilidad",
    "liberacion",
    "auditoria",
  ],
};

/** Menú de un usuario con varios roles: unión sin duplicados, en el orden del Prompt 0. */
export function navForRoles(roles: readonly AppRole[]): NavItem[] {
  const keys = new Set(roles.flatMap((r) => NAV_BY_ROLE[r] ?? []));
  return ORDER.filter((k) => keys.has(k)).map((k) => NAV_ITEMS[k]);
}
