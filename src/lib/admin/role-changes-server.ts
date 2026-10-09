import "server-only";

import type { DbClient } from "@/lib/rpc";
import { callRpc } from "@/lib/rpc";
import type { RoleChangeRequest, RoleChangeStatus } from "./role-changes";

/** Solicitudes de cambio de rol con los nombres de módulos y roles para mostrarlas. */
export async function loadRoleChanges(
  supabase: DbClient,
  filter: { status?: RoleChangeStatus; role?: string } = {},
) {
  const [requests, { data: modules }, { data: roles }] = await Promise.all([
    callRpc(supabase, "get_role_change_requests", {
      p_status: filter.status,
      p_role: filter.role,
    }),
    supabase.from("permission_modules").select("code, name"),
    supabase.from("roles").select("code, name"),
  ]);
  return {
    requests: (requests ?? []) as unknown as RoleChangeRequest[],
    moduleNames: Object.fromEntries((modules ?? []).map((m) => [m.code, m.name])),
    roleNames: Object.fromEntries((roles ?? []).map((r) => [r.code, r.name])),
  };
}
