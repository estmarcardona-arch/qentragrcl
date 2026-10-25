"use client";

import { Ban, CircleX, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "cn";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveTransfer, type TransferLineInput, type WhResult } from "@/lib/warehouse/actions";
import { LOT_STATUS } from "@/lib/warehouse/labels";

export type WhOpt = {
  id: string;
  code: string;
  name: string;
  external: boolean;
  partyName: string | null;
  qualified: boolean;
  qualificationLabel: string;
  allowed: string;
};
export type StockOpt = {
  key: string;
  lotId: string;
  lotCode: string;
  supplierLot: string;
  material: string;
  status: string;
  qty: number;
  unit: string;
  locationId: string;
  locationCode: string;
  warehouseId: string;
};
export type DestLoc = { id: string; code: string; warehouseId: string };

const selectCls =
  "h-10 w-full min-w-0 rounded-md border border-border-control bg-white px-2.5 text-sm";

/**
 * S-42b · Nuevo traslado (RF-25): origen interno y destino interno o externo (con la calificación del tercero),
 * líneas con lote, cantidad y ubicaciones, y motivo. Los lotes en cuarentena, rechazados o vencidos y los destinos
 * sin calificación vigente se bloquean con regla y acción (la base lo valida de nuevo al guardar).
 */
export function TransferForm({
  warehouses,
  stock,
  destinations,
}: {
  warehouses: WhOpt[];
  stock: StockOpt[];
  destinations: DestLoc[];
}) {
  const router = useRouter();
  const internals = warehouses.filter((w) => !w.external);
  const [from, setFrom] = useState(internals[0]?.id ?? "");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<{ key: string; qty: string; to: string }[]>([]);
  const [error, setError] = useState<Exclude<WhResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  const dest = warehouses.find((w) => w.id === to);
  const available = stock.filter((s) => s.warehouseId === from);
  const chosen = lines.map((l) => ({ ...l, stock: stock.find((s) => s.key === l.key) }));
  const blockedLines = chosen.filter((l) => l.stock && l.stock.status !== "aprobado");
  const destBlocked = dest && dest.external && !dest.qualified;
  const canSave =
    from && to && reason.trim() && lines.length > 0 && !blockedLines.length && !destBlocked;

  return (
    <form
      aria-label="Nuevo traslado"
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const payload: TransferLineInput[] = chosen
            .filter((l) => l.stock)
            .map((l) => ({
              lot_id: l.stock!.lotId,
              qty: Number(l.qty),
              from_location_id: l.stock!.locationId,
              to_location_id: l.to || null,
            }));
          const res = await saveTransfer({
            id: null,
            fromId: from,
            toId: to,
            reason,
            lines: payload,
          });
          if (!res.ok) return setError(res);
          router.push(`/bodega/traslados/${res.id}`);
        });
      }}
    >
      <section className="grid grid-cols-2 gap-4 rounded-[10px] border border-border bg-surface p-5 max-[1279px]:grid-cols-1">
        <div className="grid gap-1.5">
          <Label htmlFor="t-from" className="text-label uppercase">
            Origen *
          </Label>
          <select
            id="t-from"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setLines([]);
            }}
            className={selectCls}
          >
            {internals.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} · {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="t-to" className="text-label uppercase">
            Destino *
          </Label>
          <select
            id="t-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={selectCls}
          >
            <option value="">Seleccione…</option>
            {warehouses
              .filter((w) => w.id !== from)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.external ? `Externa · ${w.partyName}` : w.name}
                </option>
              ))}
          </select>
        </div>
        {dest ? (
          <div
            className={cn(
              "col-span-2 grid gap-2 rounded-md p-3 max-[1279px]:col-span-1",
              dest.external
                ? dest.qualified
                  ? "border-2 border-dashed border-primary"
                  : "border-2 border-dashed border-q-bad-fg"
                : "border border-border",
            )}
            data-testid="destination"
          >
            <span className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <b className="font-semibold">
                {warehouses.find((w) => w.id === from)?.code} → {dest.code}
                {dest.external ? ` · ${dest.partyName}` : ""}
              </b>
              {dest.external ? (
                <StatusBadge
                  status={dest.qualified ? "vigente" : "vencido"}
                  label={dest.qualificationLabel}
                />
              ) : null}
            </span>
            <span className="text-small text-text-secondary">Admite: {dest.allowed}</span>
            {destBlocked ? (
              <div
                role="alert"
                className="grid grid-cols-[24px_1fr] gap-2 rounded-md border border-q-bad-bd bg-q-bad-bg p-3 text-sm text-q-bad-fg"
              >
                <Ban aria-hidden className="size-5" />
                <span>
                  <b>No se puede crear el traslado.</b> Destino sin calificación vigente:{" "}
                  {dest.partyName} ({dest.qualificationLabel.toLowerCase()}) no admite envíos. Elija
                  una bodega calificada o pida la recalificación a Aseguramiento de la calidad.
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="col-span-2 grid gap-1.5 max-[1279px]:col-span-1">
          <Label htmlFor="t-reason" className="text-label uppercase">
            Motivo *
          </Label>
          <Textarea
            id="t-reason"
            rows={2}
            placeholder="Envío a maquila para llenado"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </section>

      <section
        aria-labelledby="lineas"
        className="grid gap-2 rounded-[10px] border border-border bg-surface p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="lineas" className="text-card-title">
            Líneas del traslado ({lines.length})
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Lote a agregar</span>
            <select
              aria-label="Lote a agregar"
              value=""
              onChange={(e) => {
                const s = stock.find((x) => x.key === e.target.value);
                if (s) setLines([...lines, { key: s.key, qty: String(s.qty), to: "" }]);
              }}
              className={cn(selectCls, "w-[420px]")}
            >
              <option value="">Agregar lote…</option>
              {available
                .filter((s) => !lines.some((l) => l.key === s.key))
                .map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.lotCode} · {s.supplierLot} · {s.material} · {s.qty} {s.unit} en{" "}
                    {s.locationCode}
                    {s.status !== "aprobado" ? ` · ${LOT_STATUS[s.status]?.label ?? s.status}` : ""}
                  </option>
                ))}
            </select>
            <Plus aria-hidden className="size-4" />
          </label>
        </div>
        {lines.length ? (
          <table className="w-full text-left text-sm" data-testid="transfer-lines">
            <caption className="sr-only">Líneas</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {[
                  "Lote",
                  "Material",
                  "Cantidad",
                  "Ubicación origen",
                  "Ubicación destino",
                  "Calidad",
                  "",
                ].map((h, i) => (
                  <th key={i} scope="col" className="px-2 py-2 text-label uppercase">
                    {h || <span className="sr-only">Quitar</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chosen.map((l, i) => {
                const s = l.stock!;
                const st = LOT_STATUS[s.status] ?? LOT_STATUS.cuarentena;
                const bad = s.status !== "aprobado";
                return (
                  <tr
                    key={l.key}
                    className={cn("border-t border-divider", bad && "bg-q-bad-bg/50")}
                  >
                    <td className="px-2 py-2 font-mono text-xs font-semibold">{s.supplierLot}</td>
                    <td className="px-2 py-2">{s.material}</td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Cantidad de ${s.lotCode}`}
                        type="number"
                        step="any"
                        className="h-9 w-28"
                        value={l.qty}
                        onChange={(e) =>
                          setLines(
                            lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)),
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{s.locationCode}</td>
                    <td className="px-2 py-2">
                      <select
                        aria-label={`Ubicación destino de ${s.lotCode}`}
                        value={l.to}
                        onChange={(e) =>
                          setLines(
                            lines.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)),
                          )
                        }
                        className="h-9 rounded-md border border-border-control bg-white px-2 text-xs"
                      >
                        <option value="">Por asignar al recibir</option>
                        {destinations
                          .filter((d) => d.warehouseId === to)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.code}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={st.status} label={st.label} />
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Quitar ${s.lotCode}`}
                        onClick={() => setLines(lines.filter((_, j) => j !== i))}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-text-secondary">
            Agregue los lotes que salen de la bodega de origen.
          </p>
        )}
        {blockedLines.map((l) => (
          <div
            key={l.key}
            role="alert"
            className="grid grid-cols-[24px_1fr] gap-2 rounded-md border border-q-bad-bd bg-q-bad-bg p-3 text-sm text-q-bad-fg"
          >
            <Ban aria-hidden className="size-5" />
            <span>
              <b>No se puede enviar este lote.</b> El lote {l.stock!.lotCode} está en{" "}
              {LOT_STATUS[l.stock!.status]?.label.toLowerCase() ?? l.stock!.status} y no se puede
              enviar: los lotes en cuarentena, rechazados o vencidos no salen de la bodega. Espere
              la liberación de Control de calidad o quite la línea.
            </span>
          </div>
        ))}
      </section>

      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg">
          <CircleX aria-hidden className="mt-0.5 size-3.5" />
          {error.rule} {error.detail ? `(${error.detail}) ` : ""}
          {error.action}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !canSave}>
          Guardar borrador
        </Button>
      </div>
    </form>
  );
}
