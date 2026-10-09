"use client";

import { CircleCheck, CircleX, Copy, Mail } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteUser, type AdminResult } from "@/lib/admin/actions";
import type { RoleInfo } from "@/lib/auth/roles";
import type { AreaOption } from "./types";
import { RolePicker, type RoleChoice } from "./role-picker";

type Done = Extract<Awaited<ReturnType<typeof inviteUser>>, { ok: true }>;

export function InviteForm({ areas, roles: catalog }: { areas: AreaOption[]; roles: RoleInfo[] }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [areaId, setAreaId] = useState("");
  const [roles, setRoles] = useState<RoleChoice[]>([]);
  const [error, setError] = useState<Exclude<AdminResult, { ok: true }> | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    const subject = encodeURIComponent("Invitación a GRUFARCOL eBR");
    const body = encodeURIComponent(
      `Hola ${fullName}:\n\nTiene acceso a GRUFARCOL eBR. Abra este enlace de un solo uso (válido 24 horas) para crear su contraseña:\n\n${done.link}\n\nAdministración del sistema`,
    );
    return (
      <div
        role="status"
        className="grid max-w-2xl gap-4 rounded-[10px] border border-border bg-surface p-5"
      >
        <div className="flex items-center gap-2">
          <CircleCheck aria-hidden className="size-5 text-q-ok-ic" />
          <b className="text-base font-semibold">Invitación creada para {done.email}</b>
        </div>
        <p className="text-sm">
          Envíe este enlace de un solo uso (válido 24 horas). Al abrirlo, la persona crea su
          contraseña con la política del sistema.
        </p>
        <code
          data-testid="invite-link"
          className="rounded-md bg-surface-sunken px-3 py-2 font-mono text-xs break-all"
        >
          {done.link}
        </code>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={`mailto:${done.email}?subject=${subject}&body=${body}`}>
              <Mail aria-hidden />
              Enviar por correo
            </a>
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(done.link).then(() => setCopied(true));
            }}
          >
            <Copy aria-hidden />
            {copied ? "Copiado" : "Copiar enlace"}
          </Button>
          <Button variant="ghost" asChild>
            <Link href={`/admin/usuarios/${done.userId}`}>Ver el usuario</Link>
          </Button>
        </div>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await inviteUser({
        email,
        fullName,
        jobTitle: jobTitle || undefined,
        areaId: areaId || undefined,
        roles,
      });
      if (res.ok) {
        setError(null);
        setDone(res);
      } else setError(res);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="grid max-w-4xl gap-5 rounded-[10px] border border-border bg-surface p-5"
      noValidate
    >
      <div className="grid grid-cols-2 gap-4 max-[1279px]:grid-cols-1">
        <FormField label="Correo electrónico" required>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </FormField>
        <FormField label="Nombre completo" required>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>
        <FormField label="Cargo">
          <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </FormField>
        <FormField label="Área">
          <select
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            className="h-8 w-full rounded-lg border border-border-control bg-white px-2 text-sm"
          >
            <option value="">Sin área</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.process_code ? ` (${a.process_code})` : ""}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <RolePicker roles={catalog} value={roles} onChange={setRoles} />
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-q-bad-fg">
          <CircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error.rule} {error.detail ? `(${error.detail}) ` : ""}
          {error.action}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear invitación"}
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/admin/usuarios">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
