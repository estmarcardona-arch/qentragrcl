import type { Metadata } from "next";
import { Check, Lock, Play } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/state-card";
import {
  AnnulmentActions,
  NewChangeRequest,
  ParentReviewActions,
} from "@/components/documents/changes-actions";
import { CopiesPanel, type CopyRow } from "@/components/documents/copies-panel";
import { StatusBadge } from "@/components/gxp/status-badge";
import { getDocAccess } from "@/lib/documents/access";
import {
  ORIGIN_LABELS,
  PARENT_REVIEW_LABELS,
  REQUEST_KIND_LABELS,
  VERSION_BADGE,
  type VersionStatus,
} from "@/lib/documents/labels";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Cambios y anulaciones · GRUFARCOL eBR" };

const CR_STATUS: Record<
  string,
  { status: "en_curso" | "pendiente" | "completada"; label: string }
> = {
  abierta: { status: "pendiente", label: "Abierta" },
  en_elaboracion: { status: "en_curso", label: "En elaboración" },
  cerrada: { status: "completada", label: "Cerrada" },
};
const AN_STATUS: Record<
  string,
  { status: "pendiente" | "en_curso" | "completada" | "bloqueada"; label: string }
> = {
  solicitada: { status: "pendiente", label: "Pendiente de decisión" },
  aprobada: { status: "en_curso", label: "Recolección pendiente" },
  rechazada: { status: "bloqueada", label: "Rechazada" },
  cerrada: { status: "completada", label: "Cerrada · anulado" },
};

// S-48 · Control de cambios y anulaciones documentales (RF-99, RF-100).
export default async function ChangesPage({ searchParams }: PageProps<"/documentos/cambios">) {
  const sp = await searchParams;
  const a = await getDocAccess();
  const { supabase, ctx } = a;
  const [
    { data: changes },
    { data: requests },
    { data: annulments },
    { data: docs },
    { data: people },
  ] = await Promise.all([
    supabase
      .from("document_change_requests")
      .select("*, controlled_documents(id, code, title, parent_code)")
      .order("created_at", { ascending: false }),
    supabase
      .from("document_requests")
      .select("*, controlled_documents!document_requests_document_id_fkey(code, title)")
      .in("kind", ["creacion", "modificacion"])
      .order("created_at", { ascending: false }),
    supabase
      .from("document_annulments")
      .select("*, controlled_documents(id, code, title)")
      .order("created_at", { ascending: false }),
    supabase
      .from("controlled_documents")
      .select("id, code, title")
      .eq("status", "vigente")
      .eq("origin", "interno")
      .order("code"),
    supabase
      .from("profiles")
      .select("id, full_name, job_title")
      .eq("active", true)
      .order("full_name"),
  ]);
  const versionIds = await supabase
    .from("document_versions")
    .select("id, status, version_no, change_request_id, request_id, document_id");
  const vers = versionIds.data ?? [];
  const name = (id: string | null) => people?.find((p) => p.id === id)?.full_name ?? "—";
  type Row = {
    key: string;
    code: string;
    kind: string;
    doc: string;
    status: { status: never | string; label: string };
  };
  const rows: Row[] = [
    ...(changes ?? []).map((c) => {
      const d = c.controlled_documents as unknown as { code: string; title: string } | null;
      return {
        key: `sc=${c.code}`,
        code: c.code,
        kind: "Modificación",
        doc: `${d?.code ?? ""} · ${c.reason}`,
        status: CR_STATUS[c.status],
      };
    }),
    ...(requests ?? [])
      .filter((r) => r.status !== "cerrada")
      .map((r) => {
        const v = vers.find((x) => x.request_id === r.id);
        const d = r.controlled_documents as unknown as { code: string } | null;
        const vb = v ? VERSION_BADGE[v.status as VersionStatus] : null;
        return {
          key: `solicitud=${r.code}`,
          code: r.code,
          kind: REQUEST_KIND_LABELS[r.kind],
          doc: `${d?.code ?? (v?.document_id ? "" : "Sin código")} · ${r.proposed_title ?? r.reason}`,
          status: vb
            ? { status: vb.status, label: vb.label }
            : { status: "pendiente", label: "Abierta" },
        };
      }),
    ...(annulments ?? []).map((n) => {
      const d = n.controlled_documents as unknown as { code: string; title: string } | null;
      return {
        key: `an=${n.code}`,
        code: n.code,
        kind: "Anulación",
        doc: `${d?.code ?? ""} · ${d?.title ?? ""}`,
        status: AN_STATUS[n.status],
      };
    }),
  ];
  const openCount = rows.filter(
    (r) => !["Cerrada", "Cerrada · anulado", "Rechazada"].includes(r.status.label),
  ).length;
  const selKey = sp.sc
    ? `sc=${sp.sc}`
    : sp.an
      ? `an=${sp.an}`
      : sp.solicitud
        ? `solicitud=${sp.solicitud}`
        : rows[0]?.key;
  const selCr = (changes ?? []).find((c) => `sc=${c.code}` === selKey);
  const selAn = (annulments ?? []).find((n) => `an=${n.code}` === selKey);
  const selReq = (requests ?? []).find((r) => `solicitud=${r.code}` === selKey);

  let anCopies: CopyRow[] = [];
  if (selAn) {
    const docVers = vers.filter((v) => v.document_id === selAn.document_id);
    const { data: dist } = await supabase
      .from("document_distribution")
      .select("*, organizational_areas(name)")
      .in(
        "version_id",
        docVers.length ? docVers.map((v) => v.id) : ["00000000-0000-0000-0000-000000000000"],
      );
    anCopies = (dist ?? []).map((r) => ({
      id: r.id,
      versionNo: docVers.find((v) => v.id === r.version_id)?.version_no ?? 0,
      target:
        (r.organizational_areas as unknown as { name: string } | null)?.name ?? r.recipient ?? "—",
      copyType: r.copy_type as CopyRow["copyType"],
      deliveredAt: r.delivered_at,
      recalledAt: r.recalled_at,
      recallNote: r.recall_note,
    }));
  }

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Control de cambios"
        description="Solicitudes de modificación, creación y anulación"
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Documentos", href: "/documentos" },
          { label: "Control de cambios" },
        ]}
        actions={
          a.canAuthor ? (
            <NewChangeRequest
              documents={(docs ?? []).map((d) => ({ id: d.id, label: `${d.code} · ${d.title}` }))}
              people={(people ?? []).map((p) => ({
                id: p.id,
                label: `${p.full_name}${p.job_title ? ` · ${p.job_title}` : ""}`,
              }))}
              canAssignAuthor={a.isAqDoc || a.isAqDir}
            />
          ) : null
        }
      />
      <section aria-labelledby="sol" className="grid gap-2">
        <h2 id="sol" className="text-card-title">
          Solicitudes de cambio, creación y anulación{" "}
          <span className="text-small font-normal text-text-secondary">· {openCount} abiertas</span>
        </h2>
        {rows.length === 0 ? (
          <EmptyState
            title="No hay solicitudes"
            text="Las solicitudes de cambio, creación y anulación aparecerán aquí."
          />
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
            <table className="w-full text-left text-sm" data-testid="change-requests">
              <caption className="sr-only">Solicitudes documentales</caption>
              <thead className="bg-surface-sunken">
                <tr>
                  {["Código", "Tipo", "Documento y motivo", "Estado"].map((h) => (
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
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    data-code={r.code}
                    className={cn(
                      "border-b border-divider last:border-0",
                      r.key === selKey &&
                        "bg-tram-revision-bg shadow-[inset_3px_0_0_var(--color-primary)]",
                    )}
                  >
                    <td className="px-3 py-2.5 font-mono text-[13px] font-semibold">
                      <Link href={`/documentos/cambios?${r.key}`}>{r.code}</Link>
                    </td>
                    <td className="px-3 py-2.5">{r.kind}</td>
                    <td className="px-3 py-2.5">{r.doc}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={r.status.status as "pendiente"} label={r.status.label} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selCr
        ? (() => {
            const d = selCr.controlled_documents as unknown as {
              id: string;
              code: string;
              title: string;
              parent_code: string | null;
            };
            const v = vers.find((x) => x.change_request_id === selCr.id);
            return (
              <section
                aria-label={`Detalle de ${selCr.code}`}
                className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-card-title">
                    {selCr.code} · Modificación de {d.code}
                  </h2>
                  <StatusBadge
                    status={CR_STATUS[selCr.status].status}
                    label={CR_STATUS[selCr.status].label}
                  />
                </div>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-sm">
                  <dt className="text-text-secondary">Origen</dt>
                  <dd>
                    {ORIGIN_LABELS[selCr.origin]}
                    {selCr.origin_ref ? ` · ${selCr.origin_ref}` : ""}
                  </dd>
                  <dt className="text-text-secondary">Motivo</dt>
                  <dd>{selCr.reason}</dd>
                  <dt className="text-text-secondary">Impacto</dt>
                  <dd>{selCr.impact || "—"}</dd>
                  <dt className="text-text-secondary">Documento afectado</dt>
                  <dd>
                    <Link href={`/documentos/${d.id}`}>
                      {d.code} · {d.title}
                    </Link>
                  </dd>
                  <dt className="text-text-secondary">Versión nueva</dt>
                  <dd>
                    {v ? (
                      <Link href={`/documentos/${d.id}?v=${v.version_no}`}>
                        v{String(v.version_no).padStart(2, "0")} ·{" "}
                        {VERSION_BADGE[v.status as VersionStatus].label}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                  <dt className="text-text-secondary">Solicitó</dt>
                  <dd>
                    {name(selCr.requested_by)} · {formatDate(selCr.created_at)}
                  </dd>
                </dl>
                {selCr.parent_review ? (
                  <div
                    className="grid gap-2 rounded-lg border border-border bg-surface-sunken p-3.5"
                    data-testid="parent-review"
                  >
                    <b className="text-sm font-semibold">
                      Revisión del procedimiento padre {d.parent_code}:{" "}
                      {PARENT_REVIEW_LABELS[selCr.parent_review]}
                    </b>
                    <p className="text-small text-text-secondary">
                      {selCr.parent_review === "pendiente"
                        ? "El cambio es técnico y el documento es un formato: antes de publicar la versión nueva se revisa su procedimiento padre."
                        : `Registrada por ${name(selCr.parent_review_by)} el ${selCr.parent_review_at ? formatDateTime(selCr.parent_review_at) : ""}: ${selCr.parent_review_note ?? ""}`}
                    </p>
                    {selCr.parent_review === "pendiente" && (a.isAqDir || a.isAqDoc) ? (
                      <ParentReviewActions
                        changeRequestId={selCr.id}
                        parentCode={d.parent_code ?? "padre"}
                      />
                    ) : null}
                  </div>
                ) : null}
                <p className="text-small text-text-secondary">
                  {selCr.status === "cerrada"
                    ? `Cerrada el ${selCr.closed_at ? formatDate(selCr.closed_at) : ""} al quedar vigente la versión nueva.`
                    : "Se cierra automáticamente cuando la versión nueva queda vigente."}
                </p>
              </section>
            );
          })()
        : null}

      {selReq
        ? (() => {
            const v = vers.find((x) => x.request_id === selReq.id);
            return (
              <section
                aria-label={`Detalle de ${selReq.code}`}
                className="grid gap-2 rounded-[10px] border border-border bg-surface p-5 text-sm"
              >
                <h2 className="text-card-title">
                  {selReq.code} · {REQUEST_KIND_LABELS[selReq.kind]}
                </h2>
                <p>
                  {selReq.proposed_title} · solicitó {name(selReq.requested_by)} el{" "}
                  {formatDate(selReq.created_at)}
                </p>
                <p className="text-text-secondary">Motivo: {selReq.reason}</p>
                {v ? (
                  <Link href={`/documentos/versiones/${v.id}`}>
                    Abrir la versión ({VERSION_BADGE[v.status as VersionStatus].label})
                  </Link>
                ) : null}
              </section>
            );
          })()
        : null}

      {selAn
        ? (() => {
            const d = selAn.controlled_documents as unknown as {
              id: string;
              code: string;
              title: string;
            };
            const controlled = anCopies.filter((c) => c.copyType === "controlada");
            const recalled = controlled.filter((c) => c.recalledAt).length;
            const steps = [
              { label: "Solicitud del jefe de área", sub: name(selAn.requested_by), state: "done" },
              {
                label: "Decisión de viabilidad",
                sub: selAn.decided_by ? name(selAn.decided_by) : "Aseguramiento de la calidad",
                state: selAn.decision ? "done" : "cur",
              },
              {
                label: "Recolección de copias",
                sub: `${recalled} de ${controlled.length} recogidas`,
                state:
                  selAn.status === "cerrada" ? "done" : selAn.status === "aprobada" ? "cur" : "pen",
              },
              {
                label: "Sello OBSOLETO y archivo",
                sub: "Se conserva 5 años",
                state: selAn.status === "cerrada" ? "done" : "pen",
              },
              {
                label: "Listado maestro",
                sub: selAn.status === "cerrada" ? "Actualizado" : "Pendiente",
                state: selAn.status === "cerrada" ? "done" : "pen",
              },
            ];
            const pendingTargets = controlled.filter((c) => !c.recalledAt).map((c) => c.target);
            return (
              <section
                aria-label={`Detalle de ${selAn.code}`}
                className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-card-title">
                    {selAn.code} · Anulación de {d.code} · {d.title}
                  </h2>
                  <StatusBadge
                    status={AN_STATUS[selAn.status].status}
                    label={AN_STATUS[selAn.status].label}
                  />
                </div>
                <ol
                  className="grid grid-cols-5 gap-2 max-[1279px]:grid-cols-3"
                  aria-label="Flujo de la anulación"
                >
                  {steps.map((s) => (
                    <li key={s.label} className="grid justify-items-center gap-1 text-center">
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full border-2",
                          s.state === "done" && "border-primary bg-primary text-white",
                          s.state === "cur" && "border-primary bg-white text-primary",
                          s.state === "pen" &&
                            "border-border-control bg-surface-sunken text-text-secondary",
                        )}
                      >
                        {s.state === "done" ? (
                          <Check aria-hidden className="size-4" />
                        ) : s.state === "cur" ? (
                          <Play aria-hidden className="size-4" />
                        ) : (
                          <Lock aria-hidden className="size-4" />
                        )}
                      </span>
                      <b className="text-sm font-semibold">{s.label}</b>
                      <span className="text-xs text-text-secondary">{s.sub}</span>
                    </li>
                  ))}
                </ol>
                <p className="text-sm">
                  Motivo: {selAn.reason}
                  {selAn.decision_reason ? ` · Decisión: ${selAn.decision_reason}` : ""}
                </p>
                {selAn.status === "aprobada" && pendingTargets.length ? (
                  <p
                    role="note"
                    className="flex items-center gap-2 rounded-lg border border-neutral-strong bg-surface-sunken px-3.5 py-2.5 text-sm"
                  >
                    <Lock aria-hidden className="size-4" />
                    No se puede cerrar la anulación: falta recoger la copia de{" "}
                    {pendingTargets.join(", ")}.
                  </p>
                ) : null}
                <AnnulmentActions
                  annulmentId={selAn.id}
                  code={selAn.code}
                  docLabel={`${d.code} · ${d.title}`}
                  signer={`${ctx.fullName}${ctx.shortSignature ? ` (${ctx.shortSignature})` : ""}`}
                  canDecide={
                    a.isAqDir && selAn.status === "solicitada" && selAn.requested_by !== ctx.userId
                  }
                  canClose={(a.isAqDoc || a.isAqDir) && selAn.status === "aprobada"}
                />
                <CopiesPanel
                  rows={anCopies}
                  canManage={a.isAqDoc && selAn.status !== "cerrada"}
                  vigenteVersionId={null}
                />
              </section>
            );
          })()
        : null}
    </main>
  );
}
