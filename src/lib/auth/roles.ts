import type { Database } from "@/lib/db/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

/** Nombre visible de cada rol (PRD 2.1; se renombran según el organigrama, D-06). */
export const ROLE_LABELS: Record<AppRole, string> = {
  comercial: "Comercial",
  idi: "Químico formulador (I+D)",
  bodega_aux: "Auxiliar de bodega",
  bodega_jefe: "Jefe de bodega",
  prod_aux: "Auxiliar de producción",
  prod_coord: "Coordinador de producción",
  lab_aux: "Auxiliar de laboratorio",
  cc_jefe: "Jefe de control de calidad",
  aq_dir: "Director de aseguramiento de calidad",
  dt: "Director técnico",
  admin: "Administrador del sistema",
  master: "Usuario master",
  aq_doc: "Analista de gestión documental",
  gerencia: "Gerente general",
  auditor: "Auditor invitado",
};

export function hasAnyRole(roles: readonly AppRole[], wanted: readonly AppRole[]): boolean {
  return roles.some((r) => wanted.includes(r));
}

/** Iniciales para el avatar: «Dr. Esteban Gaviria» → «EG». */
export function initials(fullName: string): string {
  const parts = fullName
    .replace(/^((dr|dra|ing)\.?\s+)+/i, "")
    .trim()
    .split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
