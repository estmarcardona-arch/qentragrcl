"use client";

import { CircleX, Download, FilePlus2, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestDocument, type DocResult } from "@/lib/documents/actions";
import { CODE_EXAMPLE, SECTIONS } from "@/lib/documents/labels";

type Kind = "creacion" | "modificacion" | "anulacion";
export type Option = { id: string; label: string; code?: string };
export type TypeOption = Option & { name: string; requiresScope: boolean; isSub: boolean };

/** S-45a · El solicitante pide crear, modificar o anular; recibe la plantilla editable (sin código). */
export function RequestForm({
  areas,
  types,
  documents,
  parents,
  authorLabel,
  canAnnul,
  initial,
}: {
  areas: (Option & { processCode: string | null })[];
  types: TypeOption[];
  documents: Option[];
  parents: Option[];
  authorLabel: string;
  canAnnul: boolean;
  initial?: { kind?: Kind; documentId?: string };
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "creacion");
  const [processId, setProcessId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [parentId, setParentId] = useState("");
  const [documentId, setDocumentId] = useState(initial?.documentId ?? "");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [dist, setDist] = useState<string[]>([]);
  const [error, setError] = useState<Exclude<DocResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  const type = types.find((t) => t.id === typeId);
  const sections = SECTIONS.filter((s) => s.key !== "alcance" || !type || type.requiresScope);

  const downloadTemplate = () => {
    const body = [
      `PLANTILLA EDITABLE · ${type?.name ?? "Documento"} (estructura obligatoria, PRD 2.5.3)`,
      "Encabezado: logotipo, título, código, versión, fecha de emisión, fecha de revisión, página x de y.",
      "Redacción en infinitivo, sin términos subjetivos, con unidades del Sistema Internacional y «N.A.» cuando no aplique.",
      "",
      ...sections.flatMap((s) => [`${s.label.toUpperCase()}`, `(${s.hint})`, "", ""]),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([`﻿${body}`], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `plantilla-${(type?.name ?? "documento").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-[1279px]:grid-cols-1"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await requestDocument({
            kind,
            documentId: kind === "creacion" ? null : documentId || null,
            processId: kind === "creacion" ? processId || null : null,
            typeId: kind === "creacion" ? typeId || null : null,
            parentDocumentId: kind === "creacion" ? parentId || null : null,
            title,
            reason,
            distribution: dist,
          });
          if (!res.ok) return setError(res);
          if (res.versionId)
            router.push(`/documentos/versiones/${res.versionId}?nuevo=${res.requestCode}`);
          else router.push(`/documentos/cambios?solicitud=${res.requestCode}`);
        });
      }}
    >
      <section className="grid content-start gap-4 rounded-[10px] border border-border bg-surface p-5">
        <fieldset className="grid min-w-0 gap-1.5">
          <legend className="mb-1 text-label text-text-strong uppercase">Tipo de solicitud</legend>
          <div
            className="inline-flex w-fit overflow-hidden rounded-md border border-border-control"
            role="radiogroup"
          >
            {(
              [
                ["creacion", "Crear", FilePlus2],
                ["modificacion", "Modificar", Pencil],
                ["anulacion", "Anular", X],
              ] as const
            )
              .filter(([k]) => k !== "anulacion" || canAnnul)
              .map(([k, label, Icon]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 px-4 text-sm font-medium",
                    kind === k ? "bg-primary text-white" : "bg-white text-neutral-strong",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                  {label}
                </button>
              ))}
          </div>
        </fieldset>

        {kind === "creacion" ? (
          <div className="grid grid-cols-2 gap-4 max-[1279px]:grid-cols-1">
            <Select
              label="Proceso"
              id="req-process"
              value={processId}
              onChange={setProcessId}
              options={areas
                .filter((a) => a.processCode)
                .map((a) => [a.id, `${a.label} (${a.processCode})`])}
            />
            <Select
              label="Tipo de documento"
              id="req-type"
              value={typeId}
              onChange={setTypeId}
              options={types.map((t) => [t.id, `${t.name} (${t.code})`])}
            />
            {type?.isSub ? (
              <Select
                label="Procedimiento padre (opcional)"
                id="req-parent"
                value={parentId}
                onChange={setParentId}
                options={parents.map((p) => [p.id, p.label])}
              />
            ) : null}
            <div className="col-span-2 grid gap-1.5 max-[1279px]:col-span-1">
              <Label htmlFor="req-title" className="text-label uppercase">
                Título propuesto
              </Label>
              <input
                id="req-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 rounded-md border border-border-control bg-white px-3 text-sm"
                placeholder={type ? `${type.name} de…` : "Debe iniciar con el nombre del tipo"}
              />
              <span className="text-xs text-text-secondary">
                El título debe iniciar con el nombre del tipo («{type?.name ?? "Procedimiento"} …»).
              </span>
            </div>
          </div>
        ) : (
          <Select
            label="Documento"
            id="req-doc"
            value={documentId}
            onChange={setDocumentId}
            options={documents.map((d) => [d.id, d.label])}
          />
        )}

        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="req-reason" className="text-label uppercase">
            Motivo <span className="text-q-bad-ic">*</span>
          </Label>
          <Textarea
            id="req-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-required="true"
          />
        </div>

        {kind !== "anulacion" ? (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-label text-text-strong uppercase">
              Áreas a las que se distribuirá
            </legend>
            <div className="grid grid-cols-4 gap-2 max-[1279px]:grid-cols-2">
              {areas
                .filter((a) => a.processCode)
                .map((a) => (
                  <label
                    key={a.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm",
                      dist.includes(a.id)
                        ? "border-primary bg-tram-revision-bg"
                        : "border-border-control bg-white",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={dist.includes(a.id)}
                      onChange={(e) =>
                        setDist(e.target.checked ? [...dist, a.id] : dist.filter((x) => x !== a.id))
                      }
                    />
                    <span>
                      {a.label}{" "}
                      <span className="font-mono text-xs text-text-muted">{a.processCode}</span>
                    </span>
                  </label>
                ))}
            </div>
          </fieldset>
        ) : (
          <p className="rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm">
            La anulación la decide la dirección de Aseguramiento de la calidad; si la aprueba, se
            recogen las copias de cada proceso, se sella como OBSOLETO y se conserva 5 años.
          </p>
        )}

        <div className="grid min-w-0 gap-1.5">
          <span className="text-label text-text-strong uppercase">Autor</span>
          <span className="rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm">
            {authorLabel}
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
          </p>
        ) : null}
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={() => router.push("/documentos")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !reason.trim()}>
            {pending ? "Enviando…" : "Enviar solicitud"}
          </Button>
        </div>
      </section>

      <aside className="grid content-start gap-3 rounded-[10px] border border-border bg-surface p-5">
        <h2 className="text-card-title">Plantilla editable</h2>
        <p className="text-small text-text-secondary">
          Una solicitud no es un documento: no tiene código ni versión. El código lo asigna
          Aseguramiento de la calidad al estandarizar.
        </p>
        <ol className="grid gap-1 text-sm">
          <li className="flex gap-2">
            <span className="w-5 font-mono text-text-muted">—</span>Encabezado (logotipo, título,
            código, versión, fechas, página)
          </li>
          {sections.map((s, i) => (
            <li key={s.key} className="flex gap-2">
              <span className="w-5 font-mono text-text-muted">{i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="secondary"
          onClick={downloadTemplate}
          disabled={kind === "anulacion"}
        >
          <Download aria-hidden />
          Descargar plantilla editable
        </Button>
        <p className="text-xs text-text-secondary">{CODE_EXAMPLE}</p>
      </aside>
    </form>
  );
}

function Select({
  label,
  id,
  value,
  onChange,
  options,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: string[][];
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id} className="text-label uppercase">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full min-w-0 truncate rounded-md border border-border-control bg-white px-2.5 text-sm"
      >
        <option value="">Seleccione…</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
