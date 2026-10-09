"use client";

import { CircleCheck, CircleX, Send, Save, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  previewStyle,
  saveDraft,
  submitForStandardization,
  type DocResult,
  type Observation,
} from "@/lib/documents/actions";
import { SECTIONS } from "@/lib/documents/labels";

/**
 * Editor del preliminar sobre la plantilla editable (PRD 2.5.3, 2.5.5): secciones mínimas, control
 * de cambios y revisor de redacción en vivo (la misma regla que aplica la estandarización).
 */
export function DraftEditor({
  versionId,
  typeId,
  content,
  isModification,
  changeDescription,
  technicalChange,
  isSubdocument,
  returnedObservations,
}: {
  versionId: string;
  typeId: string;
  content: Record<string, string>;
  isModification: boolean;
  changeDescription: string;
  technicalChange: boolean;
  isSubdocument: boolean;
  returnedObservations?: Observation[];
}) {
  const router = useRouter();
  const keys = Object.keys(content);
  const [values, setValues] = useState<Record<string, string>>(content);
  const [change, setChange] = useState(changeDescription);
  const [technical, setTechnical] = useState(technicalChange);
  const [obs, setObs] = useState<Observation[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<Exclude<DocResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      void previewStyle({ content: values, typeId }).then(setObs);
    }, 600);
    return () => clearTimeout(t);
  }, [values, typeId]);

  const save = (then?: () => Promise<DocResult>) =>
    start(async () => {
      setMessage(null);
      const res = await saveDraft({
        versionId,
        content: values,
        changeDescription: isModification ? change : undefined,
        technicalChange: isModification ? technical : undefined,
      });
      if (!res.ok) return setError(res);
      if (then) {
        const r2 = await then();
        if (!r2.ok) return setError(r2);
        setMessage(
          "Enviado a estandarización. Aseguramiento de la calidad revisará la estructura y la redacción.",
        );
      } else setMessage("Borrador guardado.");
      setError(null);
      router.refresh();
    });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-5 max-[1279px]:grid-cols-1">
      <section
        aria-label="Preliminar"
        className="grid content-start gap-4 rounded-[10px] border border-border bg-surface p-5"
      >
        {returnedObservations?.length ? (
          <div
            role="note"
            className="rounded-lg border border-q-bad-bd bg-q-bad-bg px-3.5 py-2.5 text-sm text-q-bad-fg"
          >
            <b className="font-semibold">
              Devuelto por Aseguramiento de la calidad con observaciones:
            </b>
            <ul className="mt-1 list-disc pl-5">
              {returnedObservations.map((o, i) => (
                <li key={i}>{o.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {SECTIONS.filter((s) => keys.includes(s.key)).map((s) => (
          <div key={s.key} className="grid gap-1.5">
            <Label htmlFor={`sec-${s.key}`} className="text-label uppercase">
              {s.label}
            </Label>
            <Textarea
              id={`sec-${s.key}`}
              rows={s.key === "desarrollo" ? 8 : 2}
              value={values[s.key] ?? ""}
              onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}
            />
            <span className="text-xs text-text-secondary">{s.hint}</span>
          </div>
        ))}
        {isModification ? (
          <div className="grid gap-3 rounded-lg border border-border bg-surface-sunken p-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="sec-change" className="text-label uppercase">
                Descripción del cambio <span className="text-q-bad-ic">*</span>
              </Label>
              <Textarea
                id="sec-change"
                rows={2}
                value={change}
                onChange={(e) => setChange(e.target.value)}
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={technical}
                onChange={(e) => setTechnical(e.target.checked)}
              />
              <span>
                Cambio técnico (afecta información técnica)
                {isSubdocument ? (
                  <span className="block text-xs text-text-secondary">
                    En un formato, un cambio técnico obliga a revisar su procedimiento padre antes
                    de publicar.
                  </span>
                ) : null}
              </span>
            </label>
          </div>
        ) : null}
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
        {message ? (
          <p role="status" className="text-sm font-medium text-tram-en-curso-fg">
            {message}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => save()}>
            <Save aria-hidden />
            Guardar borrador
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => save(() => submitForStandardization({ versionId }))}
          >
            <Send aria-hidden />
            Enviar a estandarización
          </Button>
        </div>
      </section>
      <aside
        aria-label="Revisor de redacción"
        className="grid content-start gap-2 rounded-[10px] border border-border bg-surface p-4"
      >
        <h2 className="text-card-title">Revisor de redacción</h2>
        <p className="text-small text-text-secondary">
          Secciones mínimas, verbos en infinitivo y sin términos subjetivos. Es la misma regla de la
          estandarización.
        </p>
        {obs === null ? (
          <p className="text-sm text-text-secondary">Revisando…</p>
        ) : obs.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-q-ok-fg">
            <CircleCheck aria-hidden className="size-4" /> Cumple
          </p>
        ) : (
          <ul className="grid gap-1.5" aria-label="Observaciones">
            {obs.map((o, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-q-warn-fg">
                <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                {o.message}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
