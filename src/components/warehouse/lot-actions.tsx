"use client";

import { CircleX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adjustLot, relocateLot, type WhResult } from "@/lib/warehouse/actions";
import { ADJUST_KINDS } from "@/lib/warehouse/labels";

export type LocationOption = { id: string; code: string; warehouse: string; zone: string };
export type StockAt = { locationId: string; code: string; qty: number };

const selectCls =
  "h-10 w-full min-w-0 rounded-md border border-border-control bg-white px-2.5 text-sm";

function ErrorLine({ error }: { error: Exclude<WhResult, { ok: true }> | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg">
      <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      {error.rule} {error.detail ? `(${error.detail}) ` : ""}
      {error.action}
    </p>
  );
}

/** Traslado interno con motivo (RF-24). La base valida tipo de material, zona y estado del lote. */
export function RelocateForm({
  lotId,
  unit,
  stock,
  targets,
}: {
  lotId: string;
  unit: string;
  stock: StockAt[];
  targets: LocationOption[];
}) {
  const router = useRouter();
  const [from, setFrom] = useState(stock[0]?.locationId ?? "");
  const [to, setTo] = useState("");
  const [qty, setQty] = useState(String(stock[0]?.qty ?? ""));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<Exclude<WhResult, { ok: true }> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const groups = [...new Set(targets.map((t) => t.warehouse))];
  return (
    <form
      aria-label="Trasladar"
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await relocateLot({
            lotId,
            fromId: from,
            toId: to,
            qty: Number(qty),
            reason,
          });
          if (!res.ok) {
            setMsg(null);
            return setError(res);
          }
          setError(null);
          setMsg("Traslado registrado.");
          setReason("");
          router.refresh();
        });
      }}
    >
      <h2 className="text-card-title">Trasladar</h2>
      <div className="grid grid-cols-3 gap-3 max-[1279px]:grid-cols-1">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="mv-from" className="text-label uppercase">
            Desde
          </Label>
          <select
            id="mv-from"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={selectCls}
          >
            {stock.map((s) => (
              <option key={s.locationId} value={s.locationId}>
                {s.code} · {s.qty} {unit}
              </option>
            ))}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="mv-to" className="text-label uppercase">
            Hacia
          </Label>
          <select
            id="mv-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={selectCls}
          >
            <option value="">Seleccione…</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {targets
                  .filter((t) => t.warehouse === g)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code}
                      {t.zone !== "general" ? ` · zona de ${t.zone}` : ""}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="mv-qty" className="text-label uppercase">
            Cantidad ({unit})
          </Label>
          <Input
            id="mv-qty"
            type="number"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mv-reason" className="text-label uppercase">
          Motivo *
        </Label>
        <Textarea
          id="mv-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <ErrorLine error={error} />
      {msg ? (
        <p role="status" className="text-sm text-tram-en-curso-fg">
          {msg}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !to || !reason.trim()}>
          Trasladar
        </Button>
      </div>
    </form>
  );
}

/** Ajuste con motivo (merma, conteo, muestra): nada se borra; el kardex es de solo lectura. */
export function AdjustForm({
  lotId,
  unit,
  stock,
}: {
  lotId: string;
  unit: string;
  stock: StockAt[];
}) {
  const router = useRouter();
  const [loc, setLoc] = useState(stock[0]?.locationId ?? "");
  const [qty, setQty] = useState("");
  const [kind, setKind] = useState("merma");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<Exclude<WhResult, { ok: true }> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      aria-label="Registrar ajuste"
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await adjustLot({ lotId, locationId: loc, qty: Number(qty), kind, reason });
          if (!res.ok) {
            setMsg(null);
            return setError(res);
          }
          setError(null);
          setMsg("Ajuste registrado.");
          setQty("");
          setReason("");
          router.refresh();
        });
      }}
    >
      <h2 className="text-card-title">Registrar ajuste</h2>
      <div className="grid grid-cols-3 gap-3 max-[1279px]:grid-cols-1">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="adj-loc" className="text-label uppercase">
            Ubicación
          </Label>
          <select
            id="adj-loc"
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            className={selectCls}
          >
            {stock.map((s) => (
              <option key={s.locationId} value={s.locationId}>
                {s.code}
              </option>
            ))}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="adj-qty" className="text-label uppercase">
            Cantidad (±) {unit}
          </Label>
          <Input
            id="adj-qty"
            type="number"
            step="any"
            placeholder="-1,50"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="adj-kind" className="text-label uppercase">
            Tipo
          </Label>
          <select
            id="adj-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={selectCls}
          >
            {ADJUST_KINDS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="adj-reason" className="text-label uppercase">
          Motivo *
        </Label>
        <Textarea
          id="adj-reason"
          rows={2}
          placeholder="Explique el ajuste…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <ErrorLine error={error} />
      {msg ? (
        <p role="status" className="text-sm text-tram-en-curso-fg">
          {msg}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending || !qty || !reason.trim()}>
          Registrar ajuste
        </Button>
      </div>
    </form>
  );
}
