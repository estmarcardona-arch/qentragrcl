import { CircleCheck, FilePlus, History, Pencil, PenLine, Lock } from "lucide-react";
import { cn } from "cn";
import { formatDateTime } from "@/lib/format";
import { MEANINGS, type SignatureMeaning } from "@/lib/gxp/meanings";
import type { AuditEntry } from "@/lib/gxp/actions";

const HIDDEN_FIELDS = new Set(["id", "created_at", "created_by", "updated_at", "updated_by"]);

function describe(entry: AuditEntry): { title: string; icon: typeof History; signed: boolean } {
  if (entry.tableName === "signatures" && entry.after) {
    const m = entry.after.meaning as SignatureMeaning;
    return { title: `Firmó como «${MEANINGS[m]?.stamp ?? m}»`, icon: PenLine, signed: true };
  }
  if (entry.tableName === "corrections" && entry.after) {
    return { title: `Corrigió «${String(entry.after.field)}»`, icon: Pencil, signed: false };
  }
  if (entry.action === "insert")
    return { title: "Creó el registro", icon: FilePlus, signed: false };
  if (entry.action === "update" && entry.after?.locked_at && !entry.before?.locked_at) {
    return { title: "Bloqueó el registro al firmar", icon: Lock, signed: false };
  }
  if (entry.action === "update")
    return { title: "Modificó el registro", icon: Pencil, signed: false };
  return { title: entry.action, icon: CircleCheck, signed: false };
}

function changes(entry: AuditEntry): { field: string; before: string; after: string }[] {
  if (entry.tableName === "corrections" && entry.after) {
    return [
      {
        field: String(entry.after.field),
        before: JSON.stringify(entry.after.old_value) ?? "",
        after: JSON.stringify(entry.after.new_value) ?? "",
      },
    ];
  }
  if (entry.action !== "update" || !entry.before || !entry.after) return [];
  return Object.keys(entry.after)
    .filter(
      (k) =>
        !HIDDEN_FIELDS.has(k) &&
        JSON.stringify(entry.before?.[k]) !== JSON.stringify(entry.after?.[k]),
    )
    .map((k) => ({
      field: k,
      before: String(entry.before?.[k] ?? "—"),
      after: String(entry.after?.[k] ?? "—"),
    }));
}

/** Panel de bitácora (Prompt 0, 5.e): cronológico, de solo lectura, antes → después y motivo. */
export function AuditTrailPanel({ code, entries }: { code: string; entries: AuditEntry[] }) {
  return (
    <aside
      aria-label="Bitácora del registro"
      className="overflow-hidden rounded-[10px] border border-border-strong bg-surface"
    >
      <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-4 py-3.5">
        <span>
          <b className="block text-base leading-[22px] font-semibold">Bitácora</b>
          <span className="font-mono text-xs font-medium text-text-secondary">{code}</span>
        </span>
        <History aria-hidden className="size-5 text-text-secondary" />
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-small text-text-secondary">Sin eventos registrados.</p>
      ) : (
        <ol className="grid">
          {entries.map((e, i) => {
            const d = describe(e);
            const diff = changes(e);
            return (
              <li
                key={e.id}
                className={cn(
                  "grid grid-cols-[28px_1fr] gap-3 px-4 py-3",
                  i > 0 && "border-t border-divider",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full",
                    d.signed
                      ? "bg-tram-firmada-bg text-white"
                      : "bg-primary-soft text-primary-hover",
                  )}
                >
                  <d.icon aria-hidden className="size-3.5" />
                </span>
                <div className="grid gap-1">
                  <span className="text-sm leading-5">
                    <b className="font-semibold">{e.actorName ?? "Sistema"}</b> · {d.title}
                  </span>
                  <span className="font-mono text-xs text-text-secondary">
                    {formatDateTime(e.at)}
                  </span>
                  {diff.map((c) => (
                    <span key={c.field} className="text-xs leading-4">
                      <span className="text-text-secondary">{c.field}: </span>
                      <del className="text-text-secondary">{c.before}</del> →{" "}
                      <b className="font-semibold">{c.after}</b>
                    </span>
                  ))}
                  {e.reason ? (
                    <span className="text-xs leading-4 text-text-strong">Motivo: {e.reason}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="border-t border-divider px-4 py-2 text-xs text-text-secondary">
        La bitácora no se puede modificar ni eliminar.
      </p>
    </aside>
  );
}
