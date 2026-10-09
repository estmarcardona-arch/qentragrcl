import { StatusBadge } from "@/components/gxp/status-badge";
import type { AdminUser } from "./types";

/** Estado del usuario (trámite, neutro/azul): activo, invitación pendiente o inactivo. */
export function UserStatus({ user }: { user: Pick<AdminUser, "active" | "invitation_pending"> }) {
  if (!user.active) return <StatusBadge status="bloqueada" label="Inactivo" />;
  if (user.invitation_pending)
    return <StatusBadge status="pendiente" label="Invitación pendiente" />;
  return <StatusBadge status="en_curso" label="Activo" />;
}
