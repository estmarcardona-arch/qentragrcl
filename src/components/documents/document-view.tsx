import { ControlledDocumentHeader, CopyStamp } from "@/components/gxp/controlled-document-header";
import { SECTIONS, docDate, versionLabel } from "@/lib/documents/labels";
import { formatDocumentDate } from "@/lib/format";

export type SignatureBoxRow = {
  meaning: "actualizo" | "reviso" | "aprobo";
  name: string;
  jobTitle: string | null;
  shortSignature: string;
  signedAt: string;
} | null;

export type HistoryRow = {
  version_no: number;
  issue_date: string | null;
  change_description: string;
};

const BOX: { meaning: "actualizo" | "reviso" | "aprobo"; label: string }[] = [
  { meaning: "actualizo", label: "Actualizado por" },
  { meaning: "reviso", label: "Revisado por" },
  { meaning: "aprobo", label: "Aprobado por" },
];

/**
 * Vista del documento controlado (PRD 2.5.3): encabezado, cuerpo con las secciones mínimas, historial de
 * actualizaciones (últimas tres) y cuadro de firmas; sello de copia y marca de agua OBSOLETO (RF-103).
 */
export function DocumentView({
  title,
  code,
  versionNo,
  issueDate,
  reviewDate,
  statusLabel,
  content,
  history,
  signatures,
  copy,
}: {
  title: string;
  code: string;
  versionNo: number;
  issueDate: string | null;
  reviewDate: string | null;
  statusLabel: string;
  content: Record<string, string>;
  history: HistoryRow[];
  signatures: SignatureBoxRow[];
  copy: "controlada" | "no_controlada" | "obsoleto";
}) {
  const obsolete = copy === "obsoleto";
  return (
    <article
      aria-label={`Documento ${code}`}
      className="relative grid gap-0 overflow-hidden rounded-[10px] border border-border bg-surface p-5"
    >
      {obsolete ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex [transform:rotate(-24deg)] items-center justify-center text-[120px] font-black tracking-[.1em] text-neutral-strong/10 select-none"
        >
          OBSOLETO
        </span>
      ) : null}
      <ControlledDocumentHeader
        title={title}
        code={code}
        version={versionLabel(versionNo)}
        issueDate={issueDate ?? "—"}
        reviewDate={reviewDate ?? "—"}
        page={1}
        pageCount={1}
        status={statusLabel}
      />
      <div className="grid gap-4 py-5">
        {SECTIONS.filter((s) => s.key in content).map((s, i) => (
          <section key={s.key} className="grid gap-1">
            <h3 className="text-sm font-semibold uppercase">
              {i + 1}. {s.label}
            </h3>
            <p className="text-sm leading-6 whitespace-pre-line">{content[s.key] || "—"}</p>
          </section>
        ))}
      </div>
      <footer className="grid gap-4 border-t-2 border-foreground pt-4">
        <section aria-label="Historial de actualizaciones" className="grid gap-1">
          <h3 className="text-label text-text-strong uppercase">Historial de actualizaciones</h3>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-1 pr-3 font-semibold">
                  Versión
                </th>
                <th scope="col" className="py-1 pr-3 font-semibold">
                  Fecha
                </th>
                <th scope="col" className="py-1 font-semibold">
                  Descripción
                </th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 3).map((h) => (
                <tr key={h.version_no} className="border-b border-divider">
                  <td className="py-1 pr-3 font-mono">{versionLabel(h.version_no)}</td>
                  <td className="py-1 pr-3 font-mono">{docDate(h.issue_date)}</td>
                  <td className="py-1">{h.change_description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section
          aria-label="Cuadro de firmas"
          data-testid="signature-box"
          className="grid grid-cols-3 border border-foreground text-[13px]"
        >
          {BOX.map((b, i) => {
            const s = signatures.find((x) => x?.meaning === b.meaning) ?? null;
            return (
              <div
                key={b.meaning}
                className={`grid gap-0.5 p-2.5 ${i < 2 ? "border-r border-foreground" : ""}`}
                data-meaning={b.meaning}
              >
                <span className="text-[10px] font-semibold tracking-[.04em] text-text-secondary uppercase">
                  {b.label}
                </span>
                {s ? (
                  <>
                    <b className="font-semibold">{s.name}</b>
                    <span className="text-text-secondary">{s.jobTitle ?? ""}</span>
                    <span className="font-mono text-xs">
                      {s.shortSignature} · {formatDocumentDate(s.signedAt)}
                    </span>
                  </>
                ) : (
                  <span className="text-text-muted">Pendiente</span>
                )}
              </div>
            );
          })}
        </section>
        <div className="flex justify-end">
          <CopyStamp kind={copy} />
        </div>
      </footer>
    </article>
  );
}
