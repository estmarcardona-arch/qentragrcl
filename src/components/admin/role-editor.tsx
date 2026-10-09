"use client";

import { Archive, ArchiveRestore, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setRoleActive,
  setRoleIncompatibilities,
  setRolePermissions,
  updateRole,
  type ModulePermission,
  type RequestResult,
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
 * Cada cambio es una solicitud: la aprueba Aseguramiento de calidad (D-39); los permisos de un rol
 * del sistema exigen además Dirección técnica (D-40). Las funciones reservadas siguen con candado.
 */
export function RoleEditor({
  role,
  modules,
  reserved,
  otherRoles,
  incompatible,
  holders,
  pendingNumber,
  pendingPanel,
}: {
  role: RoleInfo;
  modules: ModuleRow[];
  reserved: (ReservedPermission & { module_code: string })[];
  otherRoles: RoleInfo[];
  incompatible: string[];
  holders: number;
  /** Solicitud pendiente del rol (mientras exista, no se solicitan otros cambios). */
  pendingNumber: string | null;
  pendingPanel?: ReactNode;
}) {
  const router = useRouter();
  const pending = pendingNumber !== null;
  const permLocked = !role.active || pending;
  const locked = role.is_system || !role.active || pending;
  const [notice, setNotice] = useState<string | null>(null);
  const approvers = role.is_system
    ? "Aseguramiento de calidad y Dirección técnica (doble aprobación)"
    : "Aseguramiento de calidad";
  const sent = (res: RequestResult) => {
    if (res.ok)
      setNotice(
        `Solicitud ${res.requestNumber} enviada. El cambio se aplica cuando lo apruebe ${approvers}.`,
      );
    return res;
  };
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
      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-tram-en-curso-bd bg-tram-en-curso-bg px-3 py-2 text-sm text-tram-en-curso-fg"
        >
          {notice}
        </p>
      ) : null}
      {pending ? (
        <section aria-labelledby="pendiente" className="grid gap-2">
          <h2 id="pendiente" className="text-card-title">
            Solicitud pendiente
          </h2>
          <p className="text-small text-text-secondary">
            Mientras la solicitud {pendingNumber} esté pendiente no se pueden solicitar otros
            cambios de este rol.
          </p>
          {pendingPanel}
        </section>
      ) : null}
      {role.is_system ? (
        <p className="flex items-center gap-2 rounded-lg border border-neutral-strong bg-surface-sunken px-3 py-2 text-sm">
          <Lock aria-hidden className="size-4 shrink-0" />
          Rol del sistema (PRD 2.1): no se retira ni se renombra. Sus permisos son la línea base del
          PRD 2.2 y solo cambian con doble aprobación (Aseguramiento de calidad y Dirección
          técnica); las funciones reservadas siguen con candado.
        </p>
      ) : !role.active ? (
        <p className="flex items-center gap-2 rounded-lg border border-neutral-strong bg-surface-sunken px-3 py-2 text-sm">
          <Archive aria-hidden className="size-4" />
          Rol retirado: no se asigna ni da permisos. Reactívelo para configurarlo.
        </p>
      ) : null}

      <RoleRestrictions reserved={reserved} />

      <section aria-labelledby="permisos" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="permisos" className="text-card-title">
            Permisos por módulo
          </h2>
          {!permLocked ? (
            <ReasonDialog
              trigger={
                <Button disabled={changed.length === 0}>
                  Solicitar cambio de permisos ({changed.length})
                </Button>
              }
              title={`Solicitar cambio de permisos de ${role.name}`}
              description={`Se proponen cambios en ${changed.length} módulo(s). Se aplican cuando los apruebe ${approvers}; cada celda queda en la bitácora con su antes y después.`}
              confirmLabel="Solicitar cambio"
              onConfirm={async (reason) =>
                sent(
                  await setRolePermissions({
                    code: role.code,
                    permissions: changed.map(({ module, read, create, sign, approve }) => ({
                      module,
                      read,
                      create,
                      sign,
                      approve,
                    })),
                    reason,
                  }),
                )
              }
              onDone={() => {
                setGrid(modules);
                router.refresh();
              }}
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
                    const disabled = permLocked || Boolean(res) || (role.read_only && p !== "read");
                    return (
                      <td key={p} className="px-3 py-2 text-center">
                        <label
                          className="inline-flex items-center gap-1"
                          title={
                            res
                              ? `Con candado: ${res.reason}`
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
                              aria-label={
                                res.owner_role === role.code
                                  ? "Función reservada de este rol, con candado"
                                  : `Reservado a ${res.owner_role}`
                              }
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
                    Solicitar incompatibilidades
                  </Button>
                }
                title="Solicitar roles incompatibles"
                description={`Se aplica cuando lo apruebe ${approvers}.`}
                confirmLabel="Solicitar"
                onConfirm={async (reason) =>
                  sent(await setRoleIncompatibilities({ code: role.code, others: incomp, reason }))
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
                    Solicitar cambio de datos
                  </Button>
                }
                title="Solicitar cambio de datos del rol"
                description={`Se aplica cuando lo apruebe ${approvers}.`}
                confirmLabel="Solicitar"
                onConfirm={async (reason) =>
                  sent(
                    await updateRole({
                      code: role.code,
                      name,
                      description,
                      requiresExpiry,
                      readOnly,
                      reason,
                    }),
                  )
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
                      disabled={holders > 0 || pending}
                    >
                      <Archive aria-hidden />
                      Retirar rol
                    </Button>
                  }
                  title={`Solicitar el retiro del rol ${role.name}`}
                  description="Al aprobarlo Aseguramiento de calidad, el rol deja de poder asignarse y de dar permisos. Nada se borra: su historial se conserva y puede reactivarse."
                  confirmLabel="Solicitar retiro"
                  destructive
                  onConfirm={async (reason) =>
                    sent(await setRoleActive({ code: role.code, active: false, reason }))
                  }
                  onDone={() => router.refresh()}
                />
              ) : (
                <ReasonDialog
                  trigger={
                    <Button className="justify-self-start" disabled={pending}>
                      <ArchiveRestore aria-hidden />
                      Reactivar rol
                    </Button>
                  }
                  title={`Solicitar la reactivación del rol ${role.name}`}
                  description={`Se aplica cuando lo apruebe ${approvers}.`}
                  confirmLabel="Solicitar reactivación"
                  onConfirm={async (reason) =>
                    sent(await setRoleActive({ code: role.code, active: true, reason }))
                  }
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
