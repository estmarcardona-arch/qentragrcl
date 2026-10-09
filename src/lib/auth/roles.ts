// Roles (PRD 2.1 y 2.6). Los 15 roles del sistema son fijos; el administrador puede crear roles
// adicionales (tabla public.roles), cuyos nombres se leen de la base.

export const SYSTEM_ROLES = [
  "comercial",
  "idi",
  "bodega_aux",
  "bodega_jefe",
  "prod_aux",
  "prod_coord",
  "lab_aux",
  "cc_jefe",
  "aq_dir",
  "dt",
  "admin",
  "master",
  "aq_doc",
  "gerencia",
  "auditor",
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];
/** Código de rol: uno del sistema o uno adicional creado por el administrador. */
export type AppRole = SystemRole | (string & {});

export function isSystemRole(code: string): code is SystemRole {
  return (SYSTEM_ROLES as readonly string[]).includes(code);
}

/** Nombre visible de cada rol del sistema (PRD 2.1; se renombran según el organigrama, D-06). */
export const ROLE_LABELS: Record<SystemRole, string> = {
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

export type RoleInfo = {
  code: string;
  name: string;
  description: string;
  is_system: boolean;
  requires_expiry: boolean;
  read_only: boolean;
  active: boolean;
  version: number;
};

/** Nombre del rol: del catálogo de la base si se tiene; si no, el del PRD; si no, el código. */
export function roleLabel(code: string, catalog?: Pick<RoleInfo, "code" | "name">[]): string {
  return (
    catalog?.find((r) => r.code === code)?.name ?? (isSystemRole(code) ? ROLE_LABELS[code] : code)
  );
}

export function hasAnyRole(roles: readonly string[], wanted: readonly string[]): boolean {
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
