"use client";

import { ArrowDown, ArrowUp, CircleX, Info, Plus, Save, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "cn";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  saveTemplateDraft,
  submitForStandardization,
  type DocResult,
  type TemplateStepInput,
} from "@/lib/documents/actions";

export type EditorStep = TemplateStepInput & { isNew?: boolean };

/**
 * Editor de plantilla de proceso del usuario master (S-43, RF-05): siempre crea o edita una versión en
 * borrador, con motivo obligatorio; la versión sigue el flujo del SGD (estandarización, revisión, aprobación).
 */
export function TemplateEditor({
  stageCode,
  stageName,
  versionId,
  nextVersionNo,
  initialSteps,
  initialReason,
  checklist,
}: {
  stageCode: string;
  stageName: string;
  /** Borrador existente del usuario (null = se crea uno nuevo al guardar). */
  versionId: string | null;
  nextVersionNo: number;
  initialSteps: EditorStep[];
  initialReason: string;
  /** Despeje de línea: ítems de verificación en vez de pasos con parámetros. */
  checklist: boolean;
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<EditorStep[]>(initialSteps);
  const [sel, setSel] = useState(0);
  const [reason, setReason] = useState(initialReason);
  const [error, setError] = useState<Exclude<DocResult, { ok: true }> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cur = steps[sel];
  const update = (patch: Partial<EditorStep>) =>
    setSteps(steps.map((s, i) => (i === sel ? { ...s, ...patch } : s)));
  const move = (d: -1 | 1) => {
    const j = sel + d;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[sel], next[j]] = [next[j], next[sel]];
    setSteps(next);
    setSel(j);
  };
  const v = String(nextVersionNo).padStart(2, "0");

  const persist = (submit: boolean) =>
    start(async () => {
      setMessage(null);
      const res = await saveTemplateDraft({
        stageCode,
        versionId,
        steps: steps.map((s) => ({
          label: s.label,
          text: s.text,
          params: s.params,
          requires_equipment: s.requires_equipment,
          requires_verification: s.requires_verification,
          checklist_item: s.checklist_item,
        })),
        reason,
      });
      if (!res.ok) return setError(res);
      if (submit) {
        const r2 = await submitForStandardization({ versionId: res.versionId });
        if (!r2.ok) return setError(r2);
        setMessage(`Versión ${v} enviada a estandarización y revisión.`);
      } else setMessage(`Borrador de la versión ${v} guardado.`);
      setError(null);
      router.refresh();
    });

  return (
    <div className="grid gap-4">
      <p
        role="note"
        className="flex items-center gap-2 rounded-lg border border-primary bg-tram-revision-bg px-3.5 py-2.5 text-sm font-medium text-tram-revision-fg"
      >
        <Info aria-hidden className="size-4" />
        Está creando la versión {v} en borrador. Los lotes en curso no cambian.
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-4 max-[1279px]:grid-cols-1">
        <section
          aria-label={checklist ? "Ítems de verificación" : `Pasos de ${stageName.toLowerCase()}`}
          className="grid content-start gap-2 rounded-[10px] border border-border bg-surface p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-card-title">
              {checklist ? "Ítems de verificación" : `Pasos de ${stageName.toLowerCase()}`}
            </h2>
            <span className="text-small text-text-secondary">
              {steps.length} {checklist ? "ítems" : "pasos"}
            </span>
          </div>
          <ol className="grid min-w-0 gap-1.5" data-testid="template-steps">
            {steps.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setSel(i)}
                  aria-current={i === sel ? "true" : undefined}
                  className={cn(
                    "grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm",
                    i === sel ? "border-primary" : "border-border",
                    s.isNew
                      ? "bg-tram-revision-bg shadow-[inset_4px_0_0_var(--color-primary)]"
                      : "bg-white",
                  )}
                >
                  <span className="font-mono text-[13px] font-semibold">{s.label || i + 1}</span>
                  <span>
                    <span className="block font-medium">{s.text || "Paso sin texto"}</span>
                    <span className="text-xs text-text-secondary">
                      {[
                        s.params
                          .map(
                            (p) =>
                              `${p.name} ${p.min ?? ""}${p.max != null && p.max !== p.min ? `–${p.max}` : ""} ${p.unit} ${p.frequency}`,
                          )
                          .join(" · "),
                        s.requires_equipment ? `Equipo: ${s.requires_equipment}` : "",
                        s.requires_verification ? "Verificación de segunda persona" : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {s.isNew ? <StatusBadge status="en_curso" label="Agregado" /> : null}
                </button>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="secondary"
            className="justify-self-start"
            onClick={() => {
              setSteps([
                ...steps,
                {
                  label: String(steps.length + 1),
                  text: "",
                  params: [],
                  requires_equipment: "",
                  requires_verification: false,
                  checklist_item: checklist,
                  isNew: true,
                },
              ]);
              setSel(steps.length);
            }}
          >
            <Plus aria-hidden /> {checklist ? "Agregar ítem" : "Agregar paso"}
          </Button>
        </section>

        <aside
          aria-label="Propiedades"
          className="grid content-start gap-3 rounded-[10px] border border-border bg-surface p-4"
        >
          {cur ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-card-title">
                  {cur.label || sel + 1} · {checklist ? "Ítem" : "Paso"}
                </h2>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Subir"
                    onClick={() => move(-1)}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Bajar"
                    onClick={() => move(1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Quitar"
                    onClick={() => {
                      setSteps(steps.filter((_, i) => i !== sel));
                      setSel(Math.max(0, sel - 1));
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="st-label" className="text-label uppercase">
                    N.º
                  </Label>
                  <Input
                    id="st-label"
                    value={cur.label}
                    onChange={(e) => update({ label: e.target.value })}
                    className="font-mono"
                  />
                </div>
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="st-text" className="text-label uppercase">
                    Texto
                  </Label>
                  <Textarea
                    id="st-text"
                    rows={2}
                    value={cur.text}
                    onChange={(e) => update({ text: e.target.value })}
                  />
                </div>
              </div>
              {!checklist ? (
                <>
                  <fieldset className="grid min-w-0 gap-1.5">
                    <legend className="mb-1 text-label text-text-strong uppercase">
                      Parámetro (unidad · mínimo · máximo · frecuencia)
                    </legend>
                    {(cur.params.length
                      ? cur.params
                      : [{ name: "", unit: "", min: null, max: null, frequency: "" }]
                    )
                      .slice(0, 1)
                      .map((p, k) => (
                        <div key={k} className="grid grid-cols-2 gap-1.5">
                          <Input
                            aria-label="Nombre del parámetro"
                            placeholder="Parámetro"
                            value={p.name}
                            onChange={(e) => update({ params: [{ ...p, name: e.target.value }] })}
                          />
                          <Input
                            aria-label="Unidad"
                            placeholder="Unidad"
                            value={p.unit}
                            onChange={(e) => update({ params: [{ ...p, unit: e.target.value }] })}
                          />
                          <Input
                            aria-label="Mínimo"
                            type="number"
                            placeholder="Mínimo"
                            value={p.min ?? ""}
                            onChange={(e) =>
                              update({
                                params: [
                                  {
                                    ...p,
                                    min: e.target.value === "" ? null : Number(e.target.value),
                                  },
                                ],
                              })
                            }
                          />
                          <Input
                            aria-label="Máximo"
                            type="number"
                            placeholder="Máximo"
                            value={p.max ?? ""}
                            onChange={(e) =>
                              update({
                                params: [
                                  {
                                    ...p,
                                    max: e.target.value === "" ? null : Number(e.target.value),
                                  },
                                ],
                              })
                            }
                          />
                          <Input
                            aria-label="Frecuencia"
                            placeholder="Frecuencia"
                            className="col-span-2"
                            value={p.frequency}
                            onChange={(e) =>
                              update({ params: [{ ...p, frequency: e.target.value }] })
                            }
                          />
                        </div>
                      ))}
                  </fieldset>
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="st-eq" className="text-label uppercase">
                      Equipo exigido
                    </Label>
                    <Input
                      id="st-eq"
                      value={cur.requires_equipment}
                      onChange={(e) => update({ requires_equipment: e.target.value })}
                      placeholder="p. ej. TQ-101"
                    />
                  </div>
                </>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={cur.requires_verification}
                  onChange={(e) => update({ requires_verification: e.target.checked })}
                />
                Exige verificación de segunda persona
              </label>
            </>
          ) : (
            <p className="text-sm text-text-secondary">Agregue un paso.</p>
          )}
          <div className="grid gap-1.5 border-t border-divider pt-3">
            <Label htmlFor="tpl-reason" className="text-label uppercase">
              Motivo del cambio <span className="text-q-bad-ic">*</span>
            </Label>
            <Input
              id="tpl-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="p. ej. DEV-2026-0017 / SC-2026-0005"
              className={!reason.trim() ? "border-2 border-q-bad-ic" : ""}
            />
            {!reason.trim() ? (
              <span className="text-xs text-q-bad-fg">Falta el motivo del cambio.</span>
            ) : null}
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
          {message ? (
            <p role="status" className="text-sm font-medium text-tram-en-curso-fg">
              {message}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={pending || !reason.trim()}
              onClick={() => persist(false)}
            >
              <Save aria-hidden /> Guardar borrador
            </Button>
            <Button
              type="button"
              disabled={pending || !reason.trim()}
              onClick={() => persist(true)}
            >
              <Send aria-hidden /> Enviar a revisión
            </Button>
          </div>
          {!reason.trim() ? (
            <span className="text-xs text-text-secondary">
              Deshabilitado: escriba el motivo del cambio.
            </span>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
