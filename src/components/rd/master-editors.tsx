"use client";

import { CircleX, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  saveFormula,
  saveInstruction,
  saveSpecification,
  type ItemInput,
  type RdResult,
} from "@/lib/rd/actions";
import { SPEC_SCOPE_LABELS, STAGE_LABELS } from "@/lib/rd/labels";
import { ItemsTable, type MaterialOption } from "./prototype-editor";

type Option = { id: string; code: string; name: string };
const selectCls =
  "h-10 w-full min-w-0 truncate rounded-md border border-border-control bg-white px-2.5 text-sm";

function useSave() {
  const router = useRouter();
  const [error, setError] = useState<Exclude<RdResult, { ok: true }> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<RdResult>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setMsg(null);
        return setError(res);
      }
      setError(null);
      setMsg("Borrador guardado.");
      router.refresh();
    });
  return { error, msg, pending, run };
}

function Footer({
  s,
  editable,
  children,
}: {
  s: ReturnType<typeof useSave>;
  editable: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {s.error ? (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg">
          <CircleX aria-hidden className="mt-0.5 size-3.5" />
          {s.error.rule} {s.error.detail ? `(${s.error.detail}) ` : ""}
          {s.error.action}
        </p>
      ) : null}
      {s.msg ? (
        <p role="status" className="text-sm text-tram-en-curso-fg">
          {s.msg}
        </p>
      ) : null}
      {editable ? <div className="flex justify-end">{children}</div> : null}
    </>
  );
}

function ProductSelect({
  id,
  value,
  onChange,
  products,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  products: Option[];
  disabled: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={selectCls}
    >
      <option value="">Seleccione…</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.code} · {p.name}
        </option>
      ))}
    </select>
  );
}

/** S-07 · Fórmula maestra: producto, tamaño de lote e ingredientes (suma 100 %). */
export function FormulaEditor({
  versionId,
  editable,
  products,
  prototypes,
  materials,
  initial,
}: {
  versionId: string;
  editable: boolean;
  products: Option[];
  prototypes: Option[];
  materials: MaterialOption[];
  initial: { productId: string; batchSize: number; items: ItemInput[]; prototypeId: string | null };
}) {
  const s = useSave();
  const [productId, setProductId] = useState(initial.productId);
  const [batch, setBatch] = useState(initial.batchSize);
  const [items, setItems] = useState(initial.items);
  const [prototypeId, setPrototypeId] = useState(initial.prototypeId ?? "");
  return (
    <section
      aria-label="Fórmula"
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
    >
      <div className="grid grid-cols-3 gap-3 max-[1279px]:grid-cols-1">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="f-product" className="text-label uppercase">
            Producto
          </Label>
          <ProductSelect
            id="f-product"
            value={productId}
            onChange={setProductId}
            products={products}
            disabled={!editable}
          />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="f-proto" className="text-label uppercase">
            Prototipo de origen
          </Label>
          <select
            id="f-proto"
            value={prototypeId}
            disabled={!editable}
            onChange={(e) => setPrototypeId(e.target.value)}
            className={selectCls}
          >
            <option value="">Sin prototipo</option>
            {prototypes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-batch" className="text-label uppercase">
            Tamaño de lote (kg)
          </Label>
          <Input
            id="f-batch"
            type="number"
            step="any"
            disabled={!editable}
            value={batch}
            onChange={(e) => setBatch(Number(e.target.value))}
          />
        </div>
      </div>
      <ItemsTable
        items={items}
        setItems={setItems}
        materials={materials}
        editable={editable}
        batchSize={batch || undefined}
      />
      <Footer s={s} editable={editable}>
        <Button
          disabled={s.pending}
          onClick={() =>
            s.run(() =>
              saveFormula({
                versionId,
                productId,
                batchSize: batch,
                items: items.filter((i) => i.material_id),
                prototypeId: prototypeId || null,
                path: `/idi/formulas/${versionId}`,
              }),
            )
          }
        >
          <Save aria-hidden /> Guardar fórmula
        </Button>
      </Footer>
    </section>
  );
}

type Param = {
  name: string;
  method: string;
  min_value: number | null;
  max_value: number | null;
  unit: string;
  text_limit: string;
};
const num = (v: string) => (v === "" ? null : Number(v));

/** S-08 · Especificación: alcance, objeto y parámetros con método y límites. */
export function SpecificationEditor({
  versionId,
  editable,
  products,
  materials,
  initial,
}: {
  versionId: string;
  editable: boolean;
  products: Option[];
  materials: (Option & { type: string })[];
  initial: {
    scope: "mp" | "envase" | "granel" | "pt";
    productId: string;
    materialId: string;
    params: Param[];
  };
}) {
  const s = useSave();
  const [scope, setScope] = useState(initial.scope);
  const [productId, setProductId] = useState(initial.productId);
  const [materialId, setMaterialId] = useState(initial.materialId);
  const [params, setParams] = useState<Param[]>(initial.params);
  const byMaterial = scope === "mp" || scope === "envase";
  const up = (i: number, patch: Partial<Param>) =>
    setParams(params.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <section
      aria-label="Especificación"
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
    >
      <div className="grid grid-cols-3 gap-3 max-[1279px]:grid-cols-1">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="s-scope" className="text-label uppercase">
            Alcance
          </Label>
          <select
            id="s-scope"
            value={scope}
            disabled={!editable}
            onChange={(e) => setScope(e.target.value as typeof scope)}
            className={selectCls}
          >
            {Object.entries(SPEC_SCOPE_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="s-object" className="text-label uppercase">
            {byMaterial ? "Material" : "Producto"}
          </Label>
          {byMaterial ? (
            <select
              id="s-object"
              value={materialId}
              disabled={!editable}
              onChange={(e) => setMaterialId(e.target.value)}
              className={selectCls}
            >
              <option value="">Seleccione…</option>
              {materials
                .filter((m) => (scope === "mp" ? m.type === "mp" : m.type !== "mp"))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} · {m.name}
                  </option>
                ))}
            </select>
          ) : (
            <ProductSelect
              id="s-object"
              value={productId}
              onChange={setProductId}
              products={products}
              disabled={!editable}
            />
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm" data-testid="spec-params">
          <caption className="sr-only">Parámetros</caption>
          <thead className="bg-surface-sunken">
            <tr>
              {["Parámetro", "Método", "Mínimo", "Máximo", "Unidad", "Límite descriptivo", ""].map(
                (h, i) => (
                  <th key={i} scope="col" className="px-2 py-2 text-label uppercase">
                    {h || <span className="sr-only">Quitar</span>}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {params.map((p, i) => (
              <tr key={i} className="border-t border-divider">
                {editable ? (
                  <>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Parámetro ${i + 1}`}
                        value={p.name}
                        onChange={(e) => up(i, { name: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Método ${i + 1}`}
                        value={p.method}
                        onChange={(e) => up(i, { method: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Mínimo ${i + 1}`}
                        type="number"
                        step="any"
                        className="w-24"
                        value={p.min_value ?? ""}
                        onChange={(e) => up(i, { min_value: num(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Máximo ${i + 1}`}
                        type="number"
                        step="any"
                        className="w-24"
                        value={p.max_value ?? ""}
                        onChange={(e) => up(i, { max_value: num(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Unidad ${i + 1}`}
                        className="w-24"
                        value={p.unit}
                        onChange={(e) => up(i, { unit: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Límite descriptivo ${i + 1}`}
                        value={p.text_limit}
                        onChange={(e) => up(i, { text_limit: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Quitar parámetro ${i + 1}`}
                        onClick={() => setParams(params.filter((_, j) => j !== i))}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-2 py-1.5">{p.name}</td>
                    <td className="px-2 py-1.5">{p.method}</td>
                    <td className="px-2 py-1.5 font-mono">{p.min_value ?? "—"}</td>
                    <td className="px-2 py-1.5 font-mono">{p.max_value ?? "—"}</td>
                    <td className="px-2 py-1.5">{p.unit || "—"}</td>
                    <td className="px-2 py-1.5">{p.text_limit || "—"}</td>
                    <td />
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Footer s={s} editable={editable}>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setParams([
                ...params,
                {
                  name: "",
                  method: "",
                  min_value: null,
                  max_value: null,
                  unit: "",
                  text_limit: "",
                },
              ])
            }
          >
            <Plus aria-hidden /> Agregar parámetro
          </Button>
          <Button
            disabled={s.pending}
            onClick={() =>
              s.run(() =>
                saveSpecification({
                  versionId,
                  scope,
                  productId: byMaterial ? null : productId || null,
                  materialId: byMaterial ? materialId || null : null,
                  params: params.filter((p) => p.name),
                  path: `/idi/especificaciones/${versionId}`,
                }),
              )
            }
          >
            <Save aria-hidden /> Guardar especificación
          </Button>
        </div>
      </Footer>
    </section>
  );
}

type StepParam = {
  name: string;
  unit: string;
  min: number | null;
  max: number | null;
  frequency: string;
};
type Step = {
  label: string;
  text: string;
  requires_equipment: string;
  requires_verification: boolean;
  params: StepParam[];
};

/** S-09 · Instructivo: etapa, presentación y pasos con equipos, parámetros y verificación. */
export function InstructionEditor({
  versionId,
  editable,
  products,
  presentations,
  initial,
}: {
  versionId: string;
  editable: boolean;
  products: Option[];
  presentations: (Option & { product_id: string })[];
  initial: {
    productId: string;
    stage: "fabricacion" | "envase" | "acondicionamiento";
    presentationId: string;
    steps: Step[];
  };
}) {
  const s = useSave();
  const [productId, setProductId] = useState(initial.productId);
  const [stage, setStage] = useState(initial.stage);
  const [presentationId, setPresentationId] = useState(initial.presentationId);
  const [steps, setSteps] = useState<Step[]>(initial.steps);
  const up = (i: number, patch: Partial<Step>) =>
    setSteps(steps.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const upParam = (i: number, k: number, patch: Partial<StepParam>) =>
    up(i, { params: steps[i].params.map((p, j) => (j === k ? { ...p, ...patch } : p)) });
  return (
    <section
      aria-label="Instructivo"
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
    >
      <div className="grid grid-cols-3 gap-3 max-[1279px]:grid-cols-1">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="i-product" className="text-label uppercase">
            Producto
          </Label>
          <ProductSelect
            id="i-product"
            value={productId}
            onChange={setProductId}
            products={products}
            disabled={!editable}
          />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="i-stage" className="text-label uppercase">
            Etapa
          </Label>
          <select
            id="i-stage"
            value={stage}
            disabled={!editable}
            onChange={(e) => setStage(e.target.value as typeof stage)}
            className={selectCls}
          >
            {Object.entries(STAGE_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="i-pres" className="text-label uppercase">
            Presentación (envase y acondicionamiento)
          </Label>
          <select
            id="i-pres"
            value={presentationId}
            disabled={!editable || stage === "fabricacion"}
            onChange={(e) => setPresentationId(e.target.value)}
            className={selectCls}
          >
            <option value="">No aplica</option>
            {presentations
              .filter((p) => p.product_id === productId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      <ol className="grid gap-3" data-testid="steps">
        {steps.map((st, i) => (
          <li key={i} className="grid gap-2 rounded-md border border-border p-3">
            <div className="grid grid-cols-[8rem_1fr_auto] items-end gap-2 max-[1279px]:grid-cols-1">
              <div className="grid gap-1">
                <Label htmlFor={`st-l-${i}`} className="text-label uppercase">
                  Paso
                </Label>
                <Input
                  id={`st-l-${i}`}
                  disabled={!editable}
                  value={st.label}
                  onChange={(e) => up(i, { label: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`st-e-${i}`} className="text-label uppercase">
                  Equipo requerido
                </Label>
                <Input
                  id={`st-e-${i}`}
                  disabled={!editable}
                  value={st.requires_equipment}
                  onChange={(e) => up(i, { requires_equipment: e.target.value })}
                />
              </div>
              {editable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Quitar paso ${i + 1}`}
                  onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : (
                <span />
              )}
            </div>
            <Label htmlFor={`st-t-${i}`} className="text-label uppercase">
              Instrucción
            </Label>
            <Textarea
              id={`st-t-${i}`}
              rows={2}
              disabled={!editable}
              value={st.text}
              onChange={(e) => up(i, { text: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                disabled={!editable}
                checked={st.requires_verification}
                onChange={(e) => up(i, { requires_verification: e.target.checked })}
              />
              Requiere verificación (segunda persona)
            </label>
            {st.params.map((p, k) => (
              <div key={k} className="grid grid-cols-5 gap-2 max-[1279px]:grid-cols-2">
                <Input
                  aria-label={`Parámetro ${k + 1} del paso ${i + 1}`}
                  placeholder="Parámetro"
                  disabled={!editable}
                  value={p.name}
                  onChange={(e) => upParam(i, k, { name: e.target.value })}
                />
                <Input
                  aria-label={`Unidad ${k + 1} del paso ${i + 1}`}
                  placeholder="Unidad"
                  disabled={!editable}
                  value={p.unit}
                  onChange={(e) => upParam(i, k, { unit: e.target.value })}
                />
                <Input
                  aria-label={`Mínimo ${k + 1} del paso ${i + 1}`}
                  placeholder="Mín."
                  type="number"
                  step="any"
                  disabled={!editable}
                  value={p.min ?? ""}
                  onChange={(e) => upParam(i, k, { min: num(e.target.value) })}
                />
                <Input
                  aria-label={`Máximo ${k + 1} del paso ${i + 1}`}
                  placeholder="Máx."
                  type="number"
                  step="any"
                  disabled={!editable}
                  value={p.max ?? ""}
                  onChange={(e) => upParam(i, k, { max: num(e.target.value) })}
                />
                <Input
                  aria-label={`Frecuencia ${k + 1} del paso ${i + 1}`}
                  placeholder="Frecuencia"
                  disabled={!editable}
                  value={p.frequency}
                  onChange={(e) => upParam(i, k, { frequency: e.target.value })}
                />
              </div>
            ))}
            {editable ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-self-start"
                onClick={() =>
                  up(i, {
                    params: [
                      ...st.params,
                      { name: "", unit: "", min: null, max: null, frequency: "" },
                    ],
                  })
                }
              >
                <Plus aria-hidden /> Agregar parámetro de control
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
      <Footer s={s} editable={editable}>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setSteps([
                ...steps,
                {
                  label: String(steps.length + 1),
                  text: "",
                  requires_equipment: "",
                  requires_verification: false,
                  params: [],
                },
              ])
            }
          >
            <Plus aria-hidden /> Agregar paso
          </Button>
          <Button
            disabled={s.pending}
            onClick={() =>
              s.run(() =>
                saveInstruction({
                  versionId,
                  productId,
                  stage,
                  presentationId: stage === "fabricacion" ? null : presentationId || null,
                  steps: steps.map((x) => ({ ...x, params: x.params.filter((p) => p.name) })),
                  path: `/idi/instructivos/${versionId}`,
                }),
              )
            }
          >
            <Save aria-hidden /> Guardar instructivo
          </Button>
        </div>
      </Footer>
    </section>
  );
}
