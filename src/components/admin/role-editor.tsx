"use client";

import { Archive, ArchiveRestore, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setRoleActive,
  setRoleIncompatibilities,
  setRolePermissions,
  updateRole,
  type ModulePermission,
} from "@/lib/admin/actions";
import type { RoleInfo } from "@/lib/auth/roles";
import { ReasonDialog } from "./reason-dialog";
import { RoleRestrictions, type ReservedPermission } from "./roles-manager";

export type ModuleRow = ModulePermission & { name: string };
type Perm = "read" | "create" | "sign" | "approve";
const PERMS: [Perm, string][] = [
  ["read", "L"],
  ["create", "C"],
  ["sign", "F"],
  ["approve", "A"],
];

/**
 * Configuración de un rol (PRD 2.6): permisos por módulo, incompatibilidades, opciones y retiro.
 * Los roles del sistema se muestran en solo lectura (línea base del PRD 2.2).
 */
export function RoleEditor({
  role,
  modules,
  reserved,
  otherRoles,
  incompatible,
  holders,
}: {
  role: RoleInfo;
  modules: ModuleRow[];
  reserved: (ReservedPermission & { module_code: string })[];
  otherRoles: RoleInfo[];
  incompatible: string[];
  holders: number;
}) {
  const router = useRouter();
  const locked = role.is_system || !role.active;
  const [grid, setGrid] = useState<ModuleRow[]>(modules);
  const [incomp, setIncomp] = useState<string[]>(incompatible);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [requiresExpiry, setRequiresExpiry] = useState(role.requires_expiry);
  const [readOnly, setReadOnly] = useState(role.read_only);

  const reservedOf = (module: string, perm: Perm) =>
    reserved.find((r) => r.module_code === module && r.permission === perm);
  const changed = useMemo(
    () =>
      grid.filter((g) => {
        const o = modules.find((m) => m.module === g.module)!;
        return PERMS.some(([p]) => o[p] !== g[p]);
      }),
    [grid, modules],
  );
  const toggle = (module: string, perm: Perm, value: boolean) =>
    setGrid((rows) => rows.map((r) => (r.module === module ? { ...r, [perm]: value } : r)));

  return (
    <div className="grid gap-5">
      {role.is_system ? (
        <p className="flex items-center gap-2 rounded-lg border border-neutral-strong bg-surface-sunken px-3 py-2 text-sm">
          <Lock aria-hidden className="size-4" />
          Rol del sistema (PRD 2.1): sus permisos son la línea base del PRD 2.2 y no se modifican ni
          se retira.
        </p>
      ) : !role.active ? (
        <p className="flex items-center gap-2 rounded-lg border border-neutral-strong bg-surface-sunken px-3 py-2 text-sm">
          <Archive aria-hidden className="size-4" />
          Rol retirado: no se asigna ni da permisos. Reactívelo para configurarlo.
        </p>
      ) : null}

      {!role.is_system ? <RoleRestrictions reserved={reserved} /> : null}

      <section aria-labelledby="permisos" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="permisos" className="text-card-title">
            Permisos por módulo
          </h2>
          {!locked ? (
            <ReasonDialog
              trigger={
                <Button disabled={changed.length === 0}>Guardar permisos ({changed.length})</Button>
              }
              title={`Guardar permisos de ${role.name}`}
              description={`Se modifican ${changed.length} módulo(s). Cada celda queda en la bitácora con su antes y después.`}
              confirmLabel="Guardar permisos"
              onConfirm={(reason) =>
                setRolePermissions({
                  code: role.code,
                  permissions: changed.map(({ module, read, create, sign, approve }) => ({
                    module,
                    read,
                    create,
                    sign,
                    approve,
                  })),
                  reason,
                })
              }
              onDone={() => router.refresh()}
            />
          ) : null}
        </div>
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm" data-testid="role-permissions">
            <caption className="sr-only">Permisos del rol por módulo</caption>
            <thead className="bg-surface-sunken">
              <tr>
                <th scope="col" className="border-b border-border px-4 py-2.5 text-label uppercase">
                  Módulo
                </th>
                {PERMS.map(([p, l]) => (
                  <th
                    key={p}
                    scope="col"
                    className="border-b border-border px-3 py-2.5 text-center text-label uppercase"
                  >
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((m) => (
                <tr key={m.module} className="border-b border-divider last:border-0">
                  <th scope="row" className="px-4 py-2 font-normal">
                    {m.name}
                  </th>
                  {PERMS.map(([p, l]) => {
                    const res = reservedOf(m.module, p);
                    const disabled = locked || Boolean(res) || (role.read_only && p !== "read");
                    return (
                      <td key={p} className="px-3 py-2 text-center">
                        <label
                          className="inline-flex items-center gap-1"
                          title={
                            res
                              ? res.reason
                              : role.read_only && p !== "read"
                                ? "Rol de solo lectura"
                                : undefined
                          }
                        >
                          <input
                            type="checkbox"
                            checked={m[p]}
                            disabled={disabled}
                            onChange={(e) => toggle(m.module, p, e.target.checked)}
                            aria-label={`${l} en ${m.name}`}
                            className="size-4"
                          />
                          {res ? (
                            <Lock
                              aria-label={`Reservado a ${res.owner_role}`}
                              className="size-3.5 text-text-muted"
                            />
                          ) : null}
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!role.is_system ? (
        <div className="grid grid-cols-2 gap-5 max-[1279px]:grid-cols-1">
          <section
            aria-labelledby="incompat"
            className="grid content-start gap-3 rounded-[10px] border border-border bg-surface p-4"
          >
            <h2 id="incompat" className="text-card-title">
              Roles incompatibles
            </h2>
            <p className="text-small text-text-secondary">
              La misma persona no podrá tener este rol y los marcados.
            </p>
            <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto">
              {otherRoles.map((o) => (
                <label key={o.code} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={locked}
                    checked={incomp.includes(o.code)}
                    onChange={(e) =>
                      setIncomp(
                        e.target.checked ? [...incomp, o.code] : incomp.filter((c) => c !== o.code),
                      )
                    }
                    className="size-4"
                  />
                  {o.name}
                </label>
              ))}
            </div>
            {!locked ? (
              <ReasonDialog
                trigger={
                  <Button variant="secondary" className="justify-self-start">
                    Guardar incompatibilidades
                  </Button>
                }
                title="Guardar roles incompatibles"
                confirmLabel="Guardar"
                onConfirm={(reason) =>
                  setRoleIncompatibilities({ code: role.code, others: incomp, reason })
                }
                onDone={() => router.refresh()}
              />
            ) : null}
          </section>

          <section
            aria-labelledby="opciones"
            className="grid content-start gap-3 rounded-[10px] border border-border bg-surface p-4"
          >
            <h2 id="opciones" className="text-card-title">
              Datos y opciones
            </h2>
            <div className="grid gap-1.5">
              <Label htmlFor="r-name" className="text-label uppercase">
                Nombre
              </Label>
              <Input
                id="r-name"
                value={name}
                disabled={locked}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="r-desc" className="text-label uppercase">
                Descripción
              </Label>
              <Input
                id="r-desc"
                value={description}
                disabled={locked}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={locked}
                checked={requiresExpiry}
                onChange={(e) => setRequiresExpiry(e.target.checked)}
                className="size-4"
              />
              Exige fecha de vencimiento al asignarlo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={locked}
                checked={readOnly}
                onChange={(e) => setReadOnly(e.target.checked)}
                className="size-4"
              />
              Solo lectura (únicamente L)
            </label>
            {!locked ? (
              <ReasonDialog
                trigger={
                  <Button variant="secondary" className="justify-self-start">
                    Guardar datos
                  </Button>
                }
                title="Guardar datos del rol"
                confirmLabel="Guardar"
                onConfirm={(reason) =>
                  updateRole({
                    code: role.code,
                    name,
                    description,
                    requiresExpiry,
                    readOnly,
                    reason,
                  })
                }
                onDone={() => router.refresh()}
              />
            ) : null}
            <div className="grid gap-2 border-t border-divider pt-3">
              <p className="text-small text-text-secondary">
                Usuarios con el rol vigente: {holders}
              </p>
              {role.active ? (
                <ReasonDialog
                  trigger={
                    <Button
                      variant="destructive"
                      className="justify-self-start"
                      disabled={holders > 0}
                    >
                      <Archive aria-hidden />
                      Retirar rol
                    </Button>
                  }
                  title={`Retirar el rol ${role.name}`}
                  description="El rol deja de poder asignarse y de dar permisos. Nada se borra: su historial se conserva y puede reactivarse."
                  confirmLabel="Retirar rol"
                  destructive
                  onConfirm={(reason) => setRoleActive({ code: role.code, active: false, reason })}
                  onDone={() => router.refresh()}
                />
              ) : (
                <ReasonDialog
                  trigger={
                    <Button className="justify-self-start">
                      <ArchiveRestore aria-hidden />
                      Reactivar rol
                    </Button>
                  }
                  title={`Reactivar el rol ${role.name}`}
                  confirmLabel="Reactivar"
                  onConfirm={(reason) => setRoleActive({ code: role.code, active: true, reason })}
                  onDone={() => router.refresh()}
                />
              )}
              {role.active && holders > 0 ? (
                <p className="text-small text-text-secondary">
                  «Retirar rol» está deshabilitado: revóquelo antes a los usuarios que lo tienen.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
