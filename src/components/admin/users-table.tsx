"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, dataTableColumns } from "@/components/common/data-table";
import { roleLabel, type RoleInfo } from "@/lib/auth/roles";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AdminUser } from "./types";
import { UserStatus } from "./user-status";

type Row = AdminUser & { roleNames: string; status: string; roleNamesById: Record<string, string> };

const col = dataTableColumns<Row>();
const columns = col.columns([
  col.accessor("full_name", {
    header: "Nombre",
    cell: (info) => (
      <span className="grid">
        <Link href={`/admin/usuarios/${info.row.original.id}`} className="font-semibold">
          {info.getValue()}
        </Link>
        <span className="text-small text-text-secondary">{info.row.original.email}</span>
      </span>
    ),
  }),
  col.accessor("roleNames", {
    header: "Roles",
    enableSorting: false,
    cell: (info) => (
      <span className="flex flex-wrap gap-1">
        {info.row.original.roles.map((r) => (
          <span
            key={r.id}
            className={`rounded px-1.5 py-0.5 text-xs ${r.active ? "bg-primary-tint text-primary-hover" : "bg-surface-sunken text-text-secondary line-through"}`}
            title={r.active ? undefined : "Vencido"}
          >
            {info.row.original.roleNamesById[r.role] ?? r.role}
          </span>
        ))}
      </span>
    ),
  }),
  col.accessor("area_name", { header: "Área", cell: (info) => info.getValue() ?? "—" }),
  col.accessor("status", {
    header: "Estado",
    cell: (info) => <UserStatus user={info.row.original} />,
  }),
  col.accessor("last_sign_in_at", {
    header: "Último ingreso",
    cell: (info) =>
      info.getValue() ? (
        <span className="font-mono text-xs">{formatDateTime(info.getValue()!)}</span>
      ) : (
        "Nunca"
      ),
  }),
  col.display({
    id: "vence",
    header: "Vence el acceso",
    cell: (info) => {
      const auditor = info.row.original.roles.find((r) => r.role === "auditor");
      return auditor?.expires_at ? formatDate(auditor.expires_at) : "—";
    },
  }),
]);

export function UsersTable({ users, roles }: { users: AdminUser[]; roles: RoleInfo[] }) {
  const [role, setRole] = useState<string>("");
  const [status, setStatus] = useState<"" | "activo" | "inactivo" | "pendiente">("");

  const rows = useMemo<Row[]>(
    () =>
      users
        .map((u) => ({
          ...u,
          roleNames: u.roles.map((r) => roleLabel(r.role, roles)).join(", "),
          roleNamesById: Object.fromEntries(u.roles.map((r) => [r.role, roleLabel(r.role, roles)])),
          status: !u.active ? "inactivo" : u.invitation_pending ? "pendiente" : "activo",
        }))
        .filter((u) => !role || u.roles.some((r) => r.role === role))
        .filter((u) => !status || u.status === status),
    [users, role, status, roles],
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-label text-text-secondary uppercase">Rol</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-9 rounded-md border border-border-control bg-white px-2"
          >
            <option value="">Todos</option>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
                {r.active ? "" : " (retirado)"}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-label text-text-secondary uppercase">Estado</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="h-9 rounded-md border border-border-control bg-white px-2"
          >
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="pendiente">Invitación pendiente</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </label>
      </div>
      <DataTable
        caption="Usuarios"
        columns={columns}
        data={rows}
        pageSize={20}
        searchPlaceholder="Buscar por nombre, correo o área"
        empty={{ title: "Ningún usuario coincide con los filtros" }}
      />
    </div>
  );
}
