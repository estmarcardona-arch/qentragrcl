"use client";

import type { AppRole, RoleInfo } from "@/lib/auth/roles";

export type RoleChoice = { role: AppRole; expiresOn?: string };

const SPECIAL: string[] = ["master", "aq_doc", "gerencia", "auditor", "admin"];

/** Casillas de roles (sistema y adicionales activos) con vencimiento; obligatorio si el rol lo exige. */
export function RolePicker({
  roles,
  value,
  onChange,
}: {
  roles: RoleInfo[];
  value: RoleChoice[];
  onChange: (v: RoleChoice[]) => void;
}) {
  const active = roles.filter((r) => r.active);
  const toggle = (role: string, checked: boolean) =>
    onChange(checked ? [...value, { role }] : value.filter((r) => r.role !== role));
  const setDate = (role: string, expiresOn: string) =>
    onChange(value.map((r) => (r.role === role ? { ...r, expiresOn: expiresOn || undefined } : r)));

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-label text-text-strong uppercase">Roles</legend>
      <div className="grid grid-cols-3 gap-2 max-[1279px]:grid-cols-2">
        {active.map((r) => {
          const choice = value.find((v) => v.role === r.code);
          return (
            <div
              key={r.code}
              className="grid gap-1.5 rounded-md border border-border bg-white p-2.5"
            >
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(choice)}
                  onChange={(e) => toggle(r.code, e.target.checked)}
                  className="size-4"
                />
                <span>
                  {r.name}
                  {SPECIAL.includes(r.code) ? (
                    <span className="text-xs text-text-muted"> · especial</span>
                  ) : null}
                  {!r.is_system ? (
                    <span className="text-xs text-text-muted"> · adicional</span>
                  ) : null}
                </span>
              </label>
              {choice ? (
                <label className="grid gap-0.5 text-xs text-text-secondary">
                  Vence {r.requires_expiry ? "(obligatorio)" : "(opcional)"}
                  <input
                    type="date"
                    aria-label={`Vencimiento del rol ${r.name}`}
                    value={choice.expiresOn ?? ""}
                    onChange={(e) => setDate(r.code, e.target.value)}
                    required={r.requires_expiry}
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
