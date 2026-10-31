"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Field, selectCls } from "@/components/equipment/equipment-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createOrder, previewOrder, type PrResult } from "@/lib/production/actions";
import type { FrozenDocument } from "@/lib/production/labels";
import { ResultError } from "./signed-action";

type Product = {
  id: string;
  code: string;
  name: string;
  profile: string;
  presentations: { id: string; name: string; net_content: number; unit: string }[];
};

const KIND: Record<string, string> = {
  formula: "Fórmula",
  especificacion: "Especificación",
  instructivo: "Instructivo de fabricación",
  plantilla: "Formato",
};

// Sugerencia: granel repartido entre las presentaciones y unidades con densidad 1,00 (Prompt 0B); se pueden ajustar.
function defaultsFor(
  p: Product | undefined,
): Record<string, { on: boolean; bulk: string; units: string }> {
  const share = p?.presentations.length ? 1 / p.presentations.length : 1;
  return Object.fromEntries(
    (p?.presentations ?? []).map((x) => {
      const bulk = Math.round(2000 * share * 10) / 10;
      return [
        x.id,
        { on: true, bulk: String(bulk), units: String(Math.floor((bulk * 1000) / x.net_content)) },
      ];
    }),
  );
}

/**
 * S-15 · Crear orden de producción: el número lo asigna el sistema (OP-AAAA-NNNN, D-11); se muestran las versiones
 * vigentes que se congelarán y, si falta alguna, el bloqueo con regla y acción (AC-07, AC-19).
 */
export function OrderForm({ products, today }: { products: Product[]; today: string }) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find((p) => p.id === productId);
  const [size, setSize] = useState("2000");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [pres, setPres] = useState(() => defaultsFor(products[0]));
  const [preview, setPreview] = useState<PrResult<{
    documents: unknown[];
    warnings: { code: string; message: string }[];
    batchSize: number;
  }> | null>(null);
  const [error, setError] = useState<Exclude<PrResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!productId) return;
    let alive = true;
    void previewOrder(productId).then((r) => {
      if (!alive) return;
      setPreview(r);
      if (r.ok && r.batchSize) setSize(String(r.batchSize));
    });
    return () => {
      alive = false;
    };
  }, [productId]);

  const docs = preview?.ok ? (preview.documents as FrozenDocument[]) : [];
  const blocked = preview && !preview.ok ? preview : null;
  return (
    <form
      aria-label="Crear orden de producción"
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createOrder({
            productId,
            batchSize: Number(size.replace(",", ".")),
            plannedDate: date,
            notes,
            presentations: (product?.presentations ?? [])
              .filter((x) => pres[x.id]?.on)
              .map((x) => ({
                presentation_id: x.id,
                bulk_qty: Number(pres[x.id].bulk.replace(",", ".")),
                units: Number(pres[x.id].units),
              })),
          });
          if (!res.ok) return setError(res);
          router.push(
            `/produccion/ordenes/${res.orderId}/documentos?nueva=${encodeURIComponent(`${res.code} · ${res.batchCode}`)}`,
          );
        });
      }}
    >
      <section className="grid gap-4 rounded-[10px] border border-border bg-surface p-5">
        <div className="grid grid-cols-4 gap-3 max-[1279px]:grid-cols-2">
          <Field id="op-product" label="Producto *">
            <select
              id="op-product"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setPres(defaultsFor(products.find((x) => x.id === e.target.value)));
              }}
              className={selectCls}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="op-number" label="Número de orden" hint="Lo asigna el sistema al crear (D-11)">
            <Input id="op-number" value="OP-AAAA-NNNN" disabled className="font-mono" />
          </Field>
          <Field id="op-size" label="Tamaño del lote (kg) *">
            <Input
              id="op-size"
              inputMode="decimal"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
          </Field>
          <Field id="op-date" label="Fecha planeada *">
            <Input
              id="op-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <p className="text-sm text-text-secondary">
          Perfil regulatorio heredado de la línea:{" "}
          <b>{product?.profile === "medicamento" ? "Medicamento" : "Cosmético"}</b>
        </p>
      </section>

      <section
        aria-labelledby="versiones"
        className="grid gap-2 rounded-[10px] border border-border bg-surface p-5"
      >
        <h2 id="versiones" className="text-card-title">
          Se usarán estas versiones aprobadas
        </h2>
        {blocked ? (
          <div
            role="alert"
            className="grid gap-1 rounded-lg border border-q-bad-bd bg-q-bad-bg px-3.5 py-3 text-sm text-q-bad-fg"
            data-testid="order-blocked"
          >
            <b>{blocked.detail ?? blocked.rule}</b>
            <span>
              {blocked.code === "NO_APPROVED_VERSION"
                ? "Solicite la aprobación al Director técnico."
                : blocked.action}
            </span>
          </div>
        ) : (
          <ul className="grid gap-1.5 text-sm" data-testid="frozen-docs">
            {docs.map((d) => (
              <li key={d.version_id} className="flex flex-wrap items-center gap-2">
                <CircleCheck aria-hidden className="size-4 text-q-ok-ic" />
                <span className="w-44 text-text-secondary">
                  {KIND[d.kind]}
                  {d.stage ? ` · ${d.stage}` : ""}
                </span>
                <span className="font-mono text-[13px] font-semibold">
                  {d.code} v{String(d.version_no).padStart(2, "0")}
                </span>
                <span className="text-text-secondary">{d.title}</span>
              </li>
            ))}
          </ul>
        )}
        {preview?.ok && preview.warnings.length ? (
          <ul className="grid gap-1 text-sm text-q-warn-fg">
            {preview.warnings.map((w) => (
              <li key={w.code} className="flex items-center gap-1.5">
                <TriangleAlert aria-hidden className="size-4" /> {w.message} (se informa a
                Aseguramiento de la calidad)
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        aria-labelledby="presentaciones"
        className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
      >
        <h2 id="presentaciones" className="text-card-title">
          Presentaciones a envasar
        </h2>
        {(product?.presentations ?? []).map((x) => {
          const v = pres[x.id] ?? { on: false, bulk: "", units: "" };
          const set = (patch: Partial<typeof v>) =>
            setPres((p) => ({ ...p, [x.id]: { ...v, ...patch } }));
          return (
            <fieldset
              key={x.id}
              className="grid grid-cols-[160px_1fr_1fr] items-end gap-3 max-[1023px]:grid-cols-1"
            >
              <legend className="sr-only">{x.name}</legend>
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={v.on}
                  onChange={(e) => set({ on: e.target.checked })}
                  className="size-5"
                />
                {x.name}
              </label>
              <Field id={`op-bulk-${x.id}`} label={`Granel asignado (kg) · ${x.name}`}>
                <Input
                  id={`op-bulk-${x.id}`}
                  inputMode="decimal"
                  disabled={!v.on}
                  value={v.bulk}
                  onChange={(e) => set({ bulk: e.target.value })}
                />
              </Field>
              <Field
                id={`op-units-${x.id}`}
                label={`Unidades teóricas · ${x.name}`}
                hint="Sugeridas con densidad 1,00 g/mL"
              >
                <Input
                  id={`op-units-${x.id}`}
                  inputMode="numeric"
                  disabled={!v.on}
                  value={v.units}
                  onChange={(e) => set({ units: e.target.value })}
                />
              </Field>
            </fieldset>
          );
        })}
        <Field id="op-notes" label="Observaciones">
          <Textarea
            id="op-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <p className="text-sm text-text-secondary">
          Se generará el lote. La orden queda en borrador; al aprobarla el Director técnico se
          generan las órdenes de etapa, las solicitudes de materiales, la orden de codificado, los
          rótulos y los registros.
        </p>
      </section>
      <ResultError error={error} />
      <div className="flex justify-end">
        <Button
          type="submit"
          size="lg"
          className="min-h-12 px-5"
          disabled={pending || Boolean(blocked) || !preview}
        >
          Crear orden y lote
        </Button>
      </div>
    </form>
  );
}
