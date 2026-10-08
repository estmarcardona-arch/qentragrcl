"use client";

import { ROLE_LABELS, type AppRole } from "@/lib/auth/roles";

export type RoleChoice = { role: AppRole; expiresOn?: string };

const SPECIAL: AppRole[] = ["master", "aq_doc", "gerencia", "auditor", "admin"];

/** Casillas de roles con fecha de vencimiento (obligatoria para el auditor). */
export function RolePicker({
  value,
  onChange,
}: {
  value: RoleChoice[];
  onChange: (v: RoleChoice[]) => void;
}) {
  const roles = Object.keys(ROLE_LABELS) as AppRole[];
  const toggle = (role: AppRole, checked: boolean) =>
    onChange(checked ? [...value, { role }] : value.filter((r) => r.role !== role));
  const setDate = (role: AppRole, expiresOn: string) =>
    onChange(value.map((r) => (r.role === role ? { ...r, expiresOn: expiresOn || undefined } : r)));

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-label text-text-strong uppercase">Roles</legend>
      <div className="grid grid-cols-3 gap-2 max-[1279px]:grid-cols-2">
        {roles.map((role) => {
          const choice = value.find((r) => r.role === role);
          return (
            <div key={role} className="grid gap-1.5 rounded-md border border-border bg-white p-2.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(choice)}
                  onChange={(e) => toggle(role, e.target.checked)}
                  className="size-4"
                />
                <span>
                  {ROLE_LABELS[role]}
                  {SPECIAL.includes(role) ? (
                    <span className="text-xs text-text-muted"> · especial</span>
                  ) : null}
                </span>
              </label>
              {choice ? (
                <label className="grid gap-0.5 text-xs text-text-secondary">
                  Vence {role === "auditor" ? "(obligatorio)" : "(opcional)"}
                  <input
                    type="date"
                    aria-label={`Vencimiento del rol ${ROLE_LABELS[role]}`}
                    value={choice.expiresOn ?? ""}
                    onChange={(e) => setDate(role, e.target.value)}
                    required={role === "auditor"}
                    className="h-8 rounded border border-border-control px-1.5 text-sm text-foreground"
                  />
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
