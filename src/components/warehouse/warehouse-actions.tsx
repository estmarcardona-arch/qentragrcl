"use client";

import { CircleX, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ReauthDialog } from "@/components/documents/reauth-dialog";
import { Button } from "@/components/ui/button";
import { addLocations, decideExternalWarehouse, type WhResult } from "@/lib/warehouse/actions";

/** Selector − / + de 1 a 12 (estantes, pisos, posiciones). */
export function Stepper({
  id,
  label,
  value,
  onChange,
  max = 12,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-label uppercase">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label={`Menos ${label.toLowerCase()}`}
          onClick={() => onChange(Math.max(1, value - 1))}
        >
          <Minus aria-hidden />
        </Button>
        <input
          id={id}
          type="number"
          min={1}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(1, Number(e.target.value) || 1)))}
          className="h-9 w-16 rounded-md border border-border-control bg-white text-center font-mono text-sm"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label={`Más ${label.toLowerCase()}`}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** Agregar estantes a una bodega existente (RF-23). */
export function AddRacks({
  warehouseId,
  code,
  prefix,
  nextRack,
}: {
  warehouseId: string;
  code: string;
  prefix: string;
  nextRack: number;
}) {
  const router = useRouter();
  const [racks, setRacks] = useState(1);
  const [levels, setLevels] = useState(4);
  const [positions, setPositions] = useState(2);
  const [error, setError] = useState<Exclude<WhResult, { ok: true }> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <section
      aria-labelledby="agregar"
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-4"
    >
      <h2 id="agregar" className="text-card-title">
        Agregar estantes
      </h2>
      <div className="flex flex-wrap items-end gap-4">
        <Stepper id="add-racks" label="Estantes" value={racks} onChange={setRacks} max={99} />
        <Stepper id="add-levels" label="Pisos por estante" value={levels} onChange={setLevels} />
        <Stepper
          id="add-positions"
          label="Posiciones por piso"
          value={positions}
          onChange={setPositions}
        />
        <span className="font-mono text-sm" data-testid="add-preview">
          {racks} × {levels} × {positions} = {racks * levels * positions} ubicaciones · {prefix}-E
          {pad(nextRack)}-P1-01 … {prefix}-E{pad(nextRack + racks - 1)}-P{levels}-{pad(positions)}
        </span>
      </div>
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
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await addLocations({ warehouseId, racks, levels, positions, code });
              if (!res.ok) {
                setMsg(null);
                return setError(res);
              }
              setError(null);
              setMsg(`Se generaron ${res.created} ubicaciones.`);
              router.refresh();
            })
          }
        >
          <Plus aria-hidden /> Generar ubicaciones
        </Button>
      </div>
    </section>
  );
}

/** D-20 · Aseguramiento de la calidad aprueba o rechaza la bodega externa, con firma. */
export function ExternalApproval({
  id,
  code,
  party,
  signer,
}: {
  id: string;
  code: string;
  party: string;
  signer: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | boolean>(null);
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="secondary" onClick={() => setDialog(false)}>
        Rechazar
      </Button>
      <Button type="button" onClick={() => setDialog(true)}>
        Aprobar bodega externa
      </Button>
      {dialog !== null ? (
        <ReauthDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={dialog ? `Aprobar ${code}` : `Rechazar ${code}`}
          meaning={dialog ? "Aprobé" : "Revisé"}
          summary={[
            { label: "Bodega", value: code, mono: true },
            { label: "Tercero", value: party },
          ]}
          signer={signer}
          reasonLabel={dialog ? "Observaciones (opcional)" : "Motivo del rechazo"}
          reasonRequired={!dialog}
          confirmLabel={dialog ? "Firmar aprobación" : "Firmar rechazo"}
          destructive={!dialog}
          onConfirm={(pw, reason) =>
            decideExternalWarehouse({ id, approve: dialog, reason, password: pw, code })
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
