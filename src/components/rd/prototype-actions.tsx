"use client";

import { CircleX, FlaskConical, GitBranch, Lock, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { ReauthDialog } from "@/components/documents/reauth-dialog";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import {
  approvePrototype,
  createImprovement,
  discardPrototype,
  newMasterDocument,
  saveFormula,
  setCriteria,
  startStudy,
  type RdResult,
} from "@/lib/rd/actions";

/** Acciones del prototipo según su estado: iniciar estudio, descartar, crear mejora, crear la fórmula. */
export function PrototypeActions({
  id,
  code,
  status,
  canAuthor,
  canCreateFormula,
  productId,
}: {
  id: string;
  code: string;
  status: string;
  canAuthor: boolean;
  canCreateFormula: boolean;
  productId: string | null;
}) {
  const router = useRouter();
  const [density, setDensity] = useState(false);
  const [error, setError] = useState<Exclude<RdResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canAuthor && status === "borrador" ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={density}
                onChange={(e) => setDensity(e.target.checked)}
              />
              Se requiere densidad (picnómetro)
            </label>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await startStudy({ prototypeId: id, densityRequired: density });
                  if (!res.ok) setError(res);
                  else {
                    setError(null);
                    router.refresh();
                  }
                })
              }
            >
              <FlaskConical aria-hidden /> Iniciar estudio de estabilidad
            </Button>
          </>
        ) : null}
        {canAuthor && ["borrador", "reformular"].includes(status) ? (
          <ReasonDialog
            trigger={<Button variant="secondary">Descartar</Button>}
            title={`Descartar ${code}`}
            confirmLabel="Descartar"
            destructive
            onConfirm={(reason) => discardPrototype({ id, reason })}
            onDone={() => router.refresh()}
          />
        ) : null}
        {canAuthor && status === "reformular" ? (
          <ReasonDialog
            trigger={
              <Button>
                <GitBranch aria-hidden /> Crear mejora ({code}-…)
              </Button>
            }
            title={`Crear una mejora de ${code}`}
            description="Se crea un prototipo con el consecutivo de mejora y los mismos ingredientes, para ajustarlo."
            confirmLabel="Crear mejora"
            onConfirm={async (reason) => {
              const res = await createImprovement({ parentId: id, reason });
              if (res.ok) router.push(`/idi/prototipos/${res.id}`);
              return res;
            }}
          />
        ) : null}
        {canCreateFormula && status === "aprobado" && productId ? (
          <ReasonDialog
            trigger={
              <Button>
                <PenLine aria-hidden /> Crear la fórmula maestra desde {code}
              </Button>
            }
            title={`Fórmula maestra desde ${code}`}
            description="Se solicita el documento controlado (tipo FM) y su versión en borrador toma los ingredientes del prototipo aprobado. Sigue el flujo del SGD."
            confirmLabel="Crear fórmula"
            onConfirm={async (reason) => {
              const doc = await newMasterDocument({
                typeCode: "FM",
                title: `Fórmula maestra ${code}`,
                reason,
              });
              if (!doc.ok) return doc;
              const f = await saveFormula({
                versionId: doc.versionId,
                productId,
                batchSize: 2000,
                items: null,
                prototypeId: id,
                path: "/idi/formulas",
              });
              if (f.ok) router.push(`/idi/formulas/${doc.versionId}`);
              return f.ok ? { ok: true as const } : f;
            }}
          />
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg">
          <CircleX aria-hidden className="mt-0.5 size-3.5" />
          {error.rule} {error.detail ? `(${error.detail}) ` : ""}
          {error.action}
        </p>
      ) : null}
    </div>
  );
}

export type ApprovalView = {
  approver_role: string;
  approver_name: string;
  decided_at: string;
  client_reference: string | null;
};

/** Bloque de aprobación como fórmula (S-36): Gerencia, Dirección técnica y cliente (maquila). */
export function ApprovalBlock({
  id,
  code,
  required,
  approvals,
  blockedReason,
  myRoles,
  signer,
}: {
  id: string;
  code: string;
  required: string[];
  approvals: ApprovalView[];
  blockedReason: string | null;
  myRoles: string[];
  signer: string;
}) {
  const router = useRouter();
  const [as, setAs] = useState<null | "rol" | "cliente">(null);
  const [ref, setRef] = useState("");
  const labels: Record<string, string> = {
    gerencia: "Gerencia",
    dt: "Dirección técnica",
    cliente: "Cliente",
  };
  const pendingMine = myRoles.some(
    (r) => required.includes(r) && !approvals.some((a) => a.approver_role === r),
  );
  const clientPending =
    required.includes("cliente") &&
    !approvals.some((a) => a.approver_role === "cliente") &&
    myRoles.includes("dt");
  return (
    <section
      aria-labelledby="aprobacion"
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
      data-testid="approval-block"
    >
      <h2 id="aprobacion" className="text-card-title">
        Aprobación como fórmula
      </h2>
      <ul className="grid grid-cols-3 gap-2 max-[1279px]:grid-cols-1">
        {required.map((r) => {
          const a = approvals.find((x) => x.approver_role === r);
          return (
            <li key={r} className="grid gap-1 rounded-md border border-border p-3" data-role={r}>
              <span className="text-label text-text-secondary uppercase">{labels[r]}</span>
              {a ? (
                <span className="flex items-center gap-1.5 text-sm">
                  <Lock aria-hidden className="size-3.5" />
                  <b className="font-semibold">{a.approver_name}</b> ·{" "}
                  {formatDateTime(a.decided_at)}
                  {a.client_reference ? ` · ${a.client_reference}` : ""}
                </span>
              ) : (
                <StatusBadge status="pendiente" label="Pendiente" />
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {blockedReason ? (
          <span className="flex items-center gap-1.5 text-small text-text-secondary">
            <Lock aria-hidden className="size-3.5" />
            {blockedReason}
          </span>
        ) : null}
        {pendingMine ? (
          <Button disabled={Boolean(blockedReason)} onClick={() => setAs("rol")}>
            Aprobar como fórmula
          </Button>
        ) : null}
        {clientPending ? (
          <Button
            variant="secondary"
            disabled={Boolean(blockedReason)}
            onClick={() => setAs("cliente")}
          >
            Registrar aceptación del cliente
          </Button>
        ) : null}
      </div>
      {as ? (
        <ReauthDialog
          open
          onOpenChange={(o) => !o && setAs(null)}
          title={
            as === "cliente" ? `Aceptación del cliente de ${code}` : `Aprobar ${code} como fórmula`
          }
          summary={[{ label: "Prototipo", value: code, mono: true }]}
          signer={signer}
          reasonLabel="Observaciones (opcional)"
          confirmLabel={as === "cliente" ? "Registrar aceptación" : "Firmar aprobación"}
          onConfirm={(pw, reason) =>
            approvePrototype({
              id,
              asClient: as === "cliente",
              clientReference: ref,
              reason,
              password: pw,
            })
          }
          onDone={() => {
            setAs(null);
            router.refresh();
          }}
        >
          {as === "cliente" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="client-ref" className="text-label uppercase">
                Referencia de la aceptación del cliente
              </Label>
              <Input
                id="client-ref"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="Acta, correo o documento"
              />
            </div>
          ) : null}
        </ReauthDialog>
      ) : null}
    </section>
  );
}

export type CriteriaView = {
  ph_max_variation: number | null;
  viscosity_max_variation_pct: number | null;
  density_max_variation: number | null;
  micro_limits: { mesofilos_max?: number | null; ausentes?: string[] } | null;
  organoleptic_changes_allowed: boolean | null;
  reading_window_hours: number | null;
  notes: string | null;
} | null;

/** Criterios de cumplimiento de la estabilidad del producto (D-13), configurables y sin valores por defecto. */
export function CriteriaPanel({
  productId,
  productLabel,
  criteria,
  editable,
  path,
}: {
  productId: string;
  productLabel: string;
  criteria: CriteriaView;
  editable: boolean;
  path: string;
}) {
  const router = useRouter();
  const n = (v: number | null | undefined) => (v == null ? "" : String(v));
  const [f, setF] = useState({
    ph: n(criteria?.ph_max_variation),
    visc: n(criteria?.viscosity_max_variation_pct),
    dens: n(criteria?.density_max_variation),
    meso: n(criteria?.micro_limits?.mesofilos_max),
    window: n(criteria?.reading_window_hours),
    org:
      criteria?.organoleptic_changes_allowed == null
        ? ""
        : criteria.organoleptic_changes_allowed
          ? "si"
          : "no",
    notes: criteria?.notes ?? "",
  });
  const defined =
    criteria &&
    criteria.ph_max_variation != null &&
    criteria.viscosity_max_variation_pct != null &&
    criteria.micro_limits != null &&
    criteria.organoleptic_changes_allowed != null &&
    criteria.reading_window_hours != null;
  const num = (s: string) => (s === "" ? null : Number(s));
  const fields: [keyof typeof f, string][] = [
    ["ph", "Variación máxima de pH"],
    ["visc", "Variación máxima de viscosidad (%)"],
    ["dens", "Variación máxima de densidad (g/mL)"],
    ["meso", "Mesófilos aerobios máximo (UFC/g)"],
    ["window", "Ventana de cada lectura (± h)"],
  ];
  return (
    <section
      aria-labelledby="criterios"
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
      data-testid="criteria"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="criterios" className="text-card-title">
          Criterios de cumplimiento · {productLabel}
        </h2>
        <StatusBadge
          status={defined ? "completada" : "pendiente"}
          label={defined ? "Definidos" : "Por definir con Calidad (D-13)"}
        />
      </div>
      <p className="text-small text-text-secondary">
        Sin criterios definidos no se puede cerrar un estudio como «Cumple». P. aeruginosa, S.
        aureus y E. coli deben estar ausentes.
      </p>
      <div className="grid grid-cols-3 gap-3 max-[1279px]:grid-cols-1">
        {fields.map(([k, l]) => (
          <div key={k} className="grid gap-1.5">
            <Label htmlFor={`c-${k}`} className="text-label uppercase">
              {l}
            </Label>
            <Input
              id={`c-${k}`}
              type="number"
              step="any"
              disabled={!editable}
              value={f[k]}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
            />
          </div>
        ))}
        <div className="grid gap-1.5">
          <Label htmlFor="c-org" className="text-label uppercase">
            ¿Admite cambios organolépticos?
          </Label>
          <select
            id="c-org"
            disabled={!editable}
            value={f.org}
            onChange={(e) => setF({ ...f, org: e.target.value })}
            className="h-10 rounded-md border border-border-control bg-white px-2.5 text-sm"
          >
            <option value="">Sin definir</option>
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>
        </div>
      </div>
      {editable ? (
        <div className="flex justify-end">
          <ReasonDialog
            trigger={<Button variant="secondary">Guardar criterios</Button>}
            title="Guardar los criterios de cumplimiento"
            confirmLabel="Guardar"
            onConfirm={(reason) =>
              setCriteria({
                productId,
                reason,
                path,
                values: {
                  ph_max_variation: num(f.ph),
                  viscosity_max_variation_pct: num(f.visc),
                  density_max_variation: num(f.dens),
                  micro_limits:
                    f.meso === ""
                      ? null
                      : {
                          mesofilos_max: num(f.meso),
                          ausentes: ["pseudomonas", "staphylococcus", "ecoli"],
                        },
                  organoleptic_changes_allowed: f.org === "" ? null : f.org === "si",
                  reading_window_hours: num(f.window),
                  notes: f.notes,
                },
              })
            }
            onDone={() => router.refresh()}
          />
        </div>
      ) : null}
    </section>
  );
}
