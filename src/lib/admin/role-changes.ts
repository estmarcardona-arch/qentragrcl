import type { StatusKey } from "@/components/gxp/status";

// Solicitudes de cambio de rol (PRD 2.6; D-39, D-40). Las devuelve get_role_change_requests.

export type RoleChangeStatus = "pendiente" | "aprobada" | "rechazada" | "anulada";

export type PermissionCell = {
  module: string;
  read?: boolean;
  create?: boolean;
  sign?: boolean;
  approve?: boolean;
  cell?: string;
  prd_cell?: string | null;
};

export type RoleChangeRequest = {
  id: string;
  request_number: string;
  kind: "create" | "update" | "permissions" | "incompatibilities" | "retire" | "reactivate";
  role_code: string;
  role_name: string | null;
  role_is_system: boolean;
  summary: string;
  payload: {
    name?: string;
    description?: string;
    requires_expiry?: boolean;
    read_only?: boolean;
    permissions?: PermissionCell[];
    others?: string[];
  };
  before: {
    name?: string;
    description?: string;
    requires_expiry?: boolean;
    read_only?: boolean;
    active?: boolean;
    permissions?: PermissionCell[];
    others?: string[];
  };
  reason: string;
  required_roles: string[];
  status: RoleChangeStatus;
  requested_by: string;
  requested_by_name: string | null;
  requested_at: string;
  closed_at: string | null;
  close_reason: string | null;
  approvals: {
    approver: string;
    approver_name: string;
    approver_role: string;
    decision: "aprobada" | "rechazada";
    reason: string;
    decided_at: string;
  }[];
};

export const KIND_LABELS: Record<RoleChangeRequest["kind"], string> = {
  create: "Crear rol",
  update: "Datos y opciones",
  permissions: "Permisos por módulo",
  incompatibilities: "Roles incompatibles",
  retire: "Retirar rol",
  reactivate: "Reactivar rol",
};

export const STATUS_BADGE: Record<RoleChangeStatus, { status: StatusKey; label: string }> = {
  pendiente: { status: "pendiente", label: "Pendiente de aprobación" },
  aprobada: { status: "completada", label: "Aprobada y aplicada" },
  rechazada: { status: "bloqueada", label: "Rechazada" },
  anulada: { status: "bloqueada", label: "Anulada" },
};

/** Quién aprueba (D-39: Aseguramiento de calidad; D-40: además Dirección técnica). */
export const APPROVER_LABELS: Record<string, string> = {
  aq_dir: "Aseguramiento de calidad",
  dt: "Dirección técnica",
};

export function cellText(p: PermissionCell): string {
  const t = [p.read && "L", p.create && "C", p.sign && "F", p.approve && "A"].filter(Boolean);
  return t.length ? t.join(" ") : "—";
}

/** Rol con el que el usuario puede decidir la solicitud (o null si no le corresponde). */
export function approverRoleFor(
  req: RoleChangeRequest,
  userId: string,
  roles: readonly string[],
): string | null {
  if (req.status !== "pendiente" || req.requested_by === userId) return null;
  if (req.approvals.some((a) => a.approver === userId)) return null;
  return (
    req.required_roles.find(
      (r) => roles.includes(r) && !req.approvals.some((a) => a.approver_role === r),
    ) ?? null
  );
}
