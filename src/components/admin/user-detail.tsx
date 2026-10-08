"use client";

import { CircleCheck, Copy, KeyRound, Plus, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createRecoveryLink,
  grantRole,
  revokeRole,
  setRoleExpiry,
  setShortSignature,
  setUserActive,
  updateProfile,
} from "@/lib/admin/actions";
import { ROLE_LABELS, type AppRole } from "@/lib/auth/roles";
import { formatDate, formatDateTime } from "@/lib/format";
import { ReasonDialog } from "./reason-dialog";
import type { AdminUser, AreaOption } from "./types";
import { UserStatus } from "./user-status";

function toDateInput(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

export function UserDetail({
  user,
  areas,
  isSelf,
}: {
  user: AdminUser;
  areas: AreaOption[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const [fullName, setFullName] = useState(user.full_name);
  const [jobTitle, setJobTitle] = useState(user.job_title ?? "");
  const [areaId, setAreaId] = useState(user.area_id ?? "");
  const [short, setShort] = useState(user.short_signature ?? "");
  const [newRole, setNewRole] = useState<AppRole>("auditor");
  const [newExpiry, setNewExpiry] = useState("");
  const [expiry, setExpiry] = useState<Record<string, string>>({});
  const [recovery, setRecovery] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const assigned = new Set(user.roles.map((r) => r.role));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6 max-[1279px]:grid-cols-1">
      <div className="grid gap-5">
        <section
          aria-labelledby="datos"
          className="grid gap-4 rounded-[10px] border border-border bg-surface p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="datos" className="text-card-title">
              Datos del usuario
            </h2>
            <UserStatus user={user} />
          </div>
          <div className="grid grid-cols-2 gap-4 max-[1279px]:grid-cols-1">
            <div className="grid gap-1.5">
              <Label htmlFor="u-name" className="text-label uppercase">
                Nombre completo
              </Label>
              <Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-label uppercase">Correo</Label>
              <span className="text-sm leading-8">{user.email}</span>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="u-job" className="text-label uppercase">
                Cargo
              </Label>
              <Input id="u-job" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="u-area" className="text-label uppercase">
                Área
              </Label>
              <select
                id="u-area"
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="h-8 rounded-lg border border-border-control bg-white px-2 text-sm"
              >
                <option value="">Sin área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.process_code ? ` (${a.process_code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <ReasonDialog
              trigger={<Button variant="secondary">Guardar datos</Button>}
              title="Guardar datos del usuario"
              confirmLabel="Guardar"
              onConfirm={(reason) =>
                updateProfile({
                  userId: user.id,
                  fullName,
                  jobTitle,
                  areaId: areaId || null,
                  documentId: "",
                  reason,
                })
              }
              onDone={refresh}
            />
          </div>
        </section>

        <section
          aria-labelledby="roles"
          className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
        >
          <h2 id="roles" className="text-card-title">
            Roles y vigencia
          </h2>
          <p className="text-small text-text-secondary">
            La segregación de funciones se evalúa además en cada registro. Algunas combinaciones no
            se permiten (p. ej. administrador y usuario master, D-18).
          </p>
          {user.roles.length === 0 ? <p className="text-sm">Sin roles asignados.</p> : null}
          <ul className="grid gap-2">
            {user.roles.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 border-b border-divider pb-2"
              >
                <span className="min-w-56 font-semibold">{ROLE_LABELS[r.role]}</span>
                <span className="text-small text-text-secondary">
                  Desde {formatDate(r.granted_at)} ·{" "}
                  {r.expires_at
                    ? `${r.active ? "vence" : "venció"} el ${formatDate(r.expires_at)}`
                    : "sin vencimiento"}
                </span>
                {!r.active ? (
                  <span className="rounded bg-q-warn-bg px-1.5 text-xs font-semibold text-q-warn-fg">
                    Vencido
                  </span>
                ) : null}
                <span className="ml-auto flex gap-2">
                  <ReasonDialog
                    trigger={
                      <Button size="sm" variant="secondary">
                        Vigencia
                      </Button>
                    }
                    title={`Vigencia del rol ${ROLE_LABELS[r.role]}`}
                    confirmLabel="Guardar vigencia"
                    onConfirm={(reason) =>
                      setRoleExpiry({
                        userId: user.id,
                        userRoleId: r.id,
                        expiresOn: expiry[r.id] ?? toDateInput(r.expires_at) ?? undefined,
                        reason,
                      })
                    }
                    onDone={refresh}
                  >
                    <div className="grid gap-1.5">
                      <Label htmlFor={`exp-${r.id}`} className="text-label uppercase">
                        Vence el{" "}
                        {r.role === "auditor" ? "(obligatorio)" : "(vacío = sin vencimiento)"}
                      </Label>
                      <Input
                        id={`exp-${r.id}`}
                        type="date"
                        value={expiry[r.id] ?? toDateInput(r.expires_at)}
                        onChange={(e) => setExpiry({ ...expiry, [r.id]: e.target.value })}
                      />
                    </div>
                  </ReasonDialog>
                  <ReasonDialog
                    trigger={
                      <Button size="sm" variant="ghost">
                        Revocar
                      </Button>
                    }
                    title={`Revocar el rol ${ROLE_LABELS[r.role]}`}
                    confirmLabel="Revocar rol"
                    destructive
                    onConfirm={(reason) =>
                      revokeRole({ userId: user.id, userRoleId: r.id, reason })
                    }
                    onDone={refresh}
                  />
                </span>
              </li>
            ))}
          </ul>
          <ReasonDialog
            trigger={
              <Button variant="secondary" className="justify-self-start">
                <Plus aria-hidden />
                Asignar rol
              </Button>
            }
            title="Asignar rol"
            confirmLabel="Asignar"
            onConfirm={(reason) =>
              grantRole({
                userId: user.id,
                role: newRole,
                expiresOn: newExpiry || undefined,
                reason,
              })
            }
            onDone={refresh}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="new-role" className="text-label uppercase">
                Rol
              </Label>
              <select
                id="new-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AppRole)}
                className="h-9 rounded-md border border-border-control bg-white px-2 text-sm"
              >
                {(Object.keys(ROLE_LABELS) as AppRole[])
                  .filter((r) => !assigned.has(r))
                  .map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-exp" className="text-label uppercase">
                Vence el {newRole === "auditor" ? "(obligatorio)" : "(opcional)"}
              </Label>
              <Input
                id="new-exp"
                type="date"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
              />
            </div>
          </ReasonDialog>
        </section>

        <section
          aria-labelledby="firma"
          className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
        >
          <h2 id="firma" className="text-card-title">
            Registro de firma
          </h2>
          <p className="text-small text-text-secondary">
            Firma corta registrada (DI-11): inicial del primer nombre, punto y primer apellido.
            Aparece en los sellos de firma.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="u-short" className="text-label uppercase">
                Firma corta
              </Label>
              <Input
                id="u-short"
                value={short}
                onChange={(e) => setShort(e.target.value)}
                className="w-48"
              />
            </div>
            <ReasonDialog
              trigger={<Button variant="secondary">Guardar firma corta</Button>}
              title="Cambiar la firma corta"
              confirmLabel="Guardar"
              onConfirm={(reason) =>
                setShortSignature({ userId: user.id, shortSignature: short, reason })
              }
              onDone={refresh}
            />
          </div>
        </section>
      </div>

      <aside className="grid gap-4">
        <section
          aria-labelledby="acceso"
          className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
        >
          <h2 id="acceso" className="text-card-title">
            Acceso
          </h2>
          <p className="text-small text-text-secondary">
            Último ingreso: {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "nunca"}
          </p>
          {user.active ? (
            isSelf ? (
              <p className="text-small text-text-secondary">
                No puede desactivar su propio usuario.
              </p>
            ) : (
              <ReasonDialog
                trigger={
                  <Button variant="destructive">
                    <UserX aria-hidden />
                    Desactivar usuario
                  </Button>
                }
                title="Desactivar usuario"
                description="El usuario no podrá iniciar sesión. Sus registros y firmas se conservan; nunca se borra."
                confirmLabel="Desactivar"
                destructive
                onConfirm={(reason) => setUserActive({ userId: user.id, active: false, reason })}
                onDone={refresh}
              />
            )
          ) : (
            <ReasonDialog
              trigger={
                <Button>
                  <UserCheck aria-hidden />
                  Reactivar usuario
                </Button>
              }
              title="Reactivar usuario"
              confirmLabel="Reactivar"
              onConfirm={(reason) => setUserActive({ userId: user.id, active: true, reason })}
              onDone={refresh}
            />
          )}
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await createRecoveryLink({ userId: user.id, email: user.email });
                if (res.ok) {
                  setRecovery(res.link);
                  setRecoveryError(null);
                } else setRecoveryError(`${res.rule} ${res.detail ?? ""}`);
              })
            }
          >
            <KeyRound aria-hidden />
            Restablecer contraseña
          </Button>
          {recovery ? (
            <div className="grid gap-2">
              <p className="flex items-center gap-1.5 text-small">
                <CircleCheck aria-hidden className="size-4 text-q-ok-ic" />
                Enlace de un solo uso (24 horas). Entréguelo al usuario.
              </p>
              <code className="rounded bg-surface-sunken px-2 py-1 font-mono text-xs break-all">
                {recovery}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void navigator.clipboard.writeText(recovery)}
              >
                <Copy aria-hidden />
                Copiar enlace
              </Button>
            </div>
          ) : null}
          {recoveryError ? (
            <p role="alert" className="text-sm text-q-bad-fg">
              {recoveryError}
            </p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
