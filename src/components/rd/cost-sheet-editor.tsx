"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCOP, formatNumber } from "@/lib/format";
import { saveCostSheet } from "@/lib/rd/actions";

export type CostIngredient = {
  material_id: string;
  code: string;
  name: string;
  pct: number;
  unit_cost: number;
};
export type CostPresentation = {
  id: string;
  code: string;
  name: string;
  net_content: number;
  units: number;
};
export type CostPackaging = {
  presentation_id: string;
  kind: string;
  description: string;
  unit_cost: number;
  qty: number;
};

const KINDS: Record<string, string> = {
  envase: "Envase",
  tapa: "Tapa",
  etiqueta: "Etiqueta",
  plegadiza: "Plegadiza",
  caja: "Caja",
  otro: "Otro",
};

/** S-37 · Hoja de costos: granel ($/kg × kg), unidad terminada por presentación y lote industrial, en vivo. */
export function CostSheetEditor({
  formulaId,
  editable,
  exists,
  initial,
}: {
  formulaId: string;
  editable: boolean;
  exists: boolean;
  initial: {
    batchSize: number;
    density: number;
    ingredients: CostIngredient[];
    presentations: CostPresentation[];
    packaging: CostPackaging[];
  };
}) {
  const router = useRouter();
  const [batch, setBatch] = useState(initial.batchSize);
  const [density, setDensity] = useState(initial.density);
  const [ing, setIng] = useState(initial.ingredients);
  const [pres, setPres] = useState(initial.presentations);
  const [pack, setPack] = useState(initial.packaging);

  const kg = (pct: number) => Math.round(((pct * batch) / 100) * 10000) / 10000;
  const bulk = ing.reduce((s, i) => s + i.unit_cost * kg(i.pct), 0);
  const perKg = batch ? bulk / batch : 0;
  const rows = pres.map((p) => {
    const bulkUnit = Math.round(Math.round(((perKg * p.net_content) / 1000) * density * 100) / 100);
    const packaging = pack
      .filter((x) => x.presentation_id === p.id)
      .reduce((s, x) => s + x.unit_cost * x.qty, 0);
    return {
      ...p,
      bulkUnit,
      packaging,
      finished: bulkUnit + packaging,
      lot: (bulkUnit + packaging) * p.units,
    };
  });
  const lot = rows.reduce((s, r) => s + r.lot, 0);

  return (
    <div className="grid gap-4">
      <section
        aria-labelledby="granel"
        className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="granel" className="text-card-title">
            Costo del granel
          </h2>
          <div className="flex gap-3">
            <div className="grid gap-1">
              <Label htmlFor="cs-batch" className="text-label uppercase">
                Lote (kg)
              </Label>
              <Input
                id="cs-batch"
                className="w-32"
                type="number"
                step="any"
                disabled={!editable}
                value={batch}
                onChange={(e) => setBatch(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="cs-dens" className="text-label uppercase">
                Densidad (g/mL)
              </Label>
              <Input
                id="cs-dens"
                className="w-32"
                type="number"
                step="0.001"
                disabled={!editable}
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm" data-testid="cost-ingredients">
            <caption className="sr-only">Ingredientes y costo</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {["Materia prima", "%", "kg", "$ / kg", "Costo"].map((h) => (
                  <th key={h} scope="col" className="px-2 py-2 text-label uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ing.map((i, n) => (
                <tr key={i.material_id} className="border-t border-divider">
                  <td className="px-2 py-1.5">
                    <span className="font-mono text-xs">{i.code}</span> {i.name}
                  </td>
                  <td className="px-2 py-1.5 font-mono">{formatNumber(i.pct, 2)}</td>
                  <td className="px-2 py-1.5 font-mono">{formatNumber(kg(i.pct), 2)}</td>
                  <td className="px-2 py-1.5">
                    {editable ? (
                      <Input
                        aria-label={`Costo por kg de ${i.code}`}
                        type="number"
                        step="any"
                        className="w-32"
                        value={i.unit_cost}
                        onChange={(e) =>
                          setIng(
                            ing.map((x, j) =>
                              j === n ? { ...x, unit_cost: Number(e.target.value) } : x,
                            ),
                          )
                        }
                      />
                    ) : (
                      <span className="font-mono">{formatCOP(i.unit_cost)}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 font-mono">
                    {formatCOP(Math.round(i.unit_cost * kg(i.pct) * 100) / 100)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-right text-sm font-semibold" data-testid="bulk-total">
          Granel: {formatCOP(Math.round(bulk))} · {formatCOP(Math.round(perKg))} por kg
        </p>
      </section>

      <section
        aria-labelledby="material"
        className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
      >
        <h2 id="material" className="text-card-title">
          Material de envase y empaque por unidad
        </h2>
        {pres.map((p) => (
          <div key={p.id} className="grid gap-2 rounded-md border border-border p-3">
            <h3 className="text-sm font-semibold">
              <span className="font-mono">{p.code}</span> · {p.name}
            </h3>
            {pack.map((x, n) =>
              x.presentation_id !== p.id ? null : (
                <div
                  key={n}
                  className="grid grid-cols-[10rem_1fr_9rem_6rem_auto] items-center gap-2 max-[1279px]:grid-cols-2"
                >
                  <select
                    aria-label="Tipo de material"
                    disabled={!editable}
                    value={x.kind}
                    onChange={(e) =>
                      setPack(pack.map((y, j) => (j === n ? { ...y, kind: e.target.value } : y)))
                    }
                    className="h-9 rounded-md border border-border-control bg-white px-2 text-sm"
                  >
                    {Object.entries(KINDS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <Input
                    aria-label="Descripción"
                    disabled={!editable}
                    value={x.description}
                    onChange={(e) =>
                      setPack(
                        pack.map((y, j) => (j === n ? { ...y, description: e.target.value } : y)),
                      )
                    }
                  />
                  <Input
                    aria-label="Costo unitario"
                    type="number"
                    step="any"
                    disabled={!editable}
                    value={x.unit_cost}
                    onChange={(e) =>
                      setPack(
                        pack.map((y, j) =>
                          j === n ? { ...y, unit_cost: Number(e.target.value) } : y,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label="Cantidad por unidad"
                    type="number"
                    step="any"
                    disabled={!editable}
                    value={x.qty}
                    onChange={(e) =>
                      setPack(
                        pack.map((y, j) => (j === n ? { ...y, qty: Number(e.target.value) } : y)),
                      )
                    }
                  />
                  {editable ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Quitar material"
                      onClick={() => setPack(pack.filter((_, j) => j !== n))}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
              ),
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {editable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setPack([
                      ...pack,
                      {
                        presentation_id: p.id,
                        kind: "envase",
                        description: "",
                        unit_cost: 0,
                        qty: 1,
                      },
                    ])
                  }
                >
                  <Plus aria-hidden /> Agregar material
                </Button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2 text-sm">
                <Label htmlFor={`u-${p.id}`}>Unidades en el lote industrial</Label>
                <Input
                  id={`u-${p.id}`}
                  className="w-28"
                  type="number"
                  disabled={!editable}
                  value={p.units}
                  onChange={(e) =>
                    setPres(
                      pres.map((y) =>
                        y.id === p.id ? { ...y, units: Number(e.target.value) } : y,
                      ),
                    )
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section
        aria-labelledby="totales"
        className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
      >
        <h2 id="totales" className="text-card-title">
          Totales
        </h2>
        <table className="w-full text-left text-sm" data-testid="cost-totals">
          <caption className="sr-only">Costo por presentación</caption>
          <thead className="bg-surface-sunken">
            <tr>
              {[
                "Presentación",
                "Granel por unidad",
                "Material",
                "Unidad terminada",
                "Unidades",
                "Costo en el lote",
              ].map((h) => (
                <th key={h} scope="col" className="px-2 py-2 text-label uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-code={r.code} className="border-t border-divider">
                <td className="px-2 py-1.5">
                  <span className="font-mono text-xs">{r.code}</span> {r.name}
                </td>
                <td className="px-2 py-1.5 font-mono">{formatCOP(r.bulkUnit)}</td>
                <td className="px-2 py-1.5 font-mono">{formatCOP(r.packaging)}</td>
                <td
                  className="px-2 py-1.5 font-mono font-semibold"
                  data-testid={`finished-${r.code}`}
                >
                  {formatCOP(r.finished)}
                </td>
                <td className="px-2 py-1.5 font-mono">{formatNumber(r.units)}</td>
                <td className="px-2 py-1.5 font-mono">{formatCOP(r.lot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-right text-base font-semibold" data-testid="lot-total">
          Lote industrial: {formatCOP(lot)}
        </p>
        {editable ? (
          <div className="flex justify-end">
            <ReasonDialog
              trigger={<Button>Guardar hoja de costos</Button>}
              title="Guardar la hoja de costos"
              description={
                exists ? "El cambio de costos queda en la bitácora con el motivo." : undefined
              }
              confirmLabel="Guardar"
              onConfirm={(reason) =>
                saveCostSheet({
                  formulaId,
                  batchSize: batch,
                  density,
                  reason,
                  path: `/idi/costos/${formulaId}`,
                  ingredientCosts: Object.fromEntries(ing.map((i) => [i.material_id, i.unit_cost])),
                  packaging: pack.filter((x) => x.unit_cost > 0 || x.description),
                  units: Object.fromEntries(pres.map((p) => [p.id, p.units])),
                })
              }
              onDone={() => router.refresh()}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
