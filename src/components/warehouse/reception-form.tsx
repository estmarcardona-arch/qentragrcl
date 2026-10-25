"use client";

import { Check, CircleX, Info, Lock, TriangleAlert, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  importReceipts,
  receiveLot,
  suggestLocations,
  type ImportRow,
  type ReceiptInput,
  type WhResult,
} from "@/lib/warehouse/actions";

export type MaterialOpt = {
  id: string;
  code: string;
  name: string;
  unit: string;
  requiresCoa: boolean;
};
export type Opt = { id: string; label: string };

const selectCls =
  "h-10 w-full min-w-0 truncate rounded-md border border-border-control bg-white px-2.5 text-sm";

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

/**
 * S-11 · Recepción de materia prima y materiales (RF-20): el lote entra en CUARENTENA en una ubicación compatible
 * con su tipo (el sistema propone las libres de la zona de cuarentena) y se genera el rótulo.
 */
export function ReceptionForm({
  materials,
  suppliers,
  locations,
  receivedBy,
  now,
}: {
  materials: MaterialOpt[];
  suppliers: Opt[];
  locations: Opt[];
  receivedBy: string;
  now: string;
}) {
  const router = useRouter();
  const [d, setD] = useState<ReceiptInput>({
    material_id: "",
    supplier_id: "",
    supplier_lot: "",
    expiry_date: "",
    qty: null,
    unit: "kg",
    coa_ref: "",
    observations: "",
  });
  const [suggested, setSuggested] = useState<{ id: string; code: string; zone: string }[]>([]);
  const [loc, setLoc] = useState("");
  const [error, setError] = useState<Exclude<WhResult, { ok: true }> | null>(null);
  const [tried, setTried] = useState(false);
  const [pending, start] = useTransition();
  const mat = materials.find((m) => m.id === d.material_id);
  const set = <K extends keyof ReceiptInput>(k: K, v: ReceiptInput[K]) => setD({ ...d, [k]: v });
  const pickMaterial = (id: string) => {
    const m = materials.find((x) => x.id === id);
    setD({ ...d, material_id: id, unit: m?.unit ?? d.unit });
    setLoc("");
    setSuggested([]);
    if (id)
      start(async () => {
        const res = await suggestLocations({ materialId: id });
        if (res.ok) {
          setSuggested(res.locations);
          setLoc(res.locations[0]?.id ?? "");
        }
      });
  };
  const checks = [
    {
      ok: Boolean(d.material_id && d.supplier_id),
      t: "Material y proveedor",
      miss: "Falta material o proveedor",
    },
    {
      ok: Boolean(d.supplier_lot.trim()),
      t: "Lote del proveedor",
      miss: "Falta lote del proveedor",
    },
    { ok: Boolean(d.expiry_date), t: "Fecha de vencimiento", miss: "Falta fecha de vencimiento" },
    { ok: Boolean(d.qty && d.qty > 0), t: "Cantidad recibida", miss: "Falta la cantidad" },
    {
      ok: !mat?.requiresCoa || Boolean(d.coa_ref.trim()),
      t: "Certificado de análisis",
      miss: "Falta el certificado de análisis (CoA)",
    },
    { ok: Boolean(loc), t: "Ubicación asignada", miss: "Falta asignar la ubicación" },
  ];
  const missing = checks.filter((c) => !c.ok);
  const fieldErr = (ok: boolean, msg: string) =>
    tried && !ok ? (
      <span className="flex items-center gap-1 text-xs font-medium text-q-bad-fg">
        <CircleX aria-hidden className="size-3.5" />
        {msg}
      </span>
    ) : null;
  const locCode =
    suggested.find((s) => s.id === loc)?.code ?? locations.find((l) => l.id === loc)?.label;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-5 max-[1279px]:grid-cols-1">
      <section
        aria-labelledby="datos"
        className="grid content-start gap-4 rounded-[10px] border border-border bg-surface p-5"
      >
        <h2 id="datos" className="text-card-title">
          Datos de la recepción
        </h2>
        {tried && missing.length ? (
          <p
            role="alert"
            className="flex items-center gap-1.5 rounded-lg border border-q-bad-bd bg-q-bad-bg px-3.5 py-2.5 text-sm text-q-bad-fg"
          >
            <CircleX aria-hidden className="size-4" />
            Revise {missing.length} campo{missing.length > 1 ? "s" : ""}:{" "}
            {missing.map((m) => m.miss).join(", ")}.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-4 max-[1279px]:grid-cols-1">
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="r-material" className="text-label uppercase">
              Material *
            </Label>
            <select
              id="r-material"
              value={d.material_id}
              onChange={(e) => pickMaterial(e.target.value)}
              className={selectCls}
            >
              <option value="">Seleccione…</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.code}
                </option>
              ))}
            </select>
            <span className="text-xs text-text-secondary">
              Se asigna el código interno al recibir.
            </span>
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="r-supplier" className="text-label uppercase">
              Proveedor *
            </Label>
            <select
              id="r-supplier"
              value={d.supplier_id}
              onChange={(e) => set("supplier_id", e.target.value)}
              className={selectCls}
            >
              <option value="">Seleccione…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="r-lot" className="text-label uppercase">
              Lote del proveedor *
            </Label>
            <Input
              id="r-lot"
              className="font-mono"
              value={d.supplier_lot}
              onChange={(e) => set("supplier_lot", e.target.value)}
            />
            {fieldErr(Boolean(d.supplier_lot.trim()), "Falta lote del proveedor")}
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="r-expiry" className="text-label uppercase">
              Fecha de vencimiento *
            </Label>
            <Input
              id="r-expiry"
              type="date"
              value={d.expiry_date}
              aria-invalid={tried && !d.expiry_date}
              className={cn(tried && !d.expiry_date && "border-q-bad-fg")}
              onChange={(e) => set("expiry_date", e.target.value)}
            />
            {fieldErr(Boolean(d.expiry_date), "Falta fecha de vencimiento")}
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="r-qty" className="text-label uppercase">
              Cantidad recibida * ({d.unit})
            </Label>
            <Input
              id="r-qty"
              type="number"
              step="any"
              value={d.qty ?? ""}
              onChange={(e) => set("qty", e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="r-received" className="text-label uppercase">
              Fecha de recepción
            </Label>
            <span className="flex h-10 items-center gap-2 rounded-md border border-border bg-surface-sunken px-2.5 text-sm text-text-secondary">
              <Lock aria-hidden className="size-3.5" />
              {now}
            </span>
            <span className="text-xs text-text-secondary">Hora del servidor; no editable.</span>
          </div>
          <div className="col-span-2 grid min-w-0 gap-1.5 max-[1279px]:col-span-1">
            <Label htmlFor="r-coa" className="text-label uppercase">
              Certificado de análisis del proveedor (CoA){mat?.requiresCoa ? " *" : ""}
            </Label>
            <Input
              id="r-coa"
              placeholder="Referencia o nombre del archivo, p. ej. CoA-FEN-2510-C.pdf"
              value={d.coa_ref}
              onChange={(e) => set("coa_ref", e.target.value)}
            />
            <span className="text-xs text-text-secondary">
              Registre la referencia del CoA; el adjunto se habilitará con el almacenamiento de
              archivos (D-38).
            </span>
          </div>
          <div className="col-span-2 grid min-w-0 gap-1.5 max-[1279px]:col-span-1">
            <Label htmlFor="r-obs" className="text-label uppercase">
              Observaciones
            </Label>
            <Textarea
              id="r-obs"
              rows={2}
              value={d.observations}
              onChange={(e) => set("observations", e.target.value)}
            />
          </div>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-label text-text-strong uppercase">Ubicación *</legend>
          {!d.material_id ? (
            <span className="text-sm text-text-secondary">
              Seleccione el material para ver las ubicaciones libres compatibles.
            </span>
          ) : suggested.length ? (
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Ubicaciones sugeridas"
            >
              {suggested.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={loc === s.id}
                  onClick={() => setLoc(s.id)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left font-mono text-[13px]",
                    loc === s.id
                      ? "border-primary bg-primary text-white"
                      : "border-border-control bg-white",
                  )}
                >
                  {s.code}
                  {s.zone === "cuarentena" ? (
                    <span className="block font-sans text-[11px]">Zona de cuarentena</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-sm text-text-secondary">
              No hay ubicaciones libres compatibles con este material.
            </span>
          )}
          <label className="grid max-w-sm gap-1.5">
            <span className="text-xs text-text-secondary">
              Otra ubicación (la base valida tipo de material y zona)
            </span>
            <select
              value={suggested.some((s) => s.id === loc) ? "" : loc}
              onChange={(e) => setLoc(e.target.value)}
              className={selectCls}
            >
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      </section>

      <aside aria-label="Resumen" className="grid content-start gap-3">
        <div className="grid gap-2 rounded-[10px] border border-q-warn-bd bg-q-warn-bg p-4 text-q-warn-fg">
          <span className="flex items-center gap-2 text-base font-semibold">
            <TriangleAlert aria-hidden className="size-5" />
            Se recibirá en CUARENTENA
          </span>
          <span className="text-sm">No se puede dispensar hasta que Calidad la apruebe.</span>
        </div>
        <dl className="grid gap-1.5 rounded-[10px] border border-border bg-surface p-4 text-sm">
          {[
            ["Material", mat ? mat.name : "—"],
            ["Proveedor", suppliers.find((s) => s.id === d.supplier_id)?.label ?? "—"],
            ["Cantidad", d.qty ? `${d.qty} ${d.unit}` : "—"],
            ["Ubicación", locCode ?? "—"],
            ["Recibe", receivedBy],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-text-secondary">{k}</dt>
              <dd className={cn("text-right", k === "Ubicación" && "font-mono font-semibold")}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        <ul className="grid gap-1 text-sm" aria-label="Lista de verificación">
          {checks.map((c) => (
            <li
              key={c.t}
              className={cn(
                "flex items-center gap-1.5",
                c.ok ? "text-text-strong" : "text-q-bad-fg",
              )}
            >
              {c.ok ? (
                <Check aria-hidden className="size-4" />
              ) : (
                <CircleX aria-hidden className="size-4" />
              )}
              {c.ok ? c.t : c.miss}
            </li>
          ))}
        </ul>
        <ErrorLine error={error} />
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            setTried(true);
            if (missing.length) return;
            start(async () => {
              const res = await receiveLot({ data: d, locationId: loc });
              if (!res.ok) return setError(res);
              router.push(`/bodega/rotulos/${res.id}?nuevo=1`);
            });
          }}
        >
          Recibir y generar rótulo
        </Button>
        <span className="flex items-start gap-1.5 text-xs text-text-secondary">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {missing.length && tried
            ? `No disponible: ${missing[0].miss.toLowerCase()}.`
            : "Genera el código interno y el rótulo de CUARENTENA."}
        </span>
      </aside>
    </div>
  );
}

const TEMPLATE =
  "material_code;supplier_name;supplier_lot;expiry_date;qty;unit;coa_ref;location_code;observations\n" +
  "MP-031;Química Andina S.A.S.;FEN-2510-C;15/03/2028;50,00;kg;CoA-FEN-2510-C.pdf;MP-E01-P1-01;Envase íntegro\n";

/** Convierte una fecha DD/MM/AAAA (o AAAA-MM-DD) y un número es-CO (1.234,56) al formato de la base. */
function normalize(row: ImportRow): ImportRow {
  const out = { ...row };
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row.expiry_date ?? "");
  if (m) out.expiry_date = `${m[3]}-${m[2]}-${m[1]}`;
  if (row.qty) out.qty = row.qty.replace(/\./g, "").replace(",", ".");
  return out;
}

export function parseCsv(text: string): ImportRow[] {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const head = lines[0].split(sep).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = l.split(sep);
    return normalize(Object.fromEntries(head.map((h, i) => [h, (cells[i] ?? "").trim()])));
  });
}

/** D-03 · Importación de recepciones desde CSV: todas las filas o ninguna; cada lote entra en cuarentena. */
export function ReceiptImport() {
  const router = useRouter();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [file, setFile] = useState("");
  const [error, setError] = useState<Exclude<WhResult, { ok: true }> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section
      aria-labelledby="importar"
      className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
    >
      <h2 id="importar" className="text-card-title">
        Importar recepciones (CSV)
      </h2>
      <p className="text-sm text-text-secondary">
        Sin integración con el ERP (D-03): cargue un archivo con una fila por lote. Se importan
        todas las filas o ninguna, y cada lote entra en cuarentena como cualquier recepción.{" "}
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${TEMPLATE}`)}`}
          download="plantilla-recepciones.csv"
        >
          Descargar plantilla
        </a>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-primary px-3 py-2 text-sm font-semibold text-primary">
          <Upload aria-hidden className="size-4" />
          Elegir archivo
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFile(f.name);
              setRows(parseCsv(await f.text()));
              setMsg(null);
              setError(null);
            }}
          />
        </label>
        <span className="text-sm">
          {file ? `${file} · ${rows.length} fila(s)` : "Ningún archivo seleccionado"}
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={!rows.length || pending}
          onClick={() =>
            start(async () => {
              const res = await importReceipts({ rows });
              if (!res.ok) {
                setMsg(null);
                return setError(res);
              }
              setError(null);
              setMsg(`Se importaron ${res.imported} lote(s) en cuarentena.`);
              setRows([]);
              router.refresh();
            })
          }
        >
          Importar {rows.length ? `${rows.length} fila(s)` : ""}
        </Button>
      </div>
      <ErrorLine error={error} />
      {msg ? (
        <p role="status" className="text-sm font-medium text-tram-en-curso-fg">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
