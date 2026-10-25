"use client";

import { CircleX, GitBranch, House, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "cn";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWarehouse, type WhResult } from "@/lib/warehouse/actions";
import { FUNCTIONS, MATERIAL_CLASSES } from "@/lib/warehouse/labels";
import { Stepper } from "./warehouse-actions";

export type PartyOpt = { id: string; name: string; qualified: boolean; label: string };

/** Clases que se marcan por defecto según la función (se pueden ajustar). */
const DEFAULT_CLASSES: Record<string, string[]> = {
  materias_primas: ["materia_prima"],
  material_envase: ["material_envase"],
  material_empaque: ["material_empaque"],
  granel: ["granel"],
  producto_terminado: ["producto_terminado"],
  rechazo: MATERIAL_CLASSES.map(([v]) => v),
  devolucion: MATERIAL_CLASSES.map(([v]) => v),
};

/**
 * S-41b · Nueva bodega (RF-23): código, nombre, función, tipos permitidos, sitio interno o externo (con tercero y
 * aviso de aprobación, D-20) y estructura con vista previa en vivo (6 × 4 × 2 = 48; AC-27).
 */
export function WarehouseForm({ parties }: { parties: PartyOpt[] }) {
  const router = useRouter();
  const [code, setCode] = useState("BOD-");
  const [name, setName] = useState("");
  const [fn, setFn] = useState("materias_primas");
  const [allowed, setAllowed] = useState<string[]>(["materia_prima"]);
  const [site, setSite] = useState<"interna" | "externa">("interna");
  const [party, setParty] = useState("");
  const [address, setAddress] = useState("");
  const [secured, setSecured] = useState(false);
  const [prefix, setPrefix] = useState("MP");
  const [e, setE] = useState(6);
  const [p, setP] = useState(4);
  const [x, setX] = useState(2);
  const [error, setError] = useState<Exclude<WhResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  const pad = (n: number) => String(n).padStart(2, "0");
  const pre = prefix.toUpperCase() || "XX";
  const codes = [
    `${pre}-E01-P1-01`,
    `${pre}-E${pad(Math.ceil(e / 2))}-P${Math.ceil(p / 2)}-01`,
    `${pre}-E${pad(e)}-P${p}-${pad(x)}`,
  ];
  const sel = parties.find((y) => y.id === party);
  return (
    <form
      aria-label="Nueva bodega"
      className="grid gap-4 rounded-[10px] border border-border bg-surface p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        start(async () => {
          const res = await createWarehouse({
            data: {
              code,
              name,
              function: fn,
              site_type: site,
              external_party_id: site === "externa" ? party || null : null,
              location_prefix: prefix,
              address,
              secured,
            },
            allowed,
            racks: e,
            levels: p,
            positions: x,
          });
          if (!res.ok) return setError(res);
          router.push(`/bodega/estructura/${res.code}`);
        });
      }}
    >
      <div className="grid grid-cols-3 gap-4 max-[1279px]:grid-cols-1">
        <div className="grid gap-1.5">
          <Label htmlFor="w-code" className="text-label uppercase">
            Código *
          </Label>
          <Input
            id="w-code"
            className="font-mono"
            value={code}
            onChange={(ev) => setCode(ev.target.value.toUpperCase())}
          />
          <span className="text-xs text-text-secondary">
            Formato BOD-XX (p. ej. BOD-MP, BOD-EXT-03).
          </span>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="w-name" className="text-label uppercase">
            Nombre *
          </Label>
          <Input id="w-name" value={name} onChange={(ev) => setName(ev.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="w-prefix" className="text-label uppercase">
            Prefijo de ubicaciones *
          </Label>
          <Input
            id="w-prefix"
            className="font-mono"
            value={prefix}
            onChange={(ev) => setPrefix(ev.target.value.toUpperCase())}
          />
          <span className="text-xs text-text-secondary">
            2 o 3 letras, o EXT-NN para una externa.
          </span>
        </div>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-label text-text-strong uppercase">Función *</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Función">
          {FUNCTIONS.map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={fn === v}
              onClick={() => {
                setFn(v);
                setAllowed(DEFAULT_CLASSES[v]);
                setSecured(v === "rechazo");
              }}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium",
                fn === v
                  ? "border-primary bg-primary text-white"
                  : "border-border-control bg-white text-text-strong",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-label text-text-strong uppercase">
          Tipos de material permitidos *
        </legend>
        <div className="flex flex-wrap gap-3">
          {MATERIAL_CLASSES.map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={allowed.includes(v)}
                onChange={(ev) =>
                  setAllowed(ev.target.checked ? [...allowed, v] : allowed.filter((c) => c !== v))
                }
              />
              {l}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={secured}
              onChange={(ev) => setSecured(ev.target.checked)}
            />
            Bajo llave
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-label text-text-strong uppercase">Sitio *</legend>
        <div
          className="flex w-fit overflow-hidden rounded-md border border-border-control"
          role="radiogroup"
          aria-label="Sitio"
        >
          {(
            [
              ["interna", "Interno", House],
              ["externa", "Externo", GitBranch],
            ] as const
          ).map(([v, l, Icon]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={site === v}
              onClick={() => setSite(v)}
              className={cn(
                "flex h-10 items-center gap-2 px-4 text-sm font-medium",
                site === v ? "bg-primary text-white" : "bg-white text-text-strong",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {l}
            </button>
          ))}
        </div>
        {site === "externa" ? (
          <div className="grid gap-3 rounded-md border-2 border-dashed border-primary p-3">
            <div className="grid grid-cols-2 gap-3 max-[1279px]:grid-cols-1">
              <div className="grid gap-1.5">
                <Label htmlFor="w-party" className="text-label uppercase">
                  Proveedor de maquila o almacenamiento *
                </Label>
                <select
                  id="w-party"
                  value={party}
                  onChange={(ev) => setParty(ev.target.value)}
                  className="h-10 rounded-md border border-border-control bg-white px-2.5 text-sm"
                >
                  <option value="">Seleccione…</option>
                  {parties.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
                {sel ? (
                  <StatusBadge status={sel.qualified ? "vigente" : "vencido"} label={sel.label} />
                ) : null}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="w-address" className="text-label uppercase">
                  Dirección
                </Label>
                <Input
                  id="w-address"
                  value={address}
                  onChange={(ev) => setAddress(ev.target.value)}
                />
              </div>
            </div>
            <p className="flex items-start gap-2 text-sm text-tram-en-curso-fg">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              Requiere aprobación de Aseguramiento de la calidad: no recibe envíos hasta entonces
              (D-20).
            </p>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-3 rounded-md border border-border p-4">
        <legend className="px-1 text-label text-text-strong uppercase">Estructura</legend>
        <div className="flex flex-wrap items-end gap-5">
          <Stepper id="w-racks" label="Estantes" value={e} onChange={setE} max={99} />
          <Stepper id="w-levels" label="Pisos por estante" value={p} onChange={setP} />
          <Stepper id="w-positions" label="Posiciones por piso" value={x} onChange={setX} />
        </div>
        <p className="font-mono text-lg font-semibold" data-testid="structure-preview">
          {e} × {p} × {x} = {e * p * x} ubicaciones
        </p>
        <p className="text-sm">
          Códigos de ejemplo: <span className="font-mono">{codes.join(" · ")}</span>
        </p>
      </fieldset>

      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-q-bad-fg">
          <CircleX aria-hidden className="mt-0.5 size-3.5" />
          {error.rule} {error.detail ? `(${error.detail}) ` : ""}
          {error.action}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {site === "externa" ? "Enviar a aprobación" : "Generar ubicaciones"}
        </Button>
      </div>
    </form>
  );
}
