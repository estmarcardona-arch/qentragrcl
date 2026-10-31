"use client";

import { CircleCheck, Lock, Minus, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
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
const parse = (v: string) => Number(v.replace(",", "."));
const selectCls =
  "h-11 w-full min-w-0 rounded-md border border-border-control bg-white px-2.5 font-mono text-sm";

/**
 * Sublínea nueva de la materia prima (S-18): lote por FEFO entre los aprobados y vigentes, balanza válida, peso
 * registrado − tara = neto. Los lotes y balanzas no disponibles se ven con su motivo pero no se pueden elegir.
 */
export function AddLotForm({
  batchId,
  lineId,
  index,
  material,
  materialName,
  unit,
  required,
  dispensed,
  lots,
  balances,
  signer,
}: {
  batchId: string;
  lineId: string;
  index: number;
  material: string;
  materialName: string;
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
  const lotObj = lots.find((l) => l.id === lot);
  const [gross, setGross] = useState(
    missing ? fmt(Math.min(missing, available[0]?.qty ?? missing)) : "",
  );
  const [tare, setTare] = useState("0,00");
  const net = Math.round(((parse(gross) || 0) - (parse(tare) || 0)) * 100) / 100;
  const chosenBal = balances.find((b) => b.id === balance);
  const step = (d: number) => setGross(fmt(Math.max((parse(gross) || 0) + d, 0)));
  return (
    <div className="grid gap-3" data-testid={`add-lot-${material}`}>
      <div className="grid grid-cols-[32px_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.6fr)] items-end gap-3 max-[1279px]:grid-cols-2">
        <span className="flex size-7 items-center justify-center self-center rounded-full bg-primary text-xs font-semibold text-white">
          {index}
        </span>
        <label className="grid gap-1 text-label uppercase">
          Lote
          <select
            value={lot}
            onChange={(e) => setLot(e.target.value)}
            className={selectCls}
            aria-label="Lote"
          >
            {!available.length ? <option value="">Seleccione un lote</option> : null}
            {lots.map((l) => (
              <option key={l.id} value={l.id} disabled={Boolean(l.reason)}>
                {l.code} · {l.reason ?? `vence ${l.expiry} · saldo ${fmt(l.qty)} ${unit}`}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-label uppercase">
          Balanza
          <select
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className={selectCls}
            aria-label="Balanza"
          >
            {balances.map((b) => (
              <option key={b.id} value={b.id} disabled={!b.valid}>
                {b.code}
                {b.valid ? "" : " · no apta"}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-label uppercase">
          Peso registrado ({unit})
          <span className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="icon-lg"
              aria-label="Restar 0,5"
              onClick={() => step(-0.5)}
            >
              <Minus aria-hidden />
            </Button>
            <Input
              aria-label={`Peso registrado (${unit})`}
              inputMode="decimal"
              className="h-11 text-right font-mono text-[15px]"
              value={gross}
              onChange={(e) => setGross(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon-lg"
              aria-label="Sumar 0,5"
              onClick={() => step(0.5)}
            >
              <Plus aria-hidden />
            </Button>
          </span>
        </label>
        <label className="grid gap-1 text-label uppercase">
          Tara
          <Input
            aria-label={`Tara (${unit})`}
            inputMode="decimal"
            className="h-11 text-right font-mono"
            value={tare}
            onChange={(e) => setTare(e.target.value)}
          />
        </label>
        <span className="grid gap-1 text-label uppercase">
          Neto
          <b className="flex h-11 items-center justify-end font-mono text-[15px] text-foreground">
            {fmt(net)}
          </b>
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-primary">
        <p className="flex justify-between bg-surface-sunken px-3 py-2 text-label uppercase">
          <span>Lotes de {materialName.toLowerCase()} · orden FEFO</span>
          <span className="normal-case">Solo aprobados y no vencidos</span>
        </p>
        <ul>
          {lots.map((l, i) => (
            <li
              key={l.id}
              className={cn(
                "grid grid-cols-[20px_1fr_auto_220px] items-center gap-3 border-t border-divider px-3 py-2 text-sm",
                l.reason && "bg-surface-sunken text-text-secondary",
              )}
            >
              {l.reason ? (
                <Lock aria-hidden className="size-4" />
              ) : (
                <CircleCheck aria-hidden className="size-4 text-q-ok-ic" />
              )}
              <span>
                <b className="font-mono font-semibold">{l.code}</b>
                <span className="block text-xs">
                  Vence {l.expiry} · saldo {fmt(l.qty)} {unit}
                </span>
              </span>
              <StatusBadge
                status={
                  l.status === "aprobado"
                    ? "aprobado"
                    : l.status === "cuarentena"
                      ? "cuarentena"
                      : l.status === "vencido"
                        ? "vencido"
                        : "rechazado"
                }
                label={
                  l.status === "aprobado"
                    ? "Aprobado"
                    : l.status === "cuarentena"
                      ? "Cuarentena"
                      : l.status === "vencido"
                        ? "Vencido"
                        : "Rechazado"
                }
              />
              <span className="text-xs font-medium text-primary">
                {l.reason
                  ? `No seleccionable: ${l.reason}`
                  : available[0]?.id === l.id && i === lots.indexOf(available[0])
                    ? `Usar primero: vence ${l.expiry}`
                    : l.id === lot
                      ? "Seleccionado"
                      : ""}
              </span>
            </li>
          ))}
        </ul>
        {!available.length ? (
          <p className="flex items-center gap-1.5 border-t border-q-bad-bd px-3 py-2 text-sm text-q-bad-fg">
            <TriangleAlert aria-hidden className="size-4" /> No hay lotes aprobados de{" "}
            {materialName.toLowerCase()} para dispensar.
          </p>
        ) : null}
      </div>

      {balances.some((b) => !b.valid) ? (
        <p className="text-xs text-q-bad-fg">
          {balances
            .filter((b) => !b.valid)
            .map(
              (b) =>
                `${b.code} no puede usarse (${b.reasons.join("; ")}): use otra balanza o abra una desviación (F8).`,
            )
            .join(" ")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <SignedAction
          label="Registrar pesada"
          title={`Dispensar ${materialName}`}
          meaning="Ejecuté"
          summary={[
            { label: "Lote", value: lotObj?.code ?? "—", mono: true },
            { label: "Neto", value: `${fmt(net)} ${unit}`, mono: true },
            { label: "Balanza", value: chosenBal?.code ?? "—", mono: true },
            { label: "Suma", value: `${fmt(dispensed + net)} de ${fmt(required)} ${unit}` },
          ]}
          signer={signer}
          disabled={!lot || !balance}
          validate={() => (!net || net <= 0 ? "Registre el peso dispensado (peso − tara)." : null)}
          run={(pw) =>
            dispenseLot(
              batchId,
              { lineId, lotId: lot, qty: net, balanceId: balance, tare: parse(tare) || 0 },
              pw,
            )
          }
          testId={`dispense-${material}`}
        />
        <span className="text-sm text-text-secondary">
          Una materia prima admite varios lotes: cada uno se pesa y se registra por separado.
        </span>
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
  const over = dispensed > required;
  return (
    <span data-testid="sum-indicator" className="inline-flex">
      <StatusBadge
        status={ok ? "vigente" : over ? "rechazado" : "por_vencer"}
        label={`Suma dispensada ${fmt(dispensed)} / ${fmt(required)} ${unit}${ok ? "" : over ? " · sobra" : ` · faltan ${fmt(required - dispensed)} ${unit}`}`}
        size="lg"
      />
    </span>
  );
}
