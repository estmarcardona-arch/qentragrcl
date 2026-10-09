"use client";

import { CircleCheck, CircleX, Info, Lock, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignCode,
  runStyleCheck,
  type DocResult,
  type Observation,
} from "@/lib/documents/actions";
import { SECTIONS } from "@/lib/documents/labels";

export type CodeFormData = {
  isCreation: boolean;
  codePreview: string;
  versionNo: number;
  proposedTitle: string;
  typeName: string;
  processLabel: string;
  parentCode: string | null;
  authorLabel: string;
  validityRule: string;
  routes: { id: string; name: string; description: string; code: string }[];
  defaultRouteCode: string;
};

/** S-49 · Lista de chequeo y revisor de redacción; S-45b · asignación del código (solo aq_doc). */
export function StandardizationPanel({
  versionId,
  content,
  observations,
  checked,
  code,
}: {
  versionId: string;
  content: Record<string, string>;
  observations: Observation[];
  /** Ya registró una estandarización que cumple: sigue la asignación del código. */
  checked: boolean;
  code: CodeFormData;
}) {
  const router = useRouter();
  const [manual, setManual] = useState({ encabezado: true, unidades_si: true, na: true });
  const [error, setError] = useState<Exclude<DocResult, { ok: true }> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const has = (rule: string, section?: string) =>
    observations.some((o) => o.rule === rule && (!section || o.section === section));
  const sections = SECTIONS.filter((s) => s.key in content);
  const items: { t: string; sub: string; ok: boolean; manual?: keyof typeof manual }[] = [
    {
      t: "Encabezado completo",
      sub: "Logotipo, título, versión, fechas y página. El código se asigna al aprobar la estandarización.",
      ok: manual.encabezado,
      manual: "encabezado",
    },
    ...sections.map((s) => ({
      t: `Título mínimo: ${s.label}`,
      sub: "",
      ok: !has("seccion_minima", s.key),
    })),
    {
      t: "Redacción en infinitivo",
      sub: observations
        .filter((o) => o.rule === "infinitivo")
        .map((o) => o.message)
        .join(" "),
      ok: !has("infinitivo"),
    },
    {
      t: "Sin términos subjetivos",
      sub: observations.filter((o) => o.rule === "termino_subjetivo").length
        ? `${observations.filter((o) => o.rule === "termino_subjetivo").length} término(s) marcados`
        : "",
      ok: !has("termino_subjetivo"),
    },
    {
      t: "Unidades del Sistema Internacional",
      sub: "",
      ok: manual.unidades_si,
      manual: "unidades_si",
    },
    { t: "«N.A.» cuando no aplica", sub: "", ok: manual.na, manual: "na" },
  ];
  const okCount = items.filter((i) => i.ok).length;
  const allOk = okCount === items.length;
  const terms = observations.filter((o) => o.rule === "termino_subjetivo");

  return (
    <div className="grid gap-4">
      {!checked ? (
        <div className="grid grid-cols-2 gap-4 max-[1279px]:grid-cols-1">
          <section
            aria-labelledby="chk"
            className="grid content-start gap-2 rounded-[10px] border border-border bg-surface p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="chk" className="text-card-title">
                Lista de chequeo
              </h2>
              <span className="font-mono text-sm font-semibold">
                {okCount} de {items.length}
              </span>
            </div>
            <ul className="grid gap-1.5" data-testid="checklist">
              {items.map((i) => (
                <li
                  key={i.t}
                  className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 ${i.ok ? "border-border bg-white" : "border-q-bad-bd bg-q-bad-bg"}`}
                >
                  <span className="grid gap-0.5 text-sm">
                    <b className="font-medium">{i.t}</b>
                    {i.sub ? <span className="text-xs text-text-secondary">{i.sub}</span> : null}
                  </span>
                  {i.manual ? (
                    <label className="flex shrink-0 items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={manual[i.manual]}
                        onChange={(e) => setManual({ ...manual, [i.manual!]: e.target.checked })}
                      />
                      Cumple
                    </label>
                  ) : (
                    <StatusBadge
                      status={i.ok ? "aprobado" : "rechazado"}
                      label={i.ok ? "Cumple" : "No cumple"}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section
            aria-labelledby="red"
            className="grid content-start gap-2 rounded-[10px] border border-border bg-surface p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="red" className="text-card-title">
                Revisor de redacción
              </h2>
              <StatusBadge
                status={observations.length ? "rechazado" : "aprobado"}
                label={
                  observations.length
                    ? `No cumple · ${observations.length} observación(es)`
                    : "Cumple"
                }
              />
            </div>
            <p className="rounded-md bg-surface-sunken px-3 py-2 text-sm leading-6 whitespace-pre-line">
              <Highlighted
                text={content.desarrollo ?? ""}
                terms={terms.map((t) => /«(.+?)»/.exec(t.message)?.[1] ?? "")}
              />
            </p>
            {observations.length ? (
              <ol className="grid list-decimal gap-1 pl-5 text-sm" data-testid="observations">
                {observations.map((o, i) => (
                  <li key={i}>{o.message}</li>
                ))}
              </ol>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-q-ok-fg">
                <CircleCheck aria-hidden className="size-4" />
                Sin términos subjetivos. Redacción en infinitivo y con las secciones mínimas.
              </p>
            )}
          </section>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="grid gap-1 rounded-lg border border-q-bad-bd bg-q-bad-bg px-3.5 py-2.5 text-sm text-q-bad-fg"
        >
          <span className="flex items-start gap-1.5 font-medium">
            <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {error.rule} {error.detail ? `(${error.detail}) ` : ""}
            {error.action}
          </span>
          {error.observations?.length ? (
            <ul className="list-disc pl-6">
              {error.observations.map((o, i) => (
                <li key={i}>{o.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {message ? (
        <p
          role="status"
          className="rounded-lg border border-tram-en-curso-bd bg-tram-en-curso-bg px-3.5 py-2.5 text-sm text-tram-en-curso-fg"
        >
          {message}
        </p>
      ) : null}

      {!checked ? (
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {!allOk ? (
            <span className="flex items-center gap-1.5 text-small text-text-secondary">
              <Lock aria-hidden className="size-3.5" />
              Hay {items.length - okCount} punto(s) que no cumplen: al registrar, el preliminar se
              devuelve al solicitante con las observaciones.
            </span>
          ) : null}
          <Button
            variant={allOk ? "default" : "destructive"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await runStyleCheck({ versionId, checklist: manual });
                if (res.ok) {
                  setError(null);
                  setMessage("La estandarización cumple. Asigne el código.");
                } else {
                  setError(res);
                  setMessage(
                    res.code === "STYLE_CHECK_FAILED"
                      ? "Devuelto al solicitante con observaciones."
                      : null,
                  );
                }
                router.refresh();
              })
            }
          >
            {allOk ? <CircleCheck aria-hidden /> : <Undo2 aria-hidden />}
            {allOk
              ? "Registrar estandarización (cumple)"
              : "Devolver al solicitante con observaciones"}
          </Button>
        </div>
      ) : (
        <CodeForm versionId={versionId} data={code} onError={setError} />
      )}
    </div>
  );
}

function CodeForm({
  versionId,
  data,
  onError,
}: {
  versionId: string;
  data: CodeFormData;
  onError: (e: Exclude<DocResult, { ok: true }> | null) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(data.proposedTitle);
  const [routeCode, setRouteCode] = useState(data.defaultRouteCode);
  const [rule, setRule] = useState(data.validityRule);
  const [expiry, setExpiry] = useState("");
  const [done, setDone] = useState<{ code: string; documentId: string } | null>(null);
  const [pending, start] = useTransition();
  const titleOk = title.trim().toLowerCase().startsWith(data.typeName.toLowerCase());
  const [p, t, n] = data.codePreview.split("-");

  if (done) {
    return (
      <p
        role="status"
        className="rounded-lg border border-tram-en-curso-bd bg-tram-en-curso-bg px-3.5 py-2.5 text-sm text-tram-en-curso-fg"
      >
        Documento <b className="font-mono">{done.code}</b> versión{" "}
        {String(data.versionNo).padStart(2, "0")} codificado y en el listado maestro.{" "}
        <Link href={`/documentos/${done.documentId}`}>
          Abrir el documento para enviarlo a revisión
        </Link>
      </p>
    );
  }
  return (
    <section
      aria-labelledby="codigo"
      className="grid grid-cols-[minmax(0,1fr)_340px] gap-5 rounded-[10px] border border-border bg-surface p-5 max-[1279px]:grid-cols-1"
    >
      <div className="grid content-start gap-4">
        <h2 id="codigo" className="text-card-title">
          {data.isCreation ? "Crear documento" : "Confirmar la versión"}
        </h2>
        {data.isCreation && !data.parentCode ? (
          <div className="flex items-stretch gap-1.5" aria-label="Estructura del código">
            {[
              [p, "Proceso"],
              [t, "Tipo"],
              [n, "Consecutivo"],
            ].map(([v, k]) => (
              <span
                key={k}
                className="grid rounded-md border border-border-strong bg-surface-sunken px-3 py-1.5 text-center"
              >
                <b className="font-mono text-base">{v}</b>
                <span className="text-[11px] text-text-secondary">{k}</span>
              </span>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Locked label="Código" value={data.codePreview} tag="Automático" mono />
          <Locked
            label="Versión"
            value={String(data.versionNo).padStart(2, "0")}
            tag="Automático"
            mono
          />
          {data.isCreation ? (
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="code-title" className="text-label uppercase">
                Título
              </Label>
              <Input id="code-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <span className={`text-xs ${titleOk ? "text-text-secondary" : "text-q-bad-fg"}`}>
                El título debe iniciar con el nombre del tipo de documento: «{data.typeName}».{" "}
                {titleOk ? "Cumple." : "No cumple."}
              </span>
            </div>
          ) : null}
          <Locked label="Autor" value={data.authorLabel} />
          <Locked label="Proceso" value={data.processLabel} />
          {data.parentCode ? (
            <Locked label="Procedimiento padre" value={data.parentCode} mono />
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="code-rule" className="text-label uppercase">
              Regla de vigencia
            </Label>
            <select
              id="code-rule"
              value={rule}
              onChange={(e) => setRule(e.target.value)}
              className="h-10 rounded-md border border-border-control bg-white px-2.5 text-sm"
            >
              <option value="periodo">Periodo del tipo (3 años; especificaciones, anual)</option>
              <option value="registro_sanitario">Vigencia del registro sanitario</option>
              <option value="validacion_tecnica">Vigencia de la validación de la técnica</option>
            </select>
          </div>
          {rule !== "periodo" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="code-expiry" className="text-label uppercase">
                Vence el registro o la validación
              </Label>
              <Input
                id="code-expiry"
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </div>
          ) : null}
        </div>
      </div>
      <aside className="grid content-start gap-2">
        <h3 className="text-label text-text-strong uppercase">Ruta de aprobación</h3>
        {data.routes.map((r) => (
          <label
            key={r.id}
            className={`grid gap-0.5 rounded-md border px-3 py-2 text-sm ${routeCode === r.code ? "border-primary bg-tram-revision-bg" : "border-border bg-white"}`}
          >
            <span className="flex items-center gap-2 font-medium">
              <input
                type="radio"
                name="route"
                checked={routeCode === r.code}
                onChange={() => setRouteCode(r.code)}
              />
              {r.name}
            </span>
            <span className="text-xs text-text-secondary">{r.description}</span>
          </label>
        ))}
        <p className="flex items-start gap-1.5 text-xs text-text-secondary">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Elabora el autor (no revisa ni aprueba); revisa el jefe inmediato o Aseguramiento de la
          calidad; quien revisa sí puede aprobar.
        </p>
        <Button
          disabled={pending || (data.isCreation && !titleOk) || (rule !== "periodo" && !expiry)}
          onClick={() =>
            start(async () => {
              const res = await assignCode({
                versionId,
                title: data.isCreation ? title : undefined,
                routeId: data.routes.find((r) => r.code === routeCode)?.id,
                regulatoryExpiry: rule !== "periodo" ? expiry : null,
                validityRule: rule,
              });
              if (res.ok) {
                onError(null);
                setDone({ code: res.code, documentId: res.documentId });
                router.refresh();
              } else onError(res);
            })
          }
        >
          {data.isCreation
            ? `Crear documento (versión ${String(data.versionNo).padStart(2, "0")})`
            : "Confirmar versión codificada"}
        </Button>
      </aside>
    </section>
  );
}

function Locked({
  label,
  value,
  tag,
  mono,
}: {
  label: string;
  value: string;
  tag?: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="flex items-center gap-1.5 text-label text-text-strong uppercase">
        {label}
        {tag ? (
          <span className="rounded bg-surface-sunken px-1.5 text-[10px] text-text-secondary normal-case">
            {tag}
          </span>
        ) : null}
      </span>
      <span
        className={`flex h-10 items-center gap-1.5 rounded-md border border-border bg-surface-sunken px-3 text-sm ${mono ? "font-mono font-semibold" : ""}`}
      >
        <Lock aria-hidden className="size-3.5 text-text-muted" />
        {value}
      </span>
    </div>
  );
}

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const t = terms.filter(Boolean);
  if (!t.length || !text) return <>{text || "—"}</>;
  const re = new RegExp(
    `(${t.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  return (
    <>
      {text.split(re).map((part, i) =>
        t.some((x) => x.toLowerCase() === part.toLowerCase()) ? (
          <mark
            key={i}
            className="rounded bg-tram-en-curso-bg px-0.5 font-semibold text-tram-en-curso-fg underline decoration-wavy"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
