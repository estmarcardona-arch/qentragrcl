"use client";

import { CircleCheck, CircleX, Plus, Save, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/format";
import { savePrototype, type ItemInput, type RdResult } from "@/lib/rd/actions";

export type MaterialOption = { id: string; code: string; name: string; function: string | null };

/** Tabla de ingredientes con porcentaje y suma en vivo (prototipo y fórmula). */
export function ItemsTable({
  items,
  setItems,
  materials,
  editable,
  batchSize,
}: {
  items: ItemInput[];
  setItems: (v: ItemInput[]) => void;
  materials: MaterialOption[];
  editable: boolean;
  batchSize?: number;
}) {
  const sum = items.reduce((s, i) => s + (Number(i.pct) || 0), 0);
  const ok = Math.abs(sum - 100) <= 0.001;
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm" data-testid="items">
          <caption className="sr-only">Ingredientes</caption>
          <thead className="bg-surface-sunken">
            <tr>
              {["Materia prima", "Fase", "Función", "%", batchSize ? "kg por lote" : "", ""]
                .filter((h, i) => h || i === 5)
                .map((h, i) => (
                  <th key={i} scope="col" className="px-2 py-2 text-label uppercase">
                    {h || <span className="sr-only">Quitar</span>}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const m = materials.find((x) => x.id === it.material_id);
              const up = (patch: Partial<ItemInput>) =>
                setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <tr key={i} className="border-t border-divider">
                  <td className="px-2 py-1.5">
                    {editable ? (
                      <select
                        aria-label={`Materia prima ${i + 1}`}
                        value={it.material_id}
                        onChange={(e) =>
                          up({
                            material_id: e.target.value,
                            function:
                              it.function ||
                              materials.find((x) => x.id === e.target.value)?.function ||
                              "",
                          })
                        }
                        className="h-9 w-full min-w-0 rounded-md border border-border-control bg-white px-2 text-sm"
                      >
                        <option value="">Seleccione…</option>
                        {materials.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.code} · {x.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>
                        <span className="font-mono text-xs">{m?.code}</span> {m?.name}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {editable ? (
                      <Input
                        aria-label={`Fase ${i + 1}`}
                        value={it.phase ?? ""}
                        onChange={(e) => up({ phase: e.target.value })}
                      />
                    ) : (
                      it.phase || "—"
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {editable ? (
                      <Input
                        aria-label={`Función ${i + 1}`}
                        value={it.function ?? ""}
                        onChange={(e) => up({ function: e.target.value })}
                      />
                    ) : (
                      it.function || "—"
                    )}
                  </td>
                  <td className="px-2 py-1.5 font-mono">
                    {editable ? (
                      <Input
                        aria-label={`Porcentaje ${i + 1}`}
                        type="number"
                        step="0.01"
                        value={it.pct}
                        onChange={(e) => up({ pct: Number(e.target.value) })}
                        className="w-28"
                      />
                    ) : (
                      formatNumber(Number(it.pct), 2)
                    )}
                  </td>
                  {batchSize ? (
                    <td className="px-2 py-1.5 font-mono">
                      {formatNumber((Number(it.pct) * batchSize) / 100, 2)}
                    </td>
                  ) : null}
                  <td className="px-2 py-1.5">
                    {editable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Quitar línea ${i + 1}`}
                        onClick={() => setItems(items.filter((_, j) => j !== i))}
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editable ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setItems([...items, { material_id: "", pct: 0 }])}
          >
            <Plus aria-hidden /> Agregar ingrediente
          </Button>
        ) : (
          <span />
        )}
        <span
          data-testid="sum"
          className={`flex items-center gap-1.5 text-sm font-semibold ${ok ? "text-q-ok-fg" : "text-q-bad-fg"}`}
        >
          {ok ? (
            <CircleCheck aria-hidden className="size-4" />
          ) : (
            <TriangleAlert aria-hidden className="size-4" />
          )}
          Suma {formatNumber(sum, 2)} %{ok ? "" : " — no se puede enviar"}
          {batchSize ? ` · ${formatNumber(batchSize, 2)} kg` : ""}
        </span>
      </div>
    </div>
  );
}

/** Datos e ingredientes de un prototipo en borrador (RF-15). */
export function PrototypeEditor({
  id,
  briefId,
  initial,
  initialItems,
  materials,
  editable,
}: {
  id: string | null;
  briefId: string;
  initial: {
    product_type: string;
    target_description: string;
    benefit: string;
    concept: string;
    draft_instruction: string;
  };
  initialItems: ItemInput[];
  materials: MaterialOption[];
  editable: boolean;
}) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [items, setItems] = useState<ItemInput[]>(initialItems);
  const [error, setError] = useState<Exclude<RdResult, { ok: true }> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fields: [keyof typeof d, string, boolean][] = [
    ["product_type", "Tipo de producto", false],
    ["target_description", "Público", false],
    ["benefit", "Beneficio buscado", false],
    ["concept", "Concepto propuesto", true],
    ["draft_instruction", "Instructivo de manufactura (borrador)", true],
  ];
  return (
    <section
      aria-label="Prototipo"
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
    >
      <div className="grid grid-cols-3 gap-3 max-[1279px]:grid-cols-1">
        {fields.map(([k, l, area]) => (
          <div
            key={k}
            className={`grid gap-1.5 ${area ? "col-span-3 max-[1279px]:col-span-1" : ""}`}
          >
            <Label htmlFor={`p-${k}`} className="text-label uppercase">
              {l}
            </Label>
            {area ? (
              <Textarea
                id={`p-${k}`}
                rows={3}
                disabled={!editable}
                value={d[k]}
                onChange={(e) => setD({ ...d, [k]: e.target.value })}
              />
            ) : (
              <Input
                id={`p-${k}`}
                disabled={!editable}
                value={d[k]}
                onChange={(e) => setD({ ...d, [k]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
      <h3 className="text-sm font-semibold">Ingredientes</h3>
      <ItemsTable items={items} setItems={setItems} materials={materials} editable={editable} />
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg">
          <CircleX aria-hidden className="mt-0.5 size-3.5" />
          {error.rule} {error.detail ? `(${error.detail}) ` : ""}
          {error.action}
        </p>
      ) : null}
      {msg ? (
        <p role="status" className="text-sm text-tram-en-curso-fg">
          {msg}
        </p>
      ) : null}
      {editable ? (
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await savePrototype({
                  id,
                  briefId,
                  data: d,
                  items: items.filter((x) => x.material_id),
                });
                if (!res.ok) return setError(res);
                setError(null);
                setMsg(`Prototipo ${res.code} guardado.`);
                if (!id) router.replace(`/idi/prototipos/${res.id}`);
                else router.refresh();
              })
            }
          >
            <Save aria-hidden /> {id ? "Guardar prototipo" : "Crear prototipo"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
