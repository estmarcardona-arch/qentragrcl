"use client";

import { Box, Circle, Clock, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { setLocationBlocked, setRackZone } from "@/lib/warehouse/actions";
import { LOT_STATUS, ZONE_LABELS } from "@/lib/warehouse/labels";

export type MapRack = { id: string; code: string; zone: string; levels: number; positions: number };
export type MapLocation = {
  id: string;
  code: string;
  rackId: string;
  level: number;
  position: number;
  status: "libre" | "ocupada" | "bloqueada";
  blockReason: string | null;
};
export type MapLot = {
  locationId: string;
  code: string;
  material: string;
  qty: string;
  status: string;
  lotId: string;
};

const STATE = {
  libre: { label: "Libre", icon: Circle, cls: "border-border-control bg-white text-text-strong" },
  ocupada: {
    label: "Ocupada",
    icon: Box,
    cls: "border-tram-en-curso-bd bg-tram-en-curso-bg text-tram-en-curso-fg",
  },
  bloqueada: {
    label: "Bloqueada",
    icon: Lock,
    cls: "border-neutral-strong bg-neutral-strong text-white",
  },
} as const;

/**
 * S-41c · Mapa de la bodega (RF-23, RF-24): estantes en columnas, pisos en filas (el más alto arriba) y las
 * posiciones de cada celda como Libre, Ocupada o Bloqueada (ícono y texto). Los estantes en zona de cuarentena
 * van marcados. Al seleccionar una posición se ven su código, sus lotes y el bloqueo con motivo.
 */
export function LocationMap({
  warehouseCode,
  racks,
  locations,
  lots,
  canEdit,
  compact,
}: {
  warehouseCode: string;
  racks: MapRack[];
  locations: MapLocation[];
  lots: MapLot[];
  canEdit: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<string | null>(
    locations.find((l) => l.status === "ocupada")?.id ?? locations[0]?.id ?? null,
  );
  const maxLevels = Math.max(1, ...racks.map((r) => r.levels));
  const levels = Array.from({ length: maxLevels }, (_, i) => maxLevels - i);
  const current = locations.find((l) => l.id === sel) ?? null;
  const currentLots = lots.filter((l) => l.locationId === sel);
  const currentRack = racks.find((r) => r.id === current?.rackId);
  const counts = {
    libre: locations.filter((l) => l.status === "libre").length,
    ocupada: locations.filter((l) => l.status === "ocupada").length,
    bloqueada: locations.filter((l) => l.status === "bloqueada").length,
  };

  return (
    <div
      className={cn(
        "grid gap-4",
        compact ? "" : "grid-cols-[minmax(0,1fr)_320px] max-[1279px]:grid-cols-1",
      )}
    >
      <section
        aria-label={`Mapa de ${warehouseCode}`}
        className="grid content-start gap-3 overflow-x-auto rounded-[10px] border border-border bg-surface p-4"
      >
        <table className="border-separate border-spacing-1.5" data-testid="location-map">
          <caption className="sr-only">
            Ubicaciones de {warehouseCode}: {counts.ocupada} ocupadas, {counts.libre} libres y{" "}
            {counts.bloqueada} bloqueadas
          </caption>
          <thead>
            <tr>
              <th scope="col" className="text-label uppercase">
                Piso
              </th>
              {racks.map((r) => (
                <th
                  key={r.id}
                  scope="col"
                  className={cn(
                    "rounded-md px-2 py-1 text-center font-mono text-xs",
                    r.zone === "cuarentena"
                      ? "bg-q-warn-bg text-q-warn-fg"
                      : "bg-surface-sunken text-text-strong",
                  )}
                >
                  {r.code}
                  {r.zone === "cuarentena" ? (
                    <span className="block font-sans text-[10px]">Cuarentena</span>
                  ) : null}
                  {r.zone === "aprobado" ? (
                    <span className="block font-sans text-[10px]">Aprobados</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map((lv) => (
              <tr key={lv}>
                <th scope="row" className="pr-1 font-mono text-xs">
                  P{lv}
                </th>
                {racks.map((r) => (
                  <td
                    key={r.id}
                    className={cn(
                      "rounded-md p-1 align-top",
                      r.zone === "cuarentena"
                        ? "border-2 border-dashed border-q-warn-fg bg-q-warn-bg/40"
                        : "border border-divider",
                    )}
                  >
                    {lv <= r.levels ? (
                      <div className="flex gap-1">
                        {locations
                          .filter((l) => l.rackId === r.id && l.level === lv)
                          .sort((x, y) => x.position - y.position)
                          .map((l) => {
                            const s = STATE[l.status];
                            const Icon = s.icon;
                            return (
                              <button
                                key={l.id}
                                type="button"
                                data-code={l.code}
                                data-status={l.status}
                                aria-pressed={sel === l.id}
                                aria-label={`${l.code}: ${s.label}`}
                                onClick={() => setSel(l.id)}
                                className={cn(
                                  "flex items-center gap-1 rounded border px-1.5 text-[11px] font-semibold",
                                  compact ? "h-11 min-w-11" : "h-[26px] min-w-[46px]",
                                  s.cls,
                                  sel === l.id && "ring-2 ring-primary ring-offset-2",
                                )}
                              >
                                <Icon aria-hidden className="size-3" />P{l.position}
                              </button>
                            );
                          })}
                      </div>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="flex flex-wrap gap-3 text-xs" aria-label="Convenciones">
          {(Object.keys(STATE) as (keyof typeof STATE)[]).map((k) => {
            const Icon = STATE[k].icon;
            return (
              <li key={k} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded border",
                    STATE[k].cls,
                  )}
                >
                  <Icon aria-hidden className="size-3" />
                </span>
                {STATE[k].label} ({counts[k]})
              </li>
            );
          })}
          {racks.some((r) => r.zone === "cuarentena") ? (
            <li className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded border-2 border-dashed border-q-warn-fg bg-q-warn-bg text-q-warn-fg">
                <Clock aria-hidden className="size-3" />
              </span>
              Zona de cuarentena (
              {racks
                .filter((r) => r.zone === "cuarentena")
                .map((r) => r.code)
                .join(", ")}
              )
            </li>
          ) : null}
        </ul>
      </section>

      {current ? (
        <aside
          aria-label="Ubicación seleccionada"
          className="grid content-start gap-3 rounded-[10px] border border-border bg-surface p-4"
          data-testid="location-detail"
        >
          <div className="grid gap-1">
            <span className="text-label text-text-secondary uppercase">Ubicación</span>
            <b className="font-mono text-xl">{current.code}</b>
            <span className="text-small text-text-secondary">
              Estante {currentRack?.code} · piso {current.level} · posición {current.position} ·{" "}
              {ZONE_LABELS[currentRack?.zone ?? "general"]}
            </span>
          </div>
          <StatusBadge
            status={
              current.status === "libre"
                ? "pendiente"
                : current.status === "ocupada"
                  ? "en_curso"
                  : "bloqueada"
            }
            label={STATE[current.status].label}
          />
          {current.blockReason ? <p className="text-sm">Bloqueada: {current.blockReason}</p> : null}
          <div className="grid gap-1.5">
            <span className="text-label text-text-secondary uppercase">Lotes almacenados</span>
            {currentLots.length ? (
              currentLots.map((l) => {
                const st = LOT_STATUS[l.status] ?? LOT_STATUS.aprobado;
                return (
                  <div
                    key={l.lotId}
                    className="grid gap-1 rounded-md border border-divider p-2 text-sm"
                  >
                    <a href={`/bodega/inventario/${l.lotId}`} className="font-mono font-semibold">
                      {l.code}
                    </a>
                    <span>
                      {l.material} · {l.qty}
                    </span>
                    <StatusBadge status={st.status} label={st.label} />
                  </div>
                );
              })
            ) : (
              <span className="text-sm text-text-secondary">Sin lotes almacenados</span>
            )}
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <ReasonDialog
                trigger={
                  <Button variant="secondary" size="sm">
                    <Lock aria-hidden />{" "}
                    {current.status === "bloqueada" ? "Desbloquear" : "Bloquear"}
                  </Button>
                }
                title={`${current.status === "bloqueada" ? "Desbloquear" : "Bloquear"} ${current.code}`}
                description={
                  current.status === "bloqueada"
                    ? "La ubicación vuelve a recibir material."
                    : "Una ubicación bloqueada no recibe material. Las existencias que tenga se mantienen."
                }
                confirmLabel={current.status === "bloqueada" ? "Desbloquear" : "Bloquear"}
                onConfirm={(reason) =>
                  setLocationBlocked({
                    locationId: current.id,
                    blocked: current.status !== "bloqueada",
                    reason,
                    code: warehouseCode,
                  })
                }
                onDone={() => router.refresh()}
              />
              {currentRack ? (
                <ZoneDialog
                  rack={currentRack}
                  warehouseCode={warehouseCode}
                  onDone={() => router.refresh()}
                />
              ) : null}
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

function ZoneDialog({
  rack,
  warehouseCode,
  onDone,
}: {
  rack: MapRack;
  warehouseCode: string;
  onDone: () => void;
}) {
  const [zone, setZone] = useState(rack.zone);
  return (
    <ReasonDialog
      trigger={
        <Button variant="secondary" size="sm">
          Zona del estante {rack.code}
        </Button>
      }
      title={`Zona del estante ${rack.code}`}
      description="D-16: un lote en cuarentena no va a la zona de aprobados y uno aprobado no va a la de cuarentena."
      confirmLabel="Cambiar zona"
      onConfirm={(reason) => setRackZone({ rackId: rack.id, zone, reason, code: warehouseCode })}
      onDone={onDone}
    >
      <label className="grid gap-1.5">
        <span className="text-label uppercase">Zona</span>
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="h-10 rounded-md border border-border-control bg-white px-2.5 text-sm"
        >
          {Object.entries(ZONE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
    </ReasonDialog>
  );
}
