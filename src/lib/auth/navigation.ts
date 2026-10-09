import { isSystemRole, type SystemRole } from "./roles";

// Menú lateral por rol (Prompt 0 y Prompt 1; diseño S-02). Desde E2: «Inicio», «Administración» y
// «Cambios de roles» (aprobación de cambios de rol, D-39/D-40); desde E3, «Documentos» (SGD);
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
  | "cambios_roles"
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
  documentos: { key: "documentos", label: "Documentos", href: "/documentos", stage: null },
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
  cambios_roles: {
    key: "cambios_roles",
    label: "Cambios de roles",
    href: "/cambios-roles",
    stage: null,
  },
  administracion: {
    key: "administracion",
    label: "Administración",
    href: "/admin/usuarios",
    stage: null,
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
  "cambios_roles",
  "administracion",
];

/** Secciones por rol según la matriz de permisos (PRD 2.2) y los menús del diseño S-02. */
export const NAV_BY_ROLE: Record<SystemRole, NavKey[]> = {
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
    "cambios_roles",
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
    "cambios_roles",
  ],
  admin: ["inicio", "auditoria", "cambios_roles", "administracion"],
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
    "cambios_roles",
  ],
};

/** Sección del menú de cada módulo de la matriz (para los roles adicionales, PRD 2.6). */
export const MODULE_TO_NAV: Record<string, NavKey[]> = {
  brief: ["idi"],
  formula_especificacion_instructivo: ["idi"],
  prototipos_estabilidad_y_costos: ["idi"],
  solicitudes_y_documentos_de_la_op: ["produccion"],
  recepcion_inventario: ["bodega"],
  liberacion_de_insumos: ["calidad"],
  orden_de_produccion: ["produccion"],
  dispensacion_fabricacion_envase_acond: ["produccion"],
  resultados_y_certificado_analitico: ["calidad"],
  desviaciones_capa: ["desviaciones"],
  liberacion_final_del_lote: ["liberacion"],
  paquete_tecnico: ["liberacion"],
  trazabilidad_auditoria: ["trazabilidad", "auditoria"],
  usuarios_catalogos_perfiles: ["administracion"],
  plantillas_de_proceso: ["documentos"],
  bodegas_estantes_y_ubicaciones: ["bodega"],
  traslados_y_envios_a_bodegas_externas: ["bodega"],
  sistema_de_gestion_documental: ["documentos"],
  lectura_y_capacitacion: ["documentos"],
};

/**
 * Menú de un usuario con varios roles: unión sin duplicados, en el orden del Prompt 0.
 * Los roles adicionales aportan las secciones de los módulos en los que tienen algún permiso.
 */
export function navForRoles(
  roles: readonly string[],
  customModules: readonly string[] = [],
): NavItem[] {
  const keys = new Set<NavKey>(["inicio"]);
  for (const r of roles) if (isSystemRole(r)) for (const k of NAV_BY_ROLE[r]) keys.add(k);
  for (const m of customModules) for (const k of MODULE_TO_NAV[m] ?? []) keys.add(k);
  return ORDER.filter((k) => keys.has(k)).map((k) => NAV_ITEMS[k]);
}
