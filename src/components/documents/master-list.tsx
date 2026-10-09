"use client";

import { CornerDownRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/gxp/status-badge";
import {
  LEVELS,
  VALIDITY_BADGE,
  VERSION_BADGE,
  docDate,
  type Validity,
  type VersionStatus,
} from "@/lib/documents/labels";

export type MasterRow = {
  id: string;
  code: string;
  title: string;
  origin: string;
  type_code: string | null;
  level: number;
  process_code: string | null;
  process_name: string | null;
  parent_code: string | null;
  document_status: string;
  version_label: string | null;
  version_status: string | null;
  issue_date: string | null;
  review_date: string | null;
  validity: string;
  external_pending_confirmation: boolean;
  children_count: number;
  open_version_no: number | null;
  open_version_status: string | null;
  /** Vista de un usuario de planta: estado de su capacitación en la versión vigente. */
  training?: "capacitado" | "pendiente" | null;
};

const ALL = "";

/** Tabla del listado maestro (S-44): filtros, búsqueda y formatos anidados bajo su procedimiento. */
export function MasterList({ rows, showTraining }: { rows: MasterRow[]; showTraining?: boolean }) {
  const [q, setQ] = useState("");
  const [proc, setProc] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const options = useMemo(
    () => ({
      procs: [...new Set(rows.map((r) => r.process_code).filter(Boolean))].sort() as string[],
      types: [...new Set(rows.map((r) => r.type_code).filter(Boolean))].sort() as string[],
    }),
    [rows],
  );

  const ordered = useMemo(() => {
    const codes = new Set(rows.map((r) => r.code));
    const parents = rows
      .filter((r) => !r.parent_code || !codes.has(r.parent_code))
      .sort((a, b) =>
        a.origin === b.origin ? a.code.localeCompare(b.code) : a.origin === "externo" ? 1 : -1,
      );
    const out: (MasterRow & { nested: boolean })[] = [];
    for (const p of parents) {
      out.push({ ...p, nested: false });
      for (const c of rows
        .filter((r) => r.parent_code === p.code)
        .sort((a, b) => a.code.localeCompare(b.code)))
        out.push({ ...c, nested: true });
    }
    return out;
  }, [rows]);

  const filtered = ordered.filter((r) => {
    const text = `${r.code} ${r.title}`.toLowerCase();
    return (
      (!q || text.includes(q.toLowerCase())) &&
      (!proc || r.process_code === proc) &&
      (!type || r.type_code === type) &&
      (!level || String(r.level) === level) &&
      (!status || r.version_status === status || r.document_status === status)
    );
  });

  return (
    <section aria-label="Listado maestro" className="grid gap-3">
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="relative grid min-w-[260px] flex-1 gap-1">
          <span className="text-label text-text-strong uppercase">Buscar</span>
          <Search aria-hidden className="absolute bottom-2.5 left-2.5 size-4 text-text-secondary" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Código o título"
            className="h-10 rounded-md border border-border-control bg-white pr-3 pl-8 text-sm"
          />
        </label>
        <Filter
          label="Proceso"
          value={proc}
          onChange={setProc}
          options={options.procs.map((p) => [p, p])}
        />
        <Filter
          label="Tipo"
          value={type}
          onChange={setType}
          options={options.types.map((t) => [t, t])}
        />
        <Filter
          label="Nivel"
          value={level}
          onChange={setLevel}
          options={Object.entries(LEVELS).map(([k, v]) => [k, `${k} · ${v}`])}
        />
        <Filter
          label="Estado"
          value={status}
          onChange={setStatus}
          options={Object.entries(VERSION_BADGE)
            .filter(([k]) => k !== "solicitado")
            .map(([k, v]) => [k, v.label])
            .concat([["anulado", "Anulado"]])}
        />
      </div>
      <p className="text-small text-text-secondary" aria-live="polite">
        {filtered.length === 0
          ? "Sin documentos con estos filtros"
          : `1–${filtered.length} de ${rows.length} documentos`}
      </p>
      <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
        <table className="w-full min-w-[1100px] text-left text-sm" data-testid="master-list">
          <caption className="sr-only">Listado maestro de documentos controlados</caption>
          <thead className="bg-surface-sunken">
            <tr>
              {[
                "Código",
                "Título",
                "Tipo · nivel",
                "Proceso",
                "Versión",
                "Emisión",
                "Revisión",
                "Trámite",
                "Vigencia",
                showTraining ? "Capacitación" : "Asociados",
              ].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="border-b border-border px-3 py-2.5 text-label uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const v = (r.version_status ?? "vigente") as VersionStatus;
              const validity = (r.validity ?? "sin_dato") as Validity;
              const tram =
                r.document_status === "anulado"
                  ? { status: "obsoleto" as const, label: "Anulado" }
                  : VERSION_BADGE[v];
              const highlight =
                validity === "vencido"
                  ? "bg-[#FEF3F3] shadow-[inset_3px_0_0_var(--color-q-bad-ic)]"
                  : validity === "por_vencer"
                    ? "bg-[#FFFBF0] shadow-[inset_3px_0_0_var(--color-q-warn-ic)]"
                    : r.nested
                      ? "bg-surface-sunken/50"
                      : "";
              return (
                <tr
                  key={r.id}
                  data-code={r.code}
                  className={`border-b border-divider last:border-0 ${highlight}`}
                >
                  <td className="px-3 py-2.5 font-mono text-[13px] font-semibold whitespace-nowrap">
                    <span className={r.nested ? "inline-flex items-center gap-1 pl-3.5" : ""}>
                      {r.nested ? (
                        <CornerDownRight aria-hidden className="size-3.5 text-text-muted" />
                      ) : null}
                      {r.origin === "externo" ? "Externo" : r.code}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/documentos/${r.id}`} className="font-medium">
                      {r.title}
                    </Link>
                    {r.external_pending_confirmation ? (
                      <span className="block text-xs text-text-secondary">Por confirmar</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {r.origin === "externo" ? "Ext" : r.type_code} · N{r.level}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{r.process_code ?? "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-[13px] font-semibold">
                    {r.version_label ?? "—"}
                    {r.open_version_no ? (
                      <span className="block font-sans text-[11px] font-normal text-text-secondary">
                        v{String(r.open_version_no).padStart(2, "0")}{" "}
                        {VERSION_BADGE[r.open_version_status as VersionStatus]?.label.toLowerCase()}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                    {r.origin === "externo" ? "Por confirmar" : docDate(r.issue_date)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                    {r.origin === "externo" ? "Por confirmar" : docDate(r.review_date)}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={tram.status} label={tram.label} />
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge
                      status={VALIDITY_BADGE[validity].status}
                      label={VALIDITY_BADGE[validity].label}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-small text-text-secondary">
                    {showTraining ? (
                      r.training ? (
                        <StatusBadge
                          status={r.training === "capacitado" ? "completada" : "pendiente"}
                          label={
                            r.training === "capacitado" ? "Capacitado" : "Pendiente de capacitación"
                          }
                        />
                      ) : (
                        "—"
                      )
                    ) : r.origin === "externo" ? (
                      "Control de distribución"
                    ) : r.children_count > 0 ? (
                      `${r.children_count} ${r.children_count === 1 ? "formato" : "formatos"}`
                    ) : r.parent_code ? (
                      `Formato de ${r.parent_code}`
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[][];
}) {
  return (
    <label className="grid gap-1">
      <span className="text-label text-text-strong uppercase">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-md border border-border-control bg-white px-2.5 text-sm"
      >
        <option value="">Todos</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
