"use client";

import { CircleX, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  closeAnnulment,
  decideAnnulment,
  registerChangeRequest,
  setParentReview,
  type DocResult,
} from "@/lib/documents/actions";
import { ORIGIN_LABELS } from "@/lib/documents/labels";
import { ReauthDialog } from "./reauth-dialog";

function ErrorLine({ error }: { error: Exclude<DocResult, { ok: true }> | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg">
      <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      {error.rule} {error.detail ? `(${error.detail}) ` : ""}
      {error.action}
    </p>
  );
}

/** Nueva solicitud de cambio documental (RF-100): origen, motivo, impacto y si el cambio es técnico. */
export function NewChangeRequest({
  documents,
  people,
  canAssignAuthor,
}: {
  documents: { id: string; label: string }[];
  people: { id: string; label: string }[];
  canAssignAuthor: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    documentId: "",
    origin: "mejora",
    originRef: "",
    reason: "",
    impact: "",
    technical: false,
    authorId: "",
  });
  const [error, setError] = useState<Exclude<DocResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nueva solicitud de cambio
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grid max-w-[560px] gap-4 rounded-xl p-[22px]">
          <DialogTitle className="text-xl leading-7 font-semibold">
            Solicitud de cambio documental
          </DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Crea la versión nueva en borrador. Se cierra sola cuando esa versión queda vigente.
          </DialogDescription>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await registerChangeRequest({
                  documentId: f.documentId,
                  origin: f.origin,
                  originRef: f.originRef,
                  reason: f.reason,
                  impact: f.impact,
                  technicalChange: f.technical,
                  authorId: f.authorId || null,
                });
                if (!res.ok) return setError(res);
                setOpen(false);
                router.push(`/documentos/cambios?sc=${res.code}`);
                router.refresh();
              });
            }}
          >
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="cr-doc" className="text-label uppercase">
                Documento
              </Label>
              <select
                id="cr-doc"
                value={f.documentId}
                onChange={(e) => setF({ ...f, documentId: e.target.value })}
                className="h-10 w-full min-w-0 truncate rounded-md border border-border-control bg-white px-2.5 text-sm"
              >
                <option value="">Seleccione…</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="cr-origin" className="text-label uppercase">
                  Origen
                </Label>
                <select
                  id="cr-origin"
                  value={f.origin}
                  onChange={(e) => setF({ ...f, origin: e.target.value })}
                  className="h-10 w-full min-w-0 truncate rounded-md border border-border-control bg-white px-2.5 text-sm"
                >
                  {Object.entries(ORIGIN_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="cr-ref" className="text-label uppercase">
                  Referencia del origen
                </Label>
                <Input
                  id="cr-ref"
                  value={f.originRef}
                  onChange={(e) => setF({ ...f, originRef: e.target.value })}
                  placeholder="p. ej. DEV-2026-0017"
                />
              </div>
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="cr-reason" className="text-label uppercase">
                Motivo <span className="text-q-bad-ic">*</span>
              </Label>
              <Textarea
                id="cr-reason"
                rows={2}
                value={f.reason}
                onChange={(e) => setF({ ...f, reason: e.target.value })}
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="cr-impact" className="text-label uppercase">
                Impacto
              </Label>
              <Textarea
                id="cr-impact"
                rows={2}
                value={f.impact}
                onChange={(e) => setF({ ...f, impact: e.target.value })}
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={f.technical}
                onChange={(e) => setF({ ...f, technical: e.target.checked })}
              />
              <span>
                Cambio técnico
                <span className="block text-xs text-text-secondary">
                  Si el documento es un formato, obliga a revisar su procedimiento padre antes de
                  publicar.
                </span>
              </span>
            </label>
            {canAssignAuthor ? (
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="cr-author" className="text-label uppercase">
                  Autor de la versión nueva
                </Label>
                <select
                  id="cr-author"
                  value={f.authorId}
                  onChange={(e) => setF({ ...f, authorId: e.target.value })}
                  className="h-10 w-full min-w-0 truncate rounded-md border border-border-control bg-white px-2.5 text-sm"
                >
                  <option value="">Yo</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <ErrorLine error={error} />
            <div className="flex justify-end gap-2.5">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || !f.documentId || !f.reason.trim()}>
                {pending ? "Registrando…" : "Registrar solicitud"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Revisión del procedimiento padre de un cambio técnico (RF-100): «sin cambio» o «nueva versión». */
export function ParentReviewActions({
  changeRequestId,
  parentCode,
}: {
  changeRequestId: string;
  parentCode: string;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      <ReasonDialog
        trigger={<Button size="sm">Registrar «sin cambio»</Button>}
        title={`Revisión de ${parentCode}: sin cambio`}
        description="El procedimiento padre se revisó y no requiere una versión nueva. La justificación queda en la bitácora."
        confirmLabel="Registrar sin cambio"
        onConfirm={(note) => setParentReview({ changeRequestId, decision: "sin_cambio", note })}
        onDone={() => router.refresh()}
      />
      <ReasonDialog
        trigger={
          <Button size="sm" variant="secondary">
            Requiere nueva versión
          </Button>
        }
        title={`Revisión de ${parentCode}: nueva versión`}
        description="El procedimiento padre necesita una versión nueva; solicítela aparte. Queda registrado."
        confirmLabel="Registrar nueva versión"
        onConfirm={(note) => setParentReview({ changeRequestId, decision: "nueva_version", note })}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

/** Decisión de viabilidad (aq_dir, con contraseña) y cierre de una anulación (RF-99, AC-32). */
export function AnnulmentActions({
  annulmentId,
  code,
  docLabel,
  signer,
  canDecide,
  canClose,
}: {
  annulmentId: string;
  code: string;
  docLabel: string;
  signer: string;
  canDecide: boolean;
  canClose: boolean;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<"aprobada" | "rechazada" | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {canDecide ? (
        <>
          <Button size="sm" onClick={() => setDecision("aprobada")}>
            Aprobar anulación
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setDecision("rechazada")}>
            Rechazar
          </Button>
        </>
      ) : null}
      {canClose ? (
        <ReasonDialog
          trigger={<Button size="sm">Cerrar anulación</Button>}
          title={`Cerrar la anulación ${code}`}
          description="Exige todas las copias recogidas. El documento queda ANULADO con sello OBSOLETO, se archiva (5 años) y el listado maestro se actualiza."
          confirmLabel="Cerrar anulación"
          onConfirm={(reason) => closeAnnulment({ annulmentId, reason })}
          onDone={() => router.refresh()}
        />
      ) : null}
      {decision ? (
        <ReauthDialog
          open
          onOpenChange={(o) => !o && setDecision(null)}
          title={`${decision === "aprobada" ? "Aprobar" : "Rechazar"} la anulación ${code}`}
          summary={[{ label: "Documento", value: docLabel }]}
          signer={signer}
          reasonLabel="Motivo de la decisión"
          reasonRequired
          confirmLabel={decision === "aprobada" ? "Aprobar anulación" : "Rechazar anulación"}
          destructive={decision === "rechazada"}
          onConfirm={(password, reason) =>
            decideAnnulment({ annulmentId, decision, reason, password })
          }
          onDone={() => {
            setDecision(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
