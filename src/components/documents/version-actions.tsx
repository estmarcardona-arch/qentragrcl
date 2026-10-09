"use client";

import { CircleX, Download, Eye, FilePlus2, PenLine, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { publishVersion, signVersion, type DocResult } from "@/lib/documents/actions";
import { ReauthDialog } from "./reauth-dialog";

export type VersionFlags = {
  canSubmitReview: boolean;
  canReview: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canNewVersion: boolean;
  canDownloadUncontrolled: boolean;
};

/** Acciones de la versión según rol y estado (S-46). La base vuelve a validar cada una. */
export function VersionActions({
  documentId,
  versionId,
  versionNo,
  code,
  title,
  signer,
  flags,
  areas,
  defaultDistribution,
}: {
  documentId: string;
  versionId: string;
  versionNo: number;
  code: string;
  title: string;
  signer: string;
  flags: VersionFlags;
  areas: { id: string; name: string; processCode: string | null }[];
  defaultDistribution: string[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "actualizo" | "reviso" | "aprobo" | "publicar">(null);
  const [dist, setDist] = useState<string[]>(defaultDistribution);
  const v = String(versionNo).padStart(2, "0");
  const summary = [
    { label: "Documento", value: `${code} · ${title}` },
    { label: "Versión", value: v, mono: true },
  ];
  const done = () => {
    setDialog(null);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {flags.canSubmitReview ? (
        <Button onClick={() => setDialog("actualizo")}>
          <Send aria-hidden />
          Enviar a revisión
        </Button>
      ) : null}
      {flags.canReview ? (
        <Button onClick={() => setDialog("reviso")}>
          <Eye aria-hidden />
          Revisar
        </Button>
      ) : null}
      {flags.canApprove ? (
        <Button onClick={() => setDialog("aprobo")}>
          <PenLine aria-hidden />
          Aprobar
        </Button>
      ) : null}
      {flags.canPublish ? (
        <Button onClick={() => setDialog("publicar")}>Publicar como vigente y emitir copias</Button>
      ) : null}
      {flags.canNewVersion ? (
        <Button variant="secondary" asChild>
          <Link href={`/documentos/nuevo?tipo=modificacion&documento=${documentId}`}>
            <FilePlus2 aria-hidden />
            Crear nueva versión
          </Link>
        </Button>
      ) : null}
      <Button variant="secondary" asChild>
        <a href={`/documentos/${documentId}/pdf?v=${versionNo}`} target="_blank" rel="noopener">
          <Download aria-hidden />
          Descargar PDF
        </a>
      </Button>
      {flags.canDownloadUncontrolled ? (
        <Button variant="ghost" asChild>
          <a
            href={`/documentos/${documentId}/pdf?v=${versionNo}&copia=no_controlada`}
            target="_blank"
            rel="noopener"
          >
            Copia no controlada (tercero)
          </a>
        </Button>
      ) : null}

      {dialog && dialog !== "publicar" ? (
        <ReauthDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={
            dialog === "actualizo"
              ? `Enviar ${code} v${v} a revisión`
              : dialog === "reviso"
                ? `Revisar ${code} v${v}`
                : `Aprobar ${code} v${v}`
          }
          meaning={dialog === "actualizo" ? "Actualicé" : dialog === "reviso" ? "Revisé" : "Aprobé"}
          summary={summary}
          signer={signer}
          reasonLabel={dialog === "actualizo" ? undefined : "Observaciones (opcional)"}
          confirmLabel={
            dialog === "actualizo"
              ? "Firmar y enviar"
              : dialog === "reviso"
                ? "Firmar revisión"
                : "Firmar aprobación"
          }
          onConfirm={(password, reason) =>
            signVersion({ versionId, step: dialog, password, reason: reason || undefined })
          }
          onDone={done}
        />
      ) : null}
      {dialog === "publicar" ? (
        <PublishDialog
          open
          onClose={() => setDialog(null)}
          code={code}
          v={v}
          areas={areas}
          dist={dist}
          setDist={setDist}
          onConfirm={async () => {
            const res = await publishVersion({ versionId, distribution: dist });
            if (res.ok) done();
            return res;
          }}
        />
      ) : null}
    </div>
  );
}

// Publicar no lleva contraseña (la aprobación ya está firmada): elige las áreas de las copias controladas.

function PublishDialog({
  open,
  onClose,
  code,
  v,
  areas,
  dist,
  setDist,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  code: string;
  v: string;
  areas: { id: string; name: string; processCode: string | null }[];
  dist: string[];
  setDist: (d: string[]) => void;
  onConfirm: () => Promise<DocResult>;
}) {
  const [error, setError] = useState<Exclude<DocResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="grid max-w-[520px] gap-4 rounded-xl p-[22px]">
        <DialogTitle className="text-xl leading-7 font-semibold">
          Publicar {code} v{v}
        </DialogTitle>
        <DialogDescription className="text-sm text-text-secondary">
          La versión queda vigente desde hoy, la anterior pasa a obsoleta y se emiten las copias
          controladas a los procesos marcados. La fecha de revisión se calcula con la regla del tipo
          de documento.
        </DialogDescription>
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1 text-label text-text-strong uppercase">
            Copias controladas para
          </legend>
          {areas
            .filter((a) => a.processCode)
            .map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={dist.includes(a.id)}
                  onChange={(e) =>
                    setDist(e.target.checked ? [...dist, a.id] : dist.filter((x) => x !== a.id))
                  }
                />
                {a.name} <span className="font-mono text-xs text-text-muted">{a.processCode}</span>
              </label>
            ))}
        </fieldset>
        {error ? (
          <p
            role="alert"
            className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg"
          >
            <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {error.rule} {error.detail ? `(${error.detail}) ` : ""}
            {error.action}
          </p>
        ) : null}
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await onConfirm();
                if (!res.ok) setError(res);
              })
            }
          >
            {pending ? "Publicando…" : "Publicar y emitir copias"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
