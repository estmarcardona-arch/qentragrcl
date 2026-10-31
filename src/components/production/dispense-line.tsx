"use client";

import { useState } from "react";
import { cn } from "cn";
import { Field, selectCls } from "@/components/equipment/equipment-form";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Input } from "@/components/ui/input";
import { dispenseLot } from "@/lib/production/actions";
import { SignedAction } from "./signed-action";

export type LotOption = {
  id: string;
  code: string;
  expiry: string;
  qty: number;
  status: string;
  reason: string | null;
};
export type BalanceOption = { id: string; code: string; valid: boolean; reasons: string[] };

const fmt = (n: number) =>
  n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Agregar un lote a la línea (S-18): solo lotes aprobados y no vencidos, por FEFO; balanza válida. Los no disponibles
 * se ven con su motivo pero no se pueden elegir (AC-03, AC-05).
 */
export function AddLotForm({
  batchId,
  lineId,
  material,
  unit,
  required,
  dispensed,
  lots,
  balances,
  signer,
}: {
  batchId: string;
  lineId: string;
  material: string;
  unit: string;
  required: number;
  dispensed: number;
  lots: LotOption[];
  balances: BalanceOption[];
  signer: string;
}) {
  const available = lots.filter((l) => !l.reason);
  const [lot, setLot] = useState(available[0]?.id ?? "");
  const [balance, setBalance] = useState(balances.find((b) => b.valid)?.id ?? "");
  const missing = Math.max(required - dispensed, 0);
  const [qty, setQty] = useState(
    missing ? String(Math.min(missing, available[0]?.qty ?? missing)) : "",
  );
  const [tare, setTare] = useState("");
  const chosenBal = balances.find((b) => b.id === balance);
  const lotObj = lots.find((l) => l.id === lot);
  const n = Number(qty.replace(",", "."));
  return (
    <div
      className="grid gap-3 rounded-md border border-dashed border-border-control p-3"
      data-testid={`add-lot-${material}`}
    >
      {available[0] ? (
        <p className="text-xs text-text-secondary">
          Usar primero (FEFO): {available[0].code} · vence {available[0].expiry}
        </p>
      ) : (
        <p role="alert" className="text-sm text-q-bad-fg">
          No hay lotes aprobados y vigentes con saldo. Solicite a bodega la liberación de un lote.
        </p>
      )}
      <div className="grid grid-cols-4 gap-3 max-[1279px]:grid-cols-2">
        <Field id={`lot-${lineId}`} label="Lote">
          <select
            id={`lot-${lineId}`}
            value={lot}
            onChange={(e) => setLot(e.target.value)}
            className={`${selectCls} h-12`}
          >
            {lots.map((l) => (
              <option key={l.id} value={l.id} disabled={Boolean(l.reason)}>
                {l.code} · {l.reason ?? `vence ${l.expiry} · ${fmt(l.qty)} ${unit}`}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`bal-${lineId}`} label="Balanza">
          <select
            id={`bal-${lineId}`}
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className={`${selectCls} h-12`}
          >
            {balances.map((b) => (
              <option key={b.id} value={b.id} disabled={!b.valid}>
                {b.code}
                {b.valid ? "" : ` · no apta: ${b.reasons.join("; ")}`}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`qty-${lineId}`} label={`Peso neto (${unit})`}>
          <Input
            id={`qty-${lineId}`}
            inputMode="decimal"
            className="h-12 font-mono"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </Field>
        <Field id={`tare-${lineId}`} label={`Tara (${unit})`}>
          <Input
            id={`tare-${lineId}`}
            inputMode="decimal"
            className="h-12 font-mono"
            value={tare}
            onChange={(e) => setTare(e.target.value)}
          />
        </Field>
      </div>
      {balances.some((b) => !b.valid) ? (
        <p className="text-xs text-q-bad-fg">
          {balances
            .filter((b) => !b.valid)
            .map(
              (b) =>
                `${b.code} no puede usarse (${b.reasons.join("; ")}); use otra balanza o abra una desviación (F8).`,
            )
            .join(" ")}
        </p>
      ) : null}
      <div>
        <SignedAction
          label="Registrar pesada"
          title={`Dispensar ${material}`}
          meaning="Ejecuté"
          summary={[
            { label: "Lote", value: lotObj?.code ?? "—", mono: true },
            { label: "Peso", value: `${qty} ${unit}`, mono: true },
            { label: "Balanza", value: chosenBal?.code ?? "—", mono: true },
            { label: "Suma", value: `${fmt(dispensed + (n || 0))} de ${fmt(required)} ${unit}` },
          ]}
          signer={signer}
          disabled={!lot || !balance}
          validate={() => (!n || n <= 0 ? "Registre el peso dispensado." : null)}
          run={(pw) =>
            dispenseLot(
              batchId,
              {
                lineId,
                lotId: lot,
                qty: n,
                balanceId: balance,
                tare: tare ? Number(tare.replace(",", ".")) : null,
              },
              pw,
            )
          }
          testId={`dispense-${material}`}
        />
      </div>
    </div>
  );
}

export function SumIndicator({
  dispensed,
  required,
  unit,
}: {
  dispensed: number;
  required: number;
  unit: string;
}) {
  const ok = Math.abs(dispensed - required) < 0.0001;
  return (
    <span className={cn("font-mono text-sm font-semibold")} data-testid="sum-indicator">
      <StatusBadge
        status={ok ? "completada" : dispensed > required ? "rechazado" : "pendiente"}
        label={`Suma dispensada ${fmt(dispensed)} / ${fmt(required)} ${unit}`}
      />
    </span>
  );
}
