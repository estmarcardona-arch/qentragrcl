"use client";

import { CircleX, KeyRound, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelRoleChange, decideRoleChange, type DecisionResult } from "@/lib/admin/actions";
import {
  APPROVER_LABELS,
  KIND_LABELS,
  STATUS_BADGE,
  approverRoleFor,
  cellText,
  type RoleChangeRequest,
} from "@/lib/admin/role-changes";
import { formatDateTime } from "@/lib/format";
import { ReasonDialog } from "./reason-dialog";

type Props = {
  requests: RoleChangeRequest[];
  userId: string;
  roles: readonly string[];
  moduleNames: Record<string, string>;
  roleNames: Record<string, string>;
  /** Texto cuando no hay solicitudes. */
  emptyText?: string;
};

/**
 * Solicitudes de cambio de rol (PRD 2.6). Muestra el antes y el después, quién solicitó, el motivo y
 * las aprobaciones requeridas; quien debe decidir aprueba o rechaza con su contraseña.
 */
export function RoleChangeList({
  requests,
  userId,
  roles,
  moduleNames,
  roleNames,
  emptyText,
}: Props) {
  if (requests.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-text-secondary">
        {emptyText ?? "No hay solicitudes de cambio de rol."}
      </p>
    );
  }
  return (
    <ul className="grid gap-3" aria-label="Solicitudes de cambio de rol">
      {requests.map((r) => (
        <RequestCard
          key={r.id}
          req={r}
          userId={userId}
          roles={roles}
          moduleNames={moduleNames}
          roleNames={roleNames}
        />
      ))}
    </ul>
  );
}

function RequestCard({
  req,
  userId,
  roles,
  moduleNames,
  roleNames,
}: {
  req: RoleChangeRequest;
  userId: string;
  roles: readonly string[];
  moduleNames: Record<string, string>;
  roleNames: Record<string, string>;
}) {
  const router = useRouter();
  const badge = STATUS_BADGE[req.status];
  const decideAs = approverRoleFor(req, userId, roles);
  const isRequester = req.requested_by === userId;
  const [decision, setDecision] = useState<"aprobada" | "rechazada" | null>(null);

  return (
    <li
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-4"
      data-testid="role-change"
      data-request={req.request_number}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <span className="font-mono text-xs text-text-muted">
            {req.request_number} · {KIND_LABELS[req.kind]}
            {req.role_is_system ? " · rol del sistema" : ""}
          </span>
          <h3 className="text-[15px] font-semibold">{req.summary}</h3>
        </div>
        <StatusBadge status={badge.status} label={badge.label} />
      </div>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-text-secondary">Solicitó</dt>
        <dd>
          {req.requested_by_name ?? "—"} · {formatDateTime(req.requested_at)}
        </dd>
        <dt className="text-text-secondary">Motivo</dt>
        <dd>{req.reason}</dd>
        {req.close_reason && req.status === "anulada" ? (
          <>
            <dt className="text-text-secondary">Anulación</dt>
            <dd>{req.close_reason}</dd>
          </>
        ) : null}
      </dl>

      <ChangeDetail req={req} moduleNames={moduleNames} roleNames={roleNames} />

      <div className="grid gap-1.5">
        <span className="text-label text-text-strong uppercase">
          {req.required_roles.length > 1 ? "Doble aprobación" : "Aprobación"}
        </span>
        <ul className="grid gap-1 text-sm">
          {req.required_roles.map((role) => {
            const a = req.approvals.find((x) => x.approver_role === role);
            return (
              <li key={role} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{APPROVER_LABELS[role] ?? role}:</span>
                {a ? (
                  <span>
                    {a.decision === "aprobada" ? "aprobó" : "rechazó"} {a.approver_name} ·{" "}
                    {formatDateTime(a.decided_at)} · «{a.reason}»
                  </span>
                ) : req.status === "pendiente" ? (
                  <span className="text-text-secondary">pendiente</span>
                ) : (
                  <span className="text-text-secondary">sin decisión</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {req.status === "pendiente" && (decideAs || isRequester) ? (
        <div className="flex flex-wrap gap-2 border-t border-divider pt-3">
          {decideAs ? (
            <>
              <Button size="sm" onClick={() => setDecision("aprobada")}>
                Aprobar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDecision("rechazada")}>
                Rechazar
              </Button>
            </>
          ) : null}
          {isRequester ? (
            <ReasonDialog
              trigger={
                <Button size="sm" variant="secondary">
                  Anular solicitud
                </Button>
              }
              title={`Anular la solicitud ${req.request_number}`}
              description="La solicitud queda anulada y el rol no cambia. Queda en la bitácora."
              confirmLabel="Anular solicitud"
              destructive
              onConfirm={(reason) => cancelRoleChange({ requestId: req.id, reason })}
              onDone={() => router.refresh()}
            />
          ) : null}
        </div>
      ) : null}
      {req.status === "pendiente" && !decideAs && !isRequester ? (
        <p className="text-small text-text-secondary">
          {req.approvals.some((a) => a.approver === userId)
            ? "Usted ya decidió esta solicitud; la otra aprobación debe darla otra persona."
            : "Esta solicitud la aprueba otra persona con el rol indicado."}
        </p>
      ) : null}

      {decideAs && decision ? (
        <DecisionDialog
          req={req}
          decision={decision}
          approverRole={decideAs}
          onClose={() => setDecision(null)}
          onDone={() => {
            setDecision(null);
            router.refresh();
          }}
        />
      ) : null}
    </li>
  );
}

function ChangeDetail({
  req,
  moduleNames,
  roleNames,
}: {
  req: RoleChangeRequest;
  moduleNames: Record<string, string>;
  roleNames: Record<string, string>;
}) {
  const p = req.payload;
  const b = req.before;
  if (req.kind === "permissions") {
    return (
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Permisos antes y después</caption>
          <thead className="bg-surface-sunken">
            <tr>
              {["Módulo", "Antes", "Después", "PRD 2.2"].map((h) => (
                <th key={h} scope="col" className="px-3 py-1.5 text-label uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(p.permissions ?? []).map((n) => {
              const old = b.permissions?.find((x) => x.module === n.module);
              return (
                <tr key={n.module} className="border-t border-divider">
                  <th scope="row" className="px-3 py-1.5 font-normal">
                    {moduleNames[n.module] ?? n.module}
                  </th>
                  <td className="px-3 py-1.5 font-mono">{old ? cellText(old) : "—"}</td>
                  <td className="px-3 py-1.5 font-mono font-semibold">{cellText(n)}</td>
                  <td className="px-3 py-1.5 font-mono text-text-secondary">
                    {old?.prd_cell ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  if (req.kind === "incompatibilities") {
    const names = (list?: string[]) =>
      list && list.length ? list.map((c) => roleNames[c] ?? c).join(", ") : "ninguno";
    return (
      <p className="text-sm">
        Antes: {names(b.others)} · <b className="font-semibold">Después: {names(p.others)}</b>
      </p>
    );
  }
  if (req.kind === "create" || req.kind === "update") {
    const rows: [string, string | undefined, string][] = [
      ["Nombre", b.name, p.name ?? ""],
      ["Descripción", b.description, p.description || "—"],
      [
        "Vencimiento obligatorio",
        b.requires_expiry === undefined ? undefined : b.requires_expiry ? "Sí" : "No",
        p.requires_expiry ? "Sí" : "No",
      ],
      [
        "Solo lectura",
        b.read_only === undefined ? undefined : b.read_only ? "Sí" : "No",
        p.read_only ? "Sí" : "No",
      ],
    ];
    return (
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-md bg-surface-sunken px-3 py-2 text-sm">
        {rows.map(([label, before, after]) => (
          <div key={label} className="contents">
            <dt className="text-text-secondary">{label}</dt>
            <dd>
              {req.kind === "update" && before !== undefined && before !== after ? (
                <>
                  <s className="text-text-muted">{before || "—"}</s> → <b>{after}</b>
                </>
              ) : (
                after
              )}
            </dd>
          </div>
        ))}
        <dt className="text-text-secondary">Código</dt>
        <dd className="font-mono">{req.role_code}</dd>
      </dl>
    );
  }
  return null;
}

function DecisionDialog({
  req,
  decision,
  approverRole,
  onClose,
  onDone,
}: {
  req: RoleChangeRequest;
  decision: "aprobada" | "rechazada";
  approverRole: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<Exclude<DecisionResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  const approve = decision === "aprobada";
  const last =
    approve &&
    req.approvals.filter((a) => a.decision === "aprobada").length + 1 >= req.required_roles.length;

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="grid max-w-[480px] gap-4 rounded-xl p-[22px]">
        <DialogTitle className="text-xl leading-7 font-semibold">
          {approve ? "Aprobar" : "Rechazar"} {req.request_number}
        </DialogTitle>
        <DialogDescription className="text-sm text-text-secondary">
          {req.summary}. Decide como {APPROVER_LABELS[approverRole] ?? approverRole}.{" "}
          {approve
            ? last
              ? "Con su aprobación el cambio se aplica de inmediato."
              : "Falta además la otra aprobación para aplicar el cambio."
            : "La solicitud se cierra y el rol no cambia."}
        </DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await decideRoleChange({
                requestId: req.id,
                decision,
                reason: reason.trim(),
                password,
              });
              if (res.ok) onDone();
              else {
                setPassword("");
                setError(res);
              }
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="decision-reason" className="text-label uppercase">
              Motivo <span className="text-q-bad-ic">*</span>
            </Label>
            <Textarea
              id="decision-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              aria-required="true"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="decision-password" className="text-label uppercase">
              <KeyRound aria-hidden className="mr-1 inline size-3.5" />
              Contraseña <span className="text-q-bad-ic">*</span>
            </Label>
            <Input
              id="decision-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-required="true"
            />
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <Lock aria-hidden className="size-3" />
              Confirma su identidad; los intentos fallidos cuentan igual que en la firma.
            </span>
          </div>
          {error ? (
            <p
              role="alert"
              className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg"
            >
              <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {error.rule} {error.detail ? `(${error.detail}) ` : ""}
              {error.action}
              {"remaining" in error && error.remaining !== undefined
                ? ` Intentos restantes: ${error.remaining}.`
                : ""}
            </p>
          ) : null}
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={approve ? "default" : "destructive"}
              disabled={pending || !reason.trim() || !password}
            >
              {pending ? "Guardando…" : approve ? "Aprobar" : "Rechazar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
