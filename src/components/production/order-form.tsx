"use client";

import { CircleCheck, CircleMinus, Info, Lock, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createOrder, previewOrder, type PrResult } from "@/lib/production/actions";
import { formatDate } from "@/lib/format";
import type { FrozenDocument } from "@/lib/production/labels";
import { ResultError } from "./signed-action";
import { Card, CodeChip, GmpBlock } from "./ui";
import { useHydrated } from "./use-hydrated";

type Product = {
  id: string;
  code: string;
  name: string;
  profile: string;
  presentations: { id: string; name: string; net_content: number; unit: string }[];
};

type Doc = FrozenDocument & { effective_at?: string | null };

const KIND: Record<string, string> = {
  formula: "Fórmula cualicuantitativa",
  especificacion: "Especificación de producto terminado",
  instructivo: "Instructivo de fabricación",
};
const STAGE_FORMAT: Record<string, string> = {
  despeje: "Formato de despeje de línea",
  fabricacion: "Formato de registro de fabricación",
  envase: "Formato de registro de envase",
  dispensacion: "Formato de dispensación",
  acondicionamiento: "Formato de acondicionamiento",
};

const fmt1 = (n: number) =>
  n.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt0 = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
const parse = (v: string) => Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);

// Sugerencia: granel repartido entre las presentaciones; unidades = granel ÷ contenido con densidad 1,00 (Prompt 0B).
function defaultsFor(
  p: Product | undefined,
  size: number,
): Record<string, { on: boolean; bulk: number }> {
  const share = p?.presentations.length ? 1 / p.presentations.length : 1;
  return Object.fromEntries(
    (p?.presentations ?? []).map((x) => [
      x.id,
      { on: true, bulk: Math.round(size * share * 10) / 10 },
    ]),
  );
}

/**
 * S-15 · Crear orden de producción (diseño «Producción S-15 a S-17»): 1 producto y cantidad, 2 presentaciones con el
 * granel asignado y sus unidades teóricas, 3 versiones aprobadas que se congelan; resumen de lo que se generará. El
 * número lo asigna el sistema (D-11); sin versión aprobada, bloqueo con regla y acción (AC-07, AC-19).
 */
export function OrderForm({ products, today }: { products: Product[]; today: string }) {
  const hydrated = useHydrated();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find((p) => p.id === productId);
  const [size, setSize] = useState("2.000,0");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [pres, setPres] = useState(() => defaultsFor(products[0], 2000));
  const [preview, setPreview] = useState<PrResult<{
    documents: unknown[];
    warnings: { code: string; message: string }[];
    batchSize: number;
  }> | null>(null);
  const [error, setError] = useState<Exclude<PrResult, { ok: true }> | null>(null);
  const [done, setDone] = useState<{ orderId: string; code: string; batchCode: string } | null>(
    null,
  );
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!productId) return;
    let alive = true;
    void previewOrder(productId).then((r) => {
      if (!alive) return;
      setPreview(r);
      if (r.ok && r.batchSize) setSize(fmt1(r.batchSize));
    });
    return () => {
      alive = false;
    };
  }, [productId]);

  const docs = preview?.ok ? (preview.documents as Doc[]) : [];
  const blocked = preview && !preview.ok ? preview : null;
  const total = parse(size) || 0;
  const assigned = (product?.presentations ?? [])
    .filter((x) => pres[x.id]?.on)
    .reduce((s, x) => s + (pres[x.id]?.bulk ?? 0), 0);
  const sumOk = total > 0 && Math.abs(assigned - total) < 0.05;
  const units = (x: Product["presentations"][number]) =>
    Math.floor(((pres[x.id]?.bulk ?? 0) * 1000) / x.net_content);
  const setBulk = (id: string, bulk: number) =>
    setPres((p) => ({
      ...p,
      [id]: { ...(p[id] ?? { on: true }), bulk: Math.max(0, Math.round(bulk * 10) / 10) },
    }));

  if (done) {
    return (
      <div
        className="grid grid-cols-[1fr_400px] gap-5 max-[1279px]:grid-cols-1"
        data-testid="order-created"
      >
        <p
          role="status"
          className="col-span-full flex items-center gap-2 rounded-[10px] border border-q-ok-bd bg-q-ok-bg px-4 py-3 text-sm text-q-ok-fg"
        >
          <CircleCheck aria-hidden className="size-5" /> Se creó {done.code} y el lote{" "}
          {done.batchCode}.
        </p>
        <Card className="justify-items-center py-10 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-q-ok-bg text-q-ok-fg">
            <CircleCheck aria-hidden className="size-9" />
          </span>
          <h2 className="text-[24px] leading-8 font-semibold">
            Se creó {done.code} y el lote {done.batchCode}
          </h2>
          <div className="flex gap-2">
            <CodeChip>{done.code}</CodeChip>
            <CodeChip>{done.batchCode}</CodeChip>
          </div>
          <p className="max-w-lg text-sm text-text-secondary">
            La orden quedó en borrador. Cuando se apruebe se generarán las solicitudes de
            dispensación, envase y acondicionamiento y la orden de codificado.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="min-h-12 px-5">
              <Link href={`/produccion/ordenes/${done.orderId}/documentos`}>
                Ver orden {done.code}
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="min-h-12 px-5">
              <Link href="/produccion/lotes">Ir al tablero</Link>
            </Button>
          </div>
        </Card>
        <Card title="Lo que sigue">
          <ol className="grid gap-4 text-sm">
            <li>
              <b className="font-semibold">Aprobar la orden</b>
              <span className="block text-text-secondary">
                La aprueba el Director técnico con su firma «Aprobé».
              </span>
            </li>
            <li>
              <b className="font-semibold">Se generan las solicitudes y documentos</b>
              <span className="block text-text-secondary">
                Dispensación, envase, acondicionamiento y codificado (S-38).
              </span>
            </li>
            <li>
              <b className="font-semibold">Despeje de línea verificado</b>
              <span className="block text-text-secondary">Antes de iniciar cada etapa.</span>
            </li>
          </ol>
        </Card>
      </div>
    );
  }

  return (
    <form
      aria-label="Crear orden de producción"
      className="grid grid-cols-[1fr_400px] items-start gap-5 max-[1279px]:grid-cols-1"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createOrder({
            productId,
            batchSize: total,
            plannedDate: date,
            notes,
            presentations: (product?.presentations ?? [])
              .filter((x) => pres[x.id]?.on)
              .map((x) => ({ presentation_id: x.id, bulk_qty: pres[x.id].bulk, units: units(x) })),
          });
          if (!res.ok) return setError(res);
          setError(null);
          setDone({ orderId: res.orderId, code: res.code, batchCode: res.batchCode });
        });
      }}
    >
      <div className="grid gap-5">
        <Card number={1} title="Producto y cantidad">
          <label className="grid gap-1.5 text-sm font-medium">
            <span>
              Producto <span className="text-q-bad-ic">*</span>
            </span>
            <select
              id="op-product"
              aria-label="Producto *"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setPres(
                  defaultsFor(
                    products.find((x) => x.id === e.target.value),
                    total || 2000,
                  ),
                );
              }}
              className="h-11 rounded-md border border-border-control bg-white px-3 text-[15px]"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4 max-[1023px]:grid-cols-1">
            <label className="grid gap-1.5 text-sm font-medium">
              Número de orden
              <span className="flex h-11 items-center justify-between rounded-md border border-border bg-surface-sunken px-3 font-mono text-text-secondary">
                OP-AAAA-NNNN <Lock aria-hidden className="size-4" />
              </span>
              <span className="text-xs font-normal text-text-secondary">
                Se asigna con el formato OP-AAAA-NNNN de Aseguramiento de calidad. No editable.
              </span>
            </label>
            <label className="grid content-start gap-1.5 text-sm font-medium">
              <span>
                Fecha planeada <span className="text-q-bad-ic">*</span>
              </span>
              <Input
                id="op-date"
                aria-label="Fecha planeada *"
                type="date"
                className="h-11"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="grid content-start gap-1.5 text-sm font-medium">
              <span>
                Cantidad del lote <span className="text-q-bad-ic">*</span>
              </span>
              <span className="flex">
                <Input
                  id="op-size"
                  aria-label="Tamaño del lote (kg) *"
                  inputMode="decimal"
                  className="h-11 rounded-r-none text-[16px]"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  onBlur={() => {
                    const n = parse(size);
                    if (n > 0) {
                      setSize(fmt1(n));
                      setPres(defaultsFor(product, n));
                    }
                  }}
                />
                <span className="flex h-11 items-center rounded-r-md border border-l-0 border-border-control bg-surface-sunken px-4 text-sm">
                  kg
                </span>
              </span>
            </label>
            <label className="grid content-start gap-1.5 text-sm font-medium">
              Perfil regulatorio
              <span className="flex h-11 items-center justify-between rounded-md border border-border bg-surface-sunken px-3 text-text-secondary">
                {product?.profile === "medicamento" ? "Medicamento" : "Cosmético"}{" "}
                <Lock aria-hidden className="size-4" />
              </span>
              <span className="text-xs font-normal text-text-secondary">
                Heredado del producto.
                {product?.profile === "medicamento" ? " Controles más estrictos." : ""}
              </span>
            </label>
          </div>
        </Card>

        {blocked ? (
          <GmpBlock
            testId="order-blocked"
            title="Bloqueado por regla GMP · no se puede crear la orden"
            rule={blocked.detail ?? blocked.rule}
            action={
              blocked.code === "NO_APPROVED_VERSION"
                ? "Solicite la aprobación al Director técnico."
                : blocked.action
            }
          />
        ) : null}

        <Card
          number={2}
          title="Presentaciones a envasar"
          aside={
            blocked ? (
              <StatusBadge status="sin_dato" label="Sin definir" />
            ) : (
              <StatusBadge
                status={sumOk ? "vigente" : "por_vencer"}
                label={`Suma ${fmt1(assigned)} kg · ${total ? fmt0((assigned / total) * 100) : 0} %`}
              />
            )
          }
        >
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-sunken">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-label uppercase">
                    Presentación
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-label uppercase">
                    Granel asignado (kg)
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right text-label uppercase">
                    Unidades teóricas
                  </th>
                </tr>
              </thead>
              <tbody>
                {(product?.presentations ?? []).map((x) => {
                  const v = pres[x.id] ?? { on: false, bulk: 0 };
                  return (
                    <tr key={x.id} className="border-t border-divider">
                      <td className="px-4 py-3">
                        <label className="flex items-center gap-2 font-medium">
                          <input
                            type="checkbox"
                            className="size-5"
                            checked={v.on}
                            onChange={(e) =>
                              setPres((p) => ({ ...p, [x.id]: { ...v, on: e.target.checked } }))
                            }
                          />
                          {x.name}
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon-lg"
                            aria-label={`Restar 100 kg a ${x.name}`}
                            disabled={!v.on}
                            onClick={() => setBulk(x.id, v.bulk - 100)}
                          >
                            <Minus aria-hidden />
                          </Button>
                          <Input
                            aria-label={`Granel asignado (kg) · ${x.name}`}
                            inputMode="decimal"
                            disabled={!v.on}
                            className="h-11 w-32 text-right font-mono text-[16px]"
                            value={fmt1(v.bulk)}
                            onChange={(e) => setBulk(x.id, parse(e.target.value) || 0)}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon-lg"
                            aria-label={`Sumar 100 kg a ${x.name}`}
                            disabled={!v.on}
                            onClick={() => setBulk(x.id, v.bulk + 100)}
                          >
                            <Plus aria-hidden />
                          </Button>
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-right font-mono text-[16px] font-semibold"
                        data-testid={`units-${x.name}`}
                      >
                        {v.on ? fmt0(units(x)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-text-secondary">
            {(product?.presentations ?? [])
              .map((x) => `${x.name}: ${fmt0(x.net_content)} g por unidad`)
              .join(". ")}
            . Unidades teóricas = granel asignado ÷ contenido (densidad 1,00).
          </p>
        </Card>

        <Card
          number={3}
          title={blocked ? "Versiones requeridas" : "Se usarán estas versiones aprobadas"}
          aside={
            <span className="flex items-center gap-1.5 text-sm text-text-secondary">
              <Lock aria-hidden className="size-3.5" /> El lote congela estas versiones al crearse.
            </span>
          }
        >
          {blocked ? (
            <p className="flex items-center gap-2 text-sm text-q-bad-fg">
              <CircleMinus aria-hidden className="size-4" />{" "}
              {blocked.detail ?? "Falta una versión aprobada."}
            </p>
          ) : (
            <table className="w-full text-left text-sm" data-testid="frozen-docs">
              <caption className="sr-only">Versiones que se congelan</caption>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.version_id} className="border-t border-divider first:border-0">
                    <td className="py-3 pr-3 font-medium">
                      {d.kind === "plantilla" ? STAGE_FORMAT[d.stage ?? ""] : KIND[d.kind]}
                    </td>
                    <td className="py-3 pr-3 font-mono text-[13px]">{d.code}</td>
                    <td className="py-3 pr-3 font-mono text-[13px] font-semibold">
                      v{String(d.version_no).padStart(2, "0")}
                    </td>
                    <td className="py-3">
                      <StatusBadge
                        status="vigente"
                        label={
                          d.effective_at ? `Aprobada ${formatDate(d.effective_at)}` : "Vigente"
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {preview?.ok && preview.warnings.length ? (
            <ul className="grid gap-1 text-sm text-q-warn-fg">
              {preview.warnings.map((w) => (
                <li key={w.code}>{w.message} (se informa a Aseguramiento de la calidad).</li>
              ))}
            </ul>
          ) : null}
          <label className="grid gap-1.5 text-sm font-medium">
            Observaciones
            <Textarea
              id="op-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </Card>
      </div>

      <aside className="grid gap-4 max-[1279px]:order-first">
        <Card>
          <span className="text-label text-text-secondary uppercase">Resumen</span>
          <b className="text-[16px] font-semibold">Se generarán 5 etapas</b>
          <ol className="grid gap-2.5 text-sm">
            {[
              ["Despeje de línea", "4 áreas"],
              ["Dispensación", "materias primas"],
              ["Fabricación", "pasos del instructivo"],
              [
                "Envase",
                (product?.presentations ?? [])
                  .filter((x) => pres[x.id]?.on)
                  .map((x) => x.name)
                  .join(" y ") || "—",
              ],
              ["Acondicionamiento", "codificado e inspección"],
            ].map(([t, d], i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex size-6 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold">
                  {i + 1}
                </span>
                {t} <span className="text-text-secondary">· {d}</span>
              </li>
            ))}
          </ol>
          <dl className="grid grid-cols-2 gap-y-2 border-t border-divider pt-3 text-sm">
            <dt className="text-text-secondary">Perfil regulatorio</dt>
            <dd className="text-right font-semibold">
              {product?.profile === "medicamento" ? "Medicamento" : "Cosmético"}
            </dd>
            <dt className="text-text-secondary">Estado al crear</dt>
            <dd className="text-right">
              <StatusBadge status="preliminar" label="Borrador" />
            </dd>
          </dl>
          <p className="flex gap-2 rounded-md bg-surface-sunken p-3 text-sm text-text-strong">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" /> La orden queda en borrador hasta
            su aprobación. Al aprobarse se generan las solicitudes y documentos (S-38).
          </p>
        </Card>
        <Button
          type="submit"
          size="lg"
          className="min-h-13 text-[16px]"
          data-ready={hydrated}
          disabled={pending || Boolean(blocked) || !preview || !sumOk}
        >
          <Plus aria-hidden /> Crear orden y lote
        </Button>
        <p className="flex items-start gap-1.5 text-sm text-text-secondary">
          {blocked ? (
            <Lock aria-hidden className="mt-0.5 size-4" />
          ) : (
            <Info aria-hidden className="mt-0.5 size-4" />
          )}
          {blocked
            ? "No disponible: la fórmula no tiene versión aprobada."
            : !sumOk
              ? "Ajuste el granel de las presentaciones: la suma debe dar la cantidad del lote."
              : "Queda en borrador hasta su aprobación; al aprobarse se generan las solicitudes y documentos (S-38)."}
        </p>
        <ResultError error={error} />
      </aside>
    </form>
  );
}
