"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCatalog } from "@/lib/admin/actions";
import { ReasonDialog } from "./reason-dialog";

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  /** Solo al crear (p. ej. el código). */
  createOnly?: boolean;
  mono?: boolean;
};

type Row = Record<string, unknown> & { id: string; version?: number };

function FieldInput({
  f,
  value,
  onChange,
}: {
  f: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `f-${f.name}`;
  if (f.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4"
        />
        {f.label}
      </label>
    );
  }
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-label uppercase">
        {f.label}
      </Label>
      {f.type === "select" ? (
        <select
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-9 rounded-md border border-border-control bg-white px-2 text-sm"
        >
          <option value="">—</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={id}
          type={f.type === "number" ? "number" : "text"}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) =>
            onChange(
              f.type === "number"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
          className={f.mono ? "font-mono" : undefined}
        />
      )}
    </div>
  );
}

function RowForm({
  fields,
  initial,
  creating,
  onChange,
}: {
  fields: FieldDef[];
  initial: Record<string, unknown>;
  creating: boolean;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState(initial);
  return (
    <div className="grid gap-3">
      {fields
        .filter((f) => creating || !f.createOnly)
        .map((f) => (
          <FieldInput
            key={f.name}
            f={f}
            value={values[f.name]}
            onChange={(v) => {
              const next = { ...values, [f.name]: v };
              setValues(next);
              onChange(next);
            }}
          />
        ))}
    </div>
  );
}

/**
 * Editor de catálogo (S-04): tabla con versión y estado; alta y edición con motivo (bitácora).
 * Los catálogos no se borran: se desactivan.
 */
export function CatalogEditor({
  table,
  rows,
  fields,
  columns,
  fixed,
  title,
  allowCreate = true,
}: {
  table: string;
  rows: Row[];
  fields: FieldDef[];
  /** Columnas visibles: [campo, encabezado]. */
  columns: [string, string][];
  /** Valores fijos al crear (p. ej. { catalog: "unidades" }). */
  fixed?: Record<string, unknown>;
  title: string;
  allowCreate?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  return (
    <section aria-label={title} className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-card-title">{title}</h2>
        {allowCreate ? (
          <ReasonDialog
            trigger={
              <Button size="sm">
                <Plus aria-hidden />
                Agregar
              </Button>
            }
            title={`Agregar a ${title.toLowerCase()}`}
            confirmLabel="Agregar"
            onOpen={() => setDraft({ active: true })}
            onConfirm={(reason) =>
              saveCatalog({ table, id: null, values: { ...fixed, ...draft }, reason })
            }
            onDone={() => {
              setDraft({});
              router.refresh();
            }}
          >
            <RowForm fields={fields} initial={{ active: true }} creating onChange={setDraft} />
          </ReasonDialog>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="bg-surface-sunken">
            <tr>
              {columns.map(([, h]) => (
                <th
                  key={h}
                  scope="col"
                  className="border-b border-border px-4 py-2.5 text-label text-text-strong uppercase"
                >
                  {h}
                </th>
              ))}
              <th
                scope="col"
                className="border-b border-border px-4 py-2.5 text-label text-text-strong uppercase"
              >
                Versión
              </th>
              <th scope="col" className="border-b border-border px-4 py-2.5">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-divider last:border-0">
                {columns.map(([c]) => {
                  const v = row[c];
                  const field = fields.find((f) => f.name === c);
                  return (
                    <td key={c} className={`px-4 py-2.5 ${field?.mono ? "font-mono text-xs" : ""}`}>
                      {c === "active" ? (
                        v ? (
                          <StatusBadge status="en_curso" label="Activo" />
                        ) : (
                          <StatusBadge status="bloqueada" label="Inactivo" />
                        )
                      ) : typeof v === "boolean" ? (
                        v ? (
                          "Sí"
                        ) : (
                          "No"
                        )
                      ) : field?.type === "select" ? (
                        (field.options?.find((o) => o.value === v)?.label ?? (v as string) ?? "—")
                      ) : (
                        String(v ?? "—")
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 font-mono text-xs">v{row.version ?? 1}</td>
                <td className="px-4 py-2.5 text-right">
                  <ReasonDialog
                    trigger={
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Editar ${String(row.name ?? row.label ?? row.code ?? "")}`}
                      >
                        <Pencil aria-hidden />
                        Editar
                      </Button>
                    }
                    title={`Editar ${String(row.name ?? row.label ?? row.code ?? "")}`}
                    confirmLabel="Guardar"
                    onOpen={() => setDraft({})}
                    onConfirm={(reason) => {
                      const changed = Object.fromEntries(
                        fields
                          .filter((f) => !f.createOnly && f.name in draft)
                          .map((f) => [f.name, draft[f.name]]),
                      );
                      return saveCatalog({ table, id: row.id, values: changed, reason });
                    }}
                    onDone={() => {
                      setDraft({});
                      router.refresh();
                    }}
                  >
                    <RowForm fields={fields} initial={row} creating={false} onChange={setDraft} />
                  </ReasonDialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
