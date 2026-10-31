"use client";

import { CircleX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveEquipment, type EqResult, type EquipmentInput } from "@/lib/equipment/actions";
import { PLANT_AREAS } from "@/lib/equipment/labels";

export const selectCls =
  "h-10 w-full min-w-0 rounded-md border border-border-control bg-white px-2.5 text-sm";

export function Field({
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

export function ErrorLine({ error }: { error: Exclude<EqResult, { ok: true }> | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg">
      <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      {error.rule} {error.detail ? `(${error.detail}) ` : ""}
      {error.action}
      {typeof error.remaining === "number" ? ` Intentos restantes: ${error.remaining}.` : ""}
    </p>
  );
}

export type Option = { code: string; name: string };

/** Ficha del equipo (RF-50): código, tipo, área, documento que lo rige y qué controles exige. */
export function EquipmentForm({
  id,
  initial,
  types,
  documents,
  editable,
}: {
  id: string | null;
  initial: EquipmentInput;
  types: Option[];
  documents: { id: string; label: string }[];
  editable: boolean;
}) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<Exclude<EqResult, { ok: true }> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof EquipmentInput>(k: K, v: EquipmentInput[K]) =>
    setD((p) => ({ ...p, [k]: v }));
  const ro = !editable;
  const check = (k: keyof EquipmentInput, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={Boolean(d[k])}
        disabled={ro}
        onChange={(e) => set(k, e.target.checked as never)}
        className="size-4"
      />
      {label}
    </label>
  );
  return (
    <form
      aria-label="Ficha del equipo"
      className="grid gap-4 rounded-[10px] border border-border bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveEquipment({ id, data: d, reason });
          if (!res.ok) {
            setMsg(null);
            return setError(res);
          }
          setError(null);
          if (!id) return router.push(`/equipos/${res.code}?nuevo=1`);
          setMsg("Cambios guardados.");
          setReason("");
          router.refresh();
        });
      }}
    >
      <h2 className="text-card-title">Ficha del equipo</h2>
      <div className="grid grid-cols-3 gap-3 max-[1279px]:grid-cols-2">
        <Field id="eq-code" label="Código *" hint="Formato AAA-999, p. ej. BAL-014">
          <Input
            id="eq-code"
            value={d.code}
            disabled={ro || Boolean(id)}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            className="font-mono"
          />
        </Field>
        <Field id="eq-name" label="Nombre *">
          <Input
            id="eq-name"
            value={d.name}
            disabled={ro}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field id="eq-type" label="Tipo *">
          <select
            id="eq-type"
            value={d.equipment_type}
            disabled={ro}
            onChange={(e) => set("equipment_type", e.target.value)}
            className={selectCls}
          >
            <option value="">Seleccione…</option>
            {types.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="eq-area" label="Área">
          <select
            id="eq-area"
            value={d.plant_area}
            disabled={ro}
            onChange={(e) => set("plant_area", e.target.value)}
            className={selectCls}
          >
            {PLANT_AREAS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="eq-doc"
          label="Documento que lo rige"
          hint="Instructivo de uso, limpieza y calibración del listado maestro"
        >
          <select
            id="eq-doc"
            value={d.governing_document_id}
            disabled={ro}
            onChange={(e) => set("governing_document_id", e.target.value)}
            className={selectCls}
          >
            <option value="">Sin documento</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="eq-cap" label="Capacidad">
          <Input
            id="eq-cap"
            value={d.capacity}
            disabled={ro}
            placeholder="p. ej. 300 kg · d = 0,1 g"
            onChange={(e) => set("capacity", e.target.value)}
          />
        </Field>
        <Field id="eq-mfr" label="Fabricante">
          <Input
            id="eq-mfr"
            value={d.manufacturer}
            disabled={ro}
            onChange={(e) => set("manufacturer", e.target.value)}
          />
        </Field>
        <Field id="eq-model" label="Modelo">
          <Input
            id="eq-model"
            value={d.model}
            disabled={ro}
            onChange={(e) => set("model", e.target.value)}
          />
        </Field>
        <Field id="eq-serial" label="Serie">
          <Input
            id="eq-serial"
            value={d.serial_number}
            disabled={ro}
            onChange={(e) => set("serial_number", e.target.value)}
            className="font-mono"
          />
        </Field>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-label uppercase">Controles que exige</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {check("critical", "Equipo crítico")}
          {check("requires_calibration", "Calibración")}
          {check("requires_qualification", "Calificación")}
          {check("requires_cleaning", "Limpieza verificada")}
          {id ? check("active", "Activo") : null}
        </div>
      </fieldset>
      {editable ? (
        <>
          {id ? (
            <Field id="eq-reason" label="Motivo del cambio *">
              <Textarea
                id="eq-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          ) : null}
          <ErrorLine error={error} />
          {msg ? (
            <p role="status" className="text-sm text-tram-en-curso-fg">
              {msg}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || (Boolean(id) && !reason.trim())}>
              {id ? "Guardar cambios" : "Registrar equipo"}
            </Button>
          </div>
        </>
      ) : null}
    </form>
  );
}
