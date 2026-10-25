"use client";

import { CircleX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  saveMaterial,
  savePresentation,
  saveProduct,
  type MaterialInput,
  type ProductInput,
  type WhResult,
} from "@/lib/warehouse/actions";
import { ITEM_TYPES } from "@/lib/warehouse/labels";

const selectCls =
  "h-10 w-full min-w-0 rounded-md border border-border-control bg-white px-2.5 text-sm";

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id} className="text-label uppercase">
        {label}
      </Label>
      {children}
      {hint ? <span className="text-xs text-text-secondary">{hint}</span> : null}
    </div>
  );
}

function Footer({
  editing,
  reason,
  setReason,
  error,
  msg,
  pending,
  label,
}: {
  editing: boolean;
  reason: string;
  setReason: (v: string) => void;
  error: Exclude<WhResult, { ok: true }> | null;
  msg: string | null;
  pending: boolean;
  label: string;
}) {
  return (
    <>
      {editing ? (
        <Field id="item-reason" label="Motivo del cambio *">
          <Textarea
            id="item-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      ) : null}
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg">
          <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {error.rule} {error.detail ? `(${error.detail}) ` : ""}
          {error.action}
        </p>
      ) : null}
      {msg ? (
        <p role="status" className="text-sm text-tram-en-curso-fg">
          {msg}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || (editing && !reason.trim())}>
          {label}
        </Button>
      </div>
    </>
  );
}

/**
 * S-50 · Ítem del maestro (RF-26): materia prima, material de envase o de empaque con código, unidad de
 * almacenamiento (catálogo), condiciones de almacenamiento, vida útil o reanálisis y unidad de empaque de compra.
 */
export function MaterialForm({
  id,
  initial,
  units,
  editable,
  locked,
}: {
  id: string | null;
  initial: MaterialInput;
  units: { code: string; name: string }[];
  editable: boolean;
  /** Ya se usa en I+D o en bodega: código y tipo no cambian (trazabilidad). */
  locked: boolean;
}) {
  const router = useRouter();
  const [d, setD] = useState<MaterialInput>(initial);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<Exclude<WhResult, { ok: true }> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof MaterialInput>(k: K, v: MaterialInput[K]) => setD({ ...d, [k]: v });
  const ro = !editable;
  return (
    <form
      aria-label="Ítem del maestro"
      className="grid gap-4 rounded-[10px] border border-border bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveMaterial({ id, data: d, reason });
          if (!res.ok) {
            setMsg(null);
            return setError(res);
          }
          setError(null);
          if (!id) return router.push(`/bodega/maestros/${res.id}?nuevo=1`);
          setMsg("Cambios guardados.");
          setReason("");
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-3 gap-4 max-[1279px]:grid-cols-1">
        <Field
          id="it-code"
          label="Código *"
          hint={
            locked
              ? "El ítem ya se usa: el código no cambia."
              : "Formato AAA-999 (p. ej. MP-031, EN-PET-400)."
          }
        >
          <Input
            id="it-code"
            className="font-mono"
            disabled={ro || locked}
            value={d.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
          />
        </Field>
        <Field id="it-name" label="Nombre *">
          <Input
            id="it-name"
            disabled={ro}
            value={d.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field id="it-type" label="Tipo *">
          <select
            id="it-type"
            className={selectCls}
            disabled={ro || locked}
            value={d.type}
            onChange={(e) => set("type", e.target.value as MaterialInput["type"])}
          >
            {ITEM_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="it-unit"
          label="Unidad de almacenamiento *"
          hint="Del catálogo de unidades (kg, g, L, mL, und…)."
        >
          <select
            id="it-unit"
            className={selectCls}
            disabled={ro}
            value={d.unit}
            onChange={(e) => set("unit", e.target.value)}
          >
            {units.map((u) => (
              <option key={u.code} value={u.code}>
                {u.code} · {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="it-life" label="Vida útil o reanálisis (meses)">
          <div className="flex gap-2">
            <Input
              id="it-life"
              type="number"
              min={1}
              max={120}
              className="w-24"
              disabled={ro}
              value={d.shelf_life_months ?? ""}
              onChange={(e) =>
                set("shelf_life_months", e.target.value === "" ? null : Number(e.target.value))
              }
            />
            <select
              aria-label="Tipo de vida útil"
              className={selectCls}
              disabled={ro}
              value={d.shelf_life_kind}
              onChange={(e) =>
                set("shelf_life_kind", e.target.value as MaterialInput["shelf_life_kind"])
              }
            >
              <option value="vencimiento">Vencimiento</option>
              <option value="reanalisis">Reanálisis</option>
            </select>
          </div>
        </Field>
        <Field
          id="it-pkg"
          label="Unidad de empaque de compra"
          hint="Se propone al recibir (p. ej. Caja × 100 und)."
        >
          <div className="flex gap-2">
            <Input
              id="it-pkg"
              placeholder="Caja, saco, tambor…"
              disabled={ro}
              value={d.default_package_type}
              onChange={(e) => set("default_package_type", e.target.value)}
            />
            <Input
              aria-label="Contenido por empaque"
              type="number"
              step="any"
              className="w-28"
              disabled={ro}
              value={d.default_package_qty ?? ""}
              onChange={(e) =>
                set("default_package_qty", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </div>
        </Field>
        <div className="col-span-3 max-[1279px]:col-span-1">
          <Field
            id="it-storage"
            label="Condiciones de almacenamiento"
            hint="Se imprimen en el rótulo. Ejemplo: «15–25 °C, lejos de la luz y la humedad»."
          >
            <Input
              id="it-storage"
              disabled={ro}
              value={d.storage_conditions}
              onChange={(e) => set("storage_conditions", e.target.value)}
            />
          </Field>
        </div>
        {d.type === "mp" ? (
          <>
            <Field id="it-inci" label="Nombre INCI">
              <Input
                id="it-inci"
                disabled={ro}
                value={d.inci_name}
                onChange={(e) => set("inci_name", e.target.value)}
              />
            </Field>
            <Field id="it-fn" label="Función">
              <Input
                id="it-fn"
                disabled={ro}
                value={d.default_function}
                onChange={(e) => set("default_function", e.target.value)}
              />
            </Field>
          </>
        ) : null}
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4"
              disabled={ro}
              checked={d.requires_coa}
              onChange={(e) => set("requires_coa", e.target.checked)}
            />
            Exige certificado de análisis (CoA)
          </label>
          {id ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                disabled={ro}
                checked={d.active}
                onChange={(e) => set("active", e.target.checked)}
              />
              Activo (inactivo = no se recibe)
            </label>
          ) : null}
        </div>
      </div>
      {editable ? (
        <Footer
          editing={Boolean(id)}
          reason={reason}
          setReason={setReason}
          error={error}
          msg={msg}
          pending={pending}
          label={id ? "Guardar cambios" : "Crear ítem"}
        />
      ) : null}
    </form>
  );
}

/** S-50 · Producto terminado (RF-26): código PRD-NNN, línea, titular, registro sanitario, vida útil y almacenamiento. */
export function ProductForm({
  id,
  initial,
  lines,
  editable,
}: {
  id: string | null;
  initial: ProductInput;
  lines: { id: string; label: string }[];
  editable: boolean;
}) {
  const router = useRouter();
  const [d, setD] = useState<ProductInput>(initial);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<Exclude<WhResult, { ok: true }> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setD({ ...d, [k]: v });
  const ro = !editable;
  return (
    <form
      aria-label="Producto terminado"
      className="grid gap-4 rounded-[10px] border border-border bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveProduct({ id, data: d, reason });
          if (!res.ok) {
            setMsg(null);
            return setError(res);
          }
          setError(null);
          if (!id) return router.push(`/bodega/maestros/productos/${res.id}?nuevo=1`);
          setMsg("Cambios guardados.");
          setReason("");
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-3 gap-4 max-[1279px]:grid-cols-1">
        <Field id="pr-code" label="Código *" hint="Formato PRD-001.">
          <Input
            id="pr-code"
            className="font-mono"
            disabled={ro || Boolean(id)}
            value={d.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
          />
        </Field>
        <Field id="pr-name" label="Nombre *">
          <Input
            id="pr-name"
            disabled={ro}
            value={d.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field id="pr-line" label="Línea *">
          <select
            id="pr-line"
            className={selectCls}
            disabled={ro}
            value={d.line_id}
            onChange={(e) => set("line_id", e.target.value)}
          >
            <option value="">Seleccione…</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="pr-titular" label="Titular">
          <Input
            id="pr-titular"
            disabled={ro}
            value={d.titular}
            onChange={(e) => set("titular", e.target.value)}
          />
        </Field>
        <Field id="pr-reg" label="Registro o notificación sanitaria">
          <Input
            id="pr-reg"
            className="font-mono"
            disabled={ro}
            value={d.sanitary_registration}
            onChange={(e) => set("sanitary_registration", e.target.value)}
          />
        </Field>
        <Field id="pr-reg-exp" label="Vencimiento del registro">
          <Input
            id="pr-reg-exp"
            type="date"
            disabled={ro}
            value={d.sanitary_registration_expires}
            onChange={(e) => set("sanitary_registration_expires", e.target.value)}
          />
        </Field>
        <Field id="pr-life" label="Vida útil (meses)">
          <Input
            id="pr-life"
            type="number"
            min={1}
            max={120}
            disabled={ro}
            value={d.shelf_life_months ?? ""}
            onChange={(e) =>
              set("shelf_life_months", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
        <div className="col-span-2 max-[1279px]:col-span-1">
          <Field id="pr-storage" label="Condiciones de almacenamiento">
            <Input
              id="pr-storage"
              disabled={ro}
              value={d.storage_conditions}
              onChange={(e) => set("storage_conditions", e.target.value)}
            />
          </Field>
        </div>
        {id ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              disabled={ro}
              checked={d.active}
              onChange={(e) => set("active", e.target.checked)}
            />
            Activo
          </label>
        ) : null}
      </div>
      {editable ? (
        <Footer
          editing={Boolean(id)}
          reason={reason}
          setReason={setReason}
          error={error}
          msg={msg}
          pending={pending}
          label={id ? "Guardar cambios" : "Crear producto"}
        />
      ) : null}
    </form>
  );
}

/** Nueva presentación del producto terminado (código, nombre, contenido neto y unidad del catálogo). */
export function PresentationForm({
  productId,
  units,
}: {
  productId: string;
  units: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [d, setD] = useState({
    code: "",
    name: "",
    net_content: null as number | null,
    unit: "mL",
    active: true,
  });
  const [error, setError] = useState<Exclude<WhResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      aria-label="Nueva presentación"
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await savePresentation({ id: null, productId, data: d, reason: "" });
          if (!res.ok) return setError(res);
          setError(null);
          setD({ code: "", name: "", net_content: null, unit: d.unit, active: true });
          router.refresh();
        });
      }}
    >
      <Field id="ps-code" label="Código">
        <Input
          id="ps-code"
          className="w-24 font-mono"
          value={d.code}
          onChange={(e) => setD({ ...d, code: e.target.value })}
        />
      </Field>
      <Field id="ps-name" label="Nombre">
        <Input
          id="ps-name"
          className="w-40"
          value={d.name}
          onChange={(e) => setD({ ...d, name: e.target.value })}
        />
      </Field>
      <Field id="ps-net" label="Contenido neto">
        <Input
          id="ps-net"
          type="number"
          step="any"
          className="w-28"
          value={d.net_content ?? ""}
          onChange={(e) =>
            setD({ ...d, net_content: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
      </Field>
      <Field id="ps-unit" label="Unidad">
        <select
          id="ps-unit"
          className={selectCls}
          value={d.unit}
          onChange={(e) => setD({ ...d, unit: e.target.value })}
        >
          {units.map((u) => (
            <option key={u.code} value={u.code}>
              {u.code}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        Agregar presentación
      </Button>
      {error ? (
        <p
          role="alert"
          className="flex w-full items-start gap-1.5 text-[13px] font-medium text-q-bad-fg"
        >
          <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {error.rule} {error.detail ? `(${error.detail}) ` : ""}
          {error.action}
        </p>
      ) : null}
    </form>
  );
}
