"use client";

import { CircleX, Plus, Save, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "cn";
import { ReauthDialog } from "@/components/documents/reauth-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCOP, formatNumber } from "@/lib/format";
import {
  decideBrief,
  saveBrief,
  submitBrief,
  type BriefInput,
  type CompetitorInput,
  type RdResult,
} from "@/lib/rd/actions";

export const PROJECT_TYPES: [string, string][] = [
  ["innovador", "Innovador"],
  ["nuevo_portafolio", "Nuevo en el portafolio"],
  ["modificacion_renovacion", "Modificación o renovación"],
  ["extension_linea", "Extensión de línea"],
  ["maquila_tercero", "Maquila a tercero"],
];
export const CHANNELS: [string, string][] = [
  ["cadenas", "Cadenas"],
  ["subtiendas", "Subtiendas"],
  ["mercado_tradicional", "Mercado tradicional"],
  ["otros", "Otros"],
];
const TARGET: [string, string][] = [
  ["estrato", "Estrato"],
  ["rango_edad", "Rango de edad"],
  ["sexo", "Sexo"],
  ["ingresos", "Ingresos"],
  ["otras", "Otras características"],
  ["para_quien", "¿Para quién está diseñado?"],
  ["psicograficos", "Datos psicográficos"],
  ["actitud_compra", "Actitud de compra"],
  ["frecuencia_consumo", "Frecuencia de consumo"],
];
const SECTIONS = [
  ["identificacion", "1 Identificación"],
  ["justificacion", "2 Justificación"],
  ["competencia", "3 Competencia"],
  ["grupo", "4 Grupo objetivo"],
  ["canal", "5 Canal de distribución"],
  ["margen", "6 Margen y precio sugerido"],
  ["legal", "7 Requisitos legales y costos"],
  ["recomendaciones", "8 Recomendaciones"],
] as const;

/**
 * S-06 · Formulario de brief (RF-10): índice lateral, competencia editable con precio por mL calculado,
 * margen y precio sugerido por presentación. Comercial guarda el borrador y lo envía a I+D con su firma.
 */
export function BriefForm({
  id,
  code,
  initial,
  initialCompetitors,
  products,
  editable,
  canSubmit,
  canDecide,
  signer,
  status,
}: {
  id: string | null;
  code: string | null;
  initial: BriefInput;
  initialCompetitors: CompetitorInput[];
  products: { id: string; label: string }[];
  editable: boolean;
  canSubmit: boolean;
  canDecide: boolean;
  signer: string;
  status: string | null;
}) {
  const router = useRouter();
  const [d, setD] = useState<BriefInput>(initial);
  const [comp, setComp] = useState<CompetitorInput[]>(initialCompetitors);
  const [error, setError] = useState<Exclude<RdResult, { ok: true }> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "enviar" | "aprobado" | "devuelto">(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof BriefInput>(k: K, v: BriefInput[K]) => setD({ ...d, [k]: v });
  const ro = !editable;

  const save = (after?: () => void) =>
    start(async () => {
      const res = await saveBrief({ id, data: d, competitors: comp });
      if (!res.ok) return setError(res);
      setError(null);
      setMsg(`Borrador ${res.code} guardado.`);
      if (!id) router.replace(`/idi/briefs/${res.id}`);
      else router.refresh();
      after?.();
    });

  const field = (
    k: keyof BriefInput,
    label: string,
    opts: { area?: boolean; type?: string } = {},
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`b-${k}`} className="text-label uppercase">
        {label}
      </Label>
      {opts.area ? (
        <Textarea
          id={`b-${k}`}
          rows={3}
          disabled={ro}
          value={String(d[k] ?? "")}
          onChange={(e) => set(k, e.target.value as never)}
        />
      ) : (
        <Input
          id={`b-${k}`}
          type={opts.type ?? "text"}
          disabled={ro}
          value={d[k] == null ? "" : String(d[k])}
          onChange={(e) =>
            set(
              k,
              (opts.type === "number"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value) as never,
            )
          }
        />
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-5 max-[1279px]:grid-cols-1">
      <nav
        aria-label="Secciones del brief"
        className="sticky top-4 grid content-start gap-1 self-start max-[1279px]:static max-[1279px]:flex max-[1279px]:flex-wrap"
      >
        {SECTIONS.map(([k, l]) => (
          <a
            key={k}
            href={`#${k}`}
            className="rounded-md px-2.5 py-1.5 text-sm text-text-strong no-underline hover:bg-surface-sunken"
          >
            {l}
          </a>
        ))}
      </nav>
      <div className="grid gap-4">
        <Section id="identificacion" title="1 Identificación">
          <div className="grid grid-cols-2 gap-3 max-[1279px]:grid-cols-1">
            {field("execution_date", "Fecha de ejecución", { type: "date" })}
            {field("project_name", "Nombre del proyecto")}
            <div className="grid gap-1.5">
              <Label htmlFor="b-product" className="text-label uppercase">
                Producto
              </Label>
              <select
                id="b-product"
                disabled={ro}
                value={d.product_id ?? ""}
                onChange={(e) => set("product_id", e.target.value || null)}
                className="h-10 w-full min-w-0 rounded-md border border-border-control bg-white px-2.5 text-sm"
              >
                <option value="">Nuevo (sin producto aún)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-label text-text-strong uppercase">Categoría</legend>
              <div className="flex gap-3">
                {[
                  ["cosmetico", "Cosmético"],
                  ["medicamento", "Medicamento"],
                ].map(([v, l]) => (
                  <label key={v} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="cat"
                      disabled={ro}
                      checked={d.product_category === v}
                      onChange={() => set("product_category", v)}
                    />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-label text-text-strong uppercase">Tipo de proyecto</legend>
            <div
              className="flex flex-wrap overflow-hidden rounded-md border border-border-control"
              role="radiogroup"
            >
              {PROJECT_TYPES.map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={d.project_type === v}
                  disabled={ro}
                  onClick={() => set("project_type", v)}
                  className={cn(
                    "h-10 flex-1 px-3 text-sm font-medium",
                    d.project_type === v ? "bg-primary text-white" : "bg-white text-neutral-strong",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
        </Section>

        <Section id="justificacion" title="2 Justificación">
          {field("justification", "Justificación", { area: true })}
        </Section>

        <Section id="competencia" title="3 Competencia">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm" data-testid="competitors">
              <caption className="sr-only">Productos de la competencia</caption>
              <thead className="bg-surface-sunken">
                <tr>
                  {[
                    "Fabricante",
                    "Producto",
                    "Envase",
                    "Tapa",
                    "Etiqueta",
                    "Claims",
                    "Activos",
                    "Precio",
                    "mL",
                    "$/mL",
                    "",
                  ].map((h, i) => (
                    <th key={i} scope="col" className="px-2 py-2 text-label uppercase">
                      {h || <span className="sr-only">Quitar</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comp.map((c, i) => {
                  const up = (k: keyof CompetitorInput, v: string | number | null) =>
                    setComp(comp.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                  const ppm = c.price && c.net_content_ml ? c.price / c.net_content_ml : null;
                  return (
                    <tr key={i} className="border-t border-divider">
                      {(
                        [
                          "manufacturer",
                          "product_name",
                          "container",
                          "cap_type",
                          "label_type",
                          "claims",
                          "actives",
                        ] as const
                      ).map((k) => (
                        <td key={k} className="px-1 py-1">
                          <Input
                            aria-label={`${k} ${i + 1}`}
                            disabled={ro}
                            value={String(c[k] ?? "")}
                            onChange={(e) => up(k, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="px-1 py-1">
                        <Input
                          aria-label={`Precio ${i + 1}`}
                          type="number"
                          disabled={ro}
                          value={c.price ?? ""}
                          onChange={(e) =>
                            up("price", e.target.value === "" ? null : Number(e.target.value))
                          }
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          aria-label={`Contenido ${i + 1}`}
                          type="number"
                          disabled={ro}
                          value={c.net_content_ml ?? ""}
                          onChange={(e) =>
                            up(
                              "net_content_ml",
                              e.target.value === "" ? null : Number(e.target.value),
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-1 font-mono text-xs whitespace-nowrap">
                        {ppm == null ? "—" : `$${formatNumber(ppm, 2)}`}
                      </td>
                      <td className="px-1 py-1">
                        {!ro ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Quitar competidor ${i + 1}`}
                            onClick={() => setComp(comp.filter((_, j) => j !== i))}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!ro ? (
            <Button
              type="button"
              variant="secondary"
              className="justify-self-start"
              onClick={() => setComp([...comp, { manufacturer: "", product_name: "" }])}
            >
              <Plus aria-hidden /> Agregar competidor
            </Button>
          ) : null}
          <div className="grid grid-cols-3 gap-3 max-[1279px]:grid-cols-1">
            {(["aroma", "color", "apariencia"] as const).map((k) => (
              <div key={k} className="grid gap-1.5">
                <Label htmlFor={`b-sens-${k}`} className="text-label uppercase">
                  Sensorial: {k}
                </Label>
                <Input
                  id={`b-sens-${k}`}
                  disabled={ro}
                  value={d.sensorial[k] ?? ""}
                  onChange={(e) => set("sensorial", { ...d.sensorial, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {field("sources_description", "Fuentes de información", { area: true })}
        </Section>

        <Section id="grupo" title="4 Grupo objetivo">
          <div className="grid grid-cols-2 gap-3 max-[1279px]:grid-cols-1">
            {TARGET.map(([k, l]) => (
              <div key={k} className="grid gap-1.5">
                <Label htmlFor={`b-t-${k}`} className="text-label uppercase">
                  {l}
                </Label>
                <Input
                  id={`b-t-${k}`}
                  disabled={ro}
                  value={d.target[k] ?? ""}
                  onChange={(e) => set("target", { ...d.target, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section id="canal" title="5 Canal de distribución">
          <div className="flex flex-wrap gap-4">
            {CHANNELS.map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  disabled={ro}
                  checked={d.channels.includes(v)}
                  onChange={(e) =>
                    set(
                      "channels",
                      e.target.checked ? [...d.channels, v] : d.channels.filter((x) => x !== v),
                    )
                  }
                />
                {l}
              </label>
            ))}
          </div>
          {d.channels.includes("otros") ? field("channels_other", "¿Cuál otro canal?") : null}
        </Section>

        <Section id="margen" title="6 Margen y precio sugerido">
          <div className="grid grid-cols-3 gap-3 max-[1279px]:grid-cols-1">
            {field("margin_pct", "Margen objetivo (%)", { type: "number" })}
            {d.suggested_price_by_presentation.map((p, i) => (
              <div key={i} className="grid gap-1.5">
                <Label htmlFor={`b-price-${i}`} className="text-label uppercase">
                  Precio sugerido {p.presentation}
                </Label>
                <Input
                  id={`b-price-${i}`}
                  type="number"
                  disabled={ro}
                  value={p.price ?? ""}
                  onChange={(e) =>
                    set(
                      "suggested_price_by_presentation",
                      d.suggested_price_by_presentation.map((x, j) =>
                        j === i
                          ? { ...x, price: e.target.value === "" ? null : Number(e.target.value) }
                          : x,
                      ),
                    )
                  }
                />
                <span className="text-xs text-text-secondary">
                  {p.price && d.margin_pct != null
                    ? `Costo máximo con ${formatNumber(d.margin_pct, 0)} % de margen: ${formatCOP(Math.round(p.price * (1 - d.margin_pct / 100)))}`
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="legal" title="7 Requisitos legales y costos asociados">
          {field("legal_requirements", "Requisitos legales", { area: true })}
          {field("implementation_costs", "Costos de implementación", { area: true })}
        </Section>

        <Section id="recomendaciones" title="8 Recomendaciones y sugerencias">
          {field("recommendations", "Recomendaciones", { area: true })}
        </Section>

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
        {msg ? (
          <p role="status" className="text-sm font-medium text-tram-en-curso-fg">
            {msg}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2.5">
          {editable ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={() => save()}>
              <Save aria-hidden /> Guardar borrador
            </Button>
          ) : null}
          {editable && canSubmit && id ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() => save(() => setDialog("enviar"))}
            >
              <Send aria-hidden /> Enviar a I+D
            </Button>
          ) : null}
          {canDecide && id && status === "enviado" ? (
            <>
              <Button type="button" variant="secondary" onClick={() => setDialog("devuelto")}>
                Devolver con motivo
              </Button>
              <Button type="button" onClick={() => setDialog("aprobado")}>
                Aprobar brief
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {dialog && id ? (
        <ReauthDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={
            dialog === "enviar"
              ? `Enviar ${code} a I+D`
              : dialog === "aprobado"
                ? `Aprobar ${code}`
                : `Devolver ${code}`
          }
          meaning={dialog === "enviar" ? "Actualicé" : dialog === "aprobado" ? "Aprobé" : undefined}
          summary={[{ label: "Brief", value: `${code} · ${d.project_name}` }]}
          signer={signer}
          reasonLabel={
            dialog === "enviar"
              ? undefined
              : dialog === "devuelto"
                ? "Motivo de la devolución"
                : "Observaciones (opcional)"
          }
          reasonRequired={dialog === "devuelto"}
          confirmLabel={
            dialog === "enviar"
              ? "Firmar y enviar"
              : dialog === "aprobado"
                ? "Firmar aprobación"
                : "Devolver"
          }
          destructive={dialog === "devuelto"}
          onConfirm={(pw, reason) =>
            dialog === "enviar"
              ? submitBrief({ id, password: pw })
              : decideBrief({ id, decision: dialog, reason, password: pw })
          }
          onDone={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-t`}
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
    >
      <h2 id={`${id}-t`} className="text-card-title">
        {title}
      </h2>
      {children}
    </section>
  );
}
