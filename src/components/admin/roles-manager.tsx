"use client";

import { Lock, Plus, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRole } from "@/lib/admin/actions";
import type { RoleInfo } from "@/lib/auth/roles";
import { ReasonDialog } from "./reason-dialog";

export type ReservedPermission = {
  module_name: string;
  permission: string;
  owner_role: string;
  reason: string;
};

const PERM: Record<string, string> = {
  read: "L (leer)",
  create: "C (crear)",
  sign: "F (firmar)",
  approve: "A (aprobar)",
};

/** Reglas fijas que limitan la configuración de roles (PRD 2.6), visibles para quien configura. */
export function RoleRestrictions({ reserved }: { reserved: ReservedPermission[] }) {
  return (
    <section
      aria-labelledby="restricciones"
      className="grid gap-3 rounded-[10px] border border-neutral-strong bg-surface p-4"
    >
      <h3 id="restricciones" className="flex items-center gap-2 text-[15px] font-semibold">
        <ShieldAlert aria-hidden className="size-5" />
        Permisos y restricciones de los roles (PRD 2.6)
      </h3>
      <div className="grid grid-cols-2 gap-4 text-sm max-[1279px]:grid-cols-1">
        <div className="grid content-start gap-1.5">
          <b className="font-semibold">Se puede configurar en un rol adicional</b>
          <ul className="grid list-disc content-start gap-1 pl-5 text-text-strong">
            <li>
              Permisos por módulo de la matriz: L (leer), C (crear o editar borrador), F (firmar), A
              (aprobar).
            </li>
            <li>Roles incompatibles: la misma persona no puede tenerlos a la vez.</li>
            <li>Vencimiento obligatorio al asignarlo (como el auditor).</li>
            <li>Solo lectura: el rol admite únicamente L.</li>
          </ul>
        </div>
        <div className="grid content-start gap-1.5">
          <b className="font-semibold">Restricciones fijas</b>
          <ul className="grid list-disc content-start gap-1 pl-5 text-text-strong">
            {reserved.map((r) => (
              <li key={`${r.module_name}-${r.permission}`}>
                {PERM[r.permission]} en «{r.module_name}»: reservado a{" "}
                <span className="font-mono">{r.owner_role}</span>.
              </li>
            ))}
            <li>
              Codificar y crear documentos controlados: reservado a{" "}
              <span className="font-mono">aq_doc</span> (RF-93).
            </li>
            <li>La segregación de funciones (SOD-1…SOD-10) aplica a todo rol, en cada registro.</li>
            <li>
              Los 15 roles del sistema no se retiran ni se renombran. Sus permisos (línea base del
              PRD 2.2) solo cambian con doble aprobación: Aseguramiento de calidad y Dirección
              técnica (D-40).
            </li>
            <li>Nada se borra: un rol se retira solo si nadie lo tiene asignado y vigente.</li>
            <li>
              Ningún cambio lo hace una sola persona: Administración solicita con motivo y
              Aseguramiento de calidad aprueba con su contraseña (D-39). Quien solicita no aprueba.
              Todo queda en la bitácora.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function RolesManager({
  roles,
  holders,
  reserved,
  pendingPanel,
}: {
  roles: RoleInfo[];
  holders: Record<string, number>;
  reserved: ReservedPermission[];
  /** Solicitudes pendientes de aprobación. */
  pendingPanel?: ReactNode;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [requiresExpiry, setRequiresExpiry] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  return (
    <div className="grid gap-4">
      <RoleRestrictions reserved={reserved} />
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-card-title">Roles</h2>
        <ReasonDialog
          trigger={
            <Button size="sm">
              <Plus aria-hidden />
              Crear rol
            </Button>
          }
          title="Solicitar un rol adicional"
          description="El rol se crea cuando lo apruebe Aseguramiento de calidad (D-39). Nace sin permisos; después solicite sus permisos por módulo."
          confirmLabel="Solicitar rol"
          onOpen={() => {
            setCode("");
            setName("");
            setDescription("");
            setRequiresExpiry(false);
            setReadOnly(false);
          }}
          onConfirm={async (reason) => {
            const res = await createRole({
              code,
              name,
              description,
              requiresExpiry,
              readOnly,
              reason,
            });
            if (res.ok)
              setNotice(
                `Solicitud ${res.requestNumber} enviada: el rol «${name.trim()}» se crea cuando lo apruebe Aseguramiento de calidad.`,
              );
            return res;
          }}
          onDone={() => router.refresh()}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="role-code" className="text-label uppercase">
              Código
            </Label>
            <Input
              id="role-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="p. ej. consulta_regulatorio"
              className="font-mono"
            />
            <span className="text-xs text-text-secondary">
              Minúsculas, números o «_»; de 3 a 31 caracteres. No se cambia después.
            </span>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="role-name" className="text-label uppercase">
              Nombre
            </Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="role-desc" className="text-label uppercase">
              Descripción
            </Label>
            <Input
              id="role-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requiresExpiry}
              onChange={(e) => setRequiresExpiry(e.target.checked)}
              className="size-4"
            />
            Exige fecha de vencimiento al asignarlo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
              className="size-4"
            />
            Solo lectura (únicamente L)
          </label>
        </ReasonDialog>
      </div>
      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-tram-en-curso-bd bg-tram-en-curso-bg px-3 py-2 text-sm text-tram-en-curso-fg"
        >
          {notice}
        </p>
      ) : null}
      {pendingPanel}
      <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Roles del sistema y adicionales</caption>
          <thead className="bg-surface-sunken">
            <tr>
              {["Rol", "Tipo", "Opciones", "Usuarios vigentes", "Estado", "Versión", ""].map(
                (h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-b border-border px-4 py-2.5 text-label uppercase"
                  >
                    {h || <span className="sr-only">Acciones</span>}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.code} className="border-b border-divider last:border-0">
                <th scope="row" className="px-4 py-2.5 font-normal">
                  <span className="block font-semibold">{r.name}</span>
                  <span className="font-mono text-xs text-text-muted">{r.code}</span>
                </th>
                <td className="px-4 py-2.5">
                  {r.is_system ? (
                    <span className="inline-flex items-center gap-1 text-text-secondary">
                      <Lock aria-hidden className="size-3.5" />
                      Sistema (PRD)
                    </span>
                  ) : (
                    "Adicional"
                  )}
                </td>
                <td className="px-4 py-2.5 text-small">
                  {[
                    r.requires_expiry ? "Vencimiento obligatorio" : null,
                    r.read_only ? "Solo lectura" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="px-4 py-2.5 font-mono">{holders[r.code] ?? 0}</td>
                <td className="px-4 py-2.5">
                  {r.active ? (
                    <StatusBadge status="en_curso" label="Activo" />
                  ) : (
                    <StatusBadge status="bloqueada" label="Retirado" />
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">v{r.version}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button size="sm" variant="ghost" asChild>
                    <Link
                      href={`/admin/roles/${r.code}`}
                      aria-label={`${r.is_system ? "Ver permisos de" : "Configurar"} ${r.name}`}
                    >
                      {r.is_system ? "Ver permisos" : "Configurar"}
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
