import type { Metadata } from "next";
import { Check, Lock, Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "cn";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/state-card";
import { CopiesPanel, type CopyRow } from "@/components/documents/copies-panel";
import { DocumentView, type SignatureBoxRow } from "@/components/documents/document-view";
import { DraftEditor } from "@/components/documents/draft-editor";
import { VersionActions } from "@/components/documents/version-actions";
import { AuditTrailPanel } from "@/components/gxp/audit-trail-panel";
import { SodNotice } from "@/components/gxp/sod-notice";
import { StatusBadge } from "@/components/gxp/status-badge";
import { getDocAccess } from "@/lib/documents/access";
import { loadDocument } from "@/lib/documents/detail";
import {
  ORIGIN_LABELS,
  PARENT_REVIEW_LABELS,
  VALIDITY_BADGE,
  VERSION_BADGE,
  docDate,
  versionLabel,
  type Validity,
  type VersionStatus,
} from "@/lib/documents/labels";
import type { Observation } from "@/lib/documents/actions";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/gxp/actions";
import { callRpc } from "@/lib/rpc";

export const metadata: Metadata = { title: "Documento · GRUFARCOL eBR" };

const TABS = [
  ["documento", "Documento"],
  ["versiones", "Versiones"],
  ["flujo", "Flujo"],
  ["firmas", "Firmas"],
  ["copias", "Copias y distribución"],
  ["bitacora", "Bitácora"],
  ["lotes", "Usado en lotes"],
] as const;
type Tab = (typeof TABS)[number][0];

// S-46 · Detalle del documento (RF-95, RF-96, RF-101): versiones, flujo, firmas, copias, bitácora y lotes.
export default async function DocumentPage({
  params,
  searchParams,
}: PageProps<"/documentos/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const a = await getDocAccess();
  const { supabase, ctx } = a;
  const d = await loadDocument(supabase, id);
  if (!d) notFound();
  const { doc, versions } = d;
  const tab = (TABS.find(([t]) => t === sp.tab)?.[0] ?? "documento") as Tab;
  const current = versions.find((v) => v.id === doc.current_version_id) ?? null;
  const open = versions.find((v) => !["vigente", "obsoleto"].includes(v.status)) ?? null;
  const sel =
    versions.find((v) => String(v.version_no) === sp.v) ??
    (doc.origin === "externo" ? null : (current ?? open ?? versions[0] ?? null));
  const base = `/documentos/${id}`;
  const qs = (t: Tab, v?: number) =>
    `${base}?tab=${t}${v ? `&v=${v}` : sel ? `&v=${sel.version_no}` : ""}`;

  const { data: areas } = await supabase
    .from("organizational_areas")
    .select("id, name, process_code, head_user_id")
    .eq("active", true)
    .order("name");
  const statusOf = (s: string) => VERSION_BADGE[s as VersionStatus];
  const validity = (
    doc.status === "anulado"
      ? "obsoleto"
      : await callRpc(supabase, "document_validity", {
          p_review_date: doc.next_review_date ?? (null as unknown as string),
          p_status: doc.status,
        }).catch(() => "sin_dato")
  ) as Validity;

  // Banderas de acción (la base vuelve a validar cada una).
  const roles = ctx.roles;
  const isAuthor = sel?.author_id === ctx.userId;
  const signedUpdate = d.signatures.some(
    (s) => s.record_id === sel?.id && s.meaning === "actualizo" && s.user_id === ctx.userId,
  );
  const author = d.authors.find((p) => p.id === sel?.author_id);
  const authorHead = areas?.find((x) => x.id === author?.area_id)?.head_user_id ?? null;
  const reviewRoles = d.routeSteps.find((s) => s.step === "revision")?.roles ?? [];
  const approveRoles = d.routeSteps.find((s) => s.step === "aprobacion")?.roles ?? [];
  const canReviewRole = roles.some((r) => reviewRoles.includes(r)) || authorHead === ctx.userId;
  const canApproveRole = roles.some((r) => approveRoles.includes(r));
  const sodBlocked = Boolean(
    sel &&
    (isAuthor || signedUpdate) &&
    ["en_revision", "en_aprobacion"].includes(sel.status) &&
    (canReviewRole || canApproveRole),
  );
  const cr = d.changes.find((c) => c.id === sel?.change_request_id) ?? null;
  const parentPending = Boolean(
    sel?.technical_change &&
    (doc.parent_code || doc.parent_document_id) &&
    (!cr || cr.parent_review === "pendiente"),
  );
  const approved = Boolean(sel?.locked_at) && sel?.status === "en_aprobacion";
  const flags = {
    canSubmitReview: sel?.status === "codificado" && (isAuthor || a.isAqDoc),
    canReview: sel?.status === "en_revision" && canReviewRole && !sodBlocked,
    canApprove: sel?.status === "en_aprobacion" && !sel.locked_at && canApproveRole && !sodBlocked,
    canPublish: a.isAqDoc && approved && !parentPending,
    canNewVersion: doc.status === "vigente" && !open && a.canAuthor && doc.origin === "interno",
    canDownloadUncontrolled: a.isAqDoc && sel?.status === "vigente",
  };
  const editing = Boolean(sel && isAuthor && ["solicitado", "preliminar"].includes(sel.status));
  const lastCheck = d.checks.find((c) => c.version_id === sel?.id);
  const copy =
    !sel || sel.status === "obsoleto" || doc.status === "anulado"
      ? "obsoleto"
      : sel.status === "vigente"
        ? "controlada"
        : "no_controlada";
  const history = versions
    .filter((v) => v.issue_date || v.status === sel?.status)
    .map((v) => ({
      version_no: v.version_no,
      issue_date: v.issue_date,
      change_description: v.change_description,
    }));
  const typeName = d.type?.name ?? "Documento externo";

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={`${doc.origin === "externo" ? "Externo" : doc.code} · ${doc.title}`}
        description={`${typeName}${d.area ? ` · ${d.area.name} (${d.area.process_code})` : ""}${doc.parent_code ? ` · formato de ${doc.parent_code}` : ""}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Documentos", href: "/documentos" },
          { label: doc.code },
        ]}
        meta={
          <>
            {sel ? (
              <StatusBadge
                status={statusOf(sel.status).status}
                label={`v${versionLabel(sel.version_no)} · ${statusOf(sel.status).label}`}
              />
            ) : null}
            {doc.status === "anulado" ? <StatusBadge status="obsoleto" label="Anulado" /> : null}
            <StatusBadge
              status={VALIDITY_BADGE[validity].status}
              label={VALIDITY_BADGE[validity].label}
            />
            {approved ? <StatusBadge status="firmada" label="Aprobada · por publicar" /> : null}
          </>
        }
        actions={
          sel && doc.origin === "interno" ? (
            <VersionActions
              documentId={id}
              versionId={sel.id}
              versionNo={sel.version_no}
              code={doc.code}
              title={doc.title}
              signer={`${ctx.fullName}${ctx.shortSignature ? ` (${ctx.shortSignature})` : ""}`}
              flags={flags}
              areas={(areas ?? []).map((x) => ({
                id: x.id,
                name: x.name,
                processCode: x.process_code,
              }))}
              defaultDistribution={doc.default_distribution ?? []}
            />
          ) : null
        }
      />

      {open && sel?.id !== open.id ? (
        <p
          role="note"
          className="rounded-lg border border-tram-revision-bd bg-tram-revision-bg px-3.5 py-2.5 text-sm text-tram-revision-fg"
        >
          Existe la versión {versionLabel(open.version_no)} en estado {statusOf(open.status).label}
          {open.change_request_id
            ? ` (${d.changes.find((c) => c.id === open.change_request_id)?.code ?? ""})`
            : ""}
          . Los lotes en curso no cambian: siguen usando la v
          {current ? versionLabel(current.version_no) : "—"}.{" "}
          <Link href={qs("documento", open.version_no)}>
            Ver la versión {versionLabel(open.version_no)}
          </Link>
        </p>
      ) : null}
      {sel?.status === "obsoleto" ? (
        <p
          role="note"
          className="flex items-center gap-2 rounded-lg border border-neutral-strong bg-surface-sunken px-3.5 py-2.5 text-sm"
        >
          <Lock aria-hidden className="size-4" />
          Versión {versionLabel(sel.version_no)} obsoleta
          {sel.obsoleted_at ? ` desde el ${formatDateTime(sel.obsoleted_at)}` : ""}. No la use en
          planta; se conserva 5 años como evidencia de los lotes que la usaron.
        </p>
      ) : null}
      {sodBlocked ? (
        <SodNotice
          title="No puede revisar ni aprobar esta versión"
          reason="Usted elaboró esta versión y no puede revisarla ni aprobarla (SOD-8)."
          who="Pida la revisión al jefe inmediato del autor o a Aseguramiento de la calidad. Quien revisa sí puede aprobar."
        />
      ) : null}
      {sel?.status === "en_aprobacion" &&
      !sel.locked_at &&
      canApproveRole &&
      !sodBlocked &&
      d.signatures.some(
        (s) => s.record_id === sel.id && s.meaning === "reviso" && s.user_id === ctx.userId,
      ) ? (
        <p
          role="note"
          className="rounded-lg border border-tram-revision-bd bg-tram-revision-bg px-3.5 py-2.5 text-sm text-tram-revision-fg"
        >
          Usted revisó esta versión y no la elaboró: puede aprobarla. Quien elabora o modifica un
          documento no lo revisa ni lo aprueba.
        </p>
      ) : null}
      {approved && a.isAqDoc && parentPending ? (
        <SodNotice
          title={`No se puede publicar la versión ${versionLabel(sel?.version_no)}`}
          reason={`Este cambio técnico exige revisar el procedimiento ${doc.parent_code ?? "padre"} antes de publicar.`}
          who="Registre la revisión del procedimiento padre («sin cambio» con justificación o nueva versión)."
          action={
            <Link href={`/documentos/cambios?sc=${cr?.code ?? ""}`}>
              Abrir el control de cambios{cr ? ` (${cr.code})` : ""}
            </Link>
          }
        />
      ) : null}
      {sel?.status === "en_estandarizacion" ? (
        <p
          role="status"
          className="rounded-lg border border-tram-revision-bd bg-tram-revision-bg px-3.5 py-2.5 text-sm text-tram-revision-fg"
        >
          En estandarización: Aseguramiento de la calidad revisa la estructura y la redacción.
        </p>
      ) : null}

      <nav
        aria-label="Pestañas del documento"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map(([t, label]) => (
          <Link
            key={t}
            href={qs(t)}
            aria-current={t === tab ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm no-underline",
              t === tab
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-text-strong",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "documento" ? (
        doc.origin === "externo" ? (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 rounded-[10px] border border-border bg-surface p-5 text-sm">
            <dt className="text-text-secondary">Emisor</dt>
            <dd>{doc.external_issuer}</dd>
            <dt className="text-text-secondary">Versión del emisor</dt>
            <dd>{doc.external_version ?? "—"}</dd>
            <dt className="text-text-secondary">Nivel</dt>
            <dd>1 · Normatividad</dd>
            <dt className="text-text-secondary">Control</dt>
            <dd>
              Documento externo: sin firmas internas, con control de su distribución.
              {doc.external_pending_confirmation ? " Por confirmar." : ""}
            </dd>
          </dl>
        ) : !sel ? (
          <EmptyState title="El documento no tiene versiones" />
        ) : editing && d.type ? (
          <DraftEditor
            versionId={sel.id}
            typeId={d.type.id}
            content={sel.content as Record<string, string>}
            isModification={sel.version_no > 1}
            changeDescription={sel.change_description}
            technicalChange={sel.technical_change}
            isSubdocument={Boolean(doc.parent_code || doc.parent_document_id)}
            returnedObservations={
              lastCheck?.result === "no_cumple"
                ? (lastCheck.observations as Observation[])
                : undefined
            }
          />
        ) : (
          <DocumentView
            title={doc.title}
            code={doc.code}
            versionNo={sel.version_no}
            issueDate={sel.issue_date}
            reviewDate={sel.review_due_date}
            statusLabel={statusOf(sel.status).label}
            content={sel.content as Record<string, string>}
            history={history}
            signatures={d.signatureBox(sel.id)}
            copy={copy}
          />
        )
      ) : null}

      {tab === "versiones" ? (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Versiones del documento</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {[
                  "Versión",
                  "Estado",
                  "Autor",
                  "Emisión",
                  "Revisión",
                  "Descripción del cambio",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-b border-border px-3 py-2.5 text-label uppercase"
                  >
                    {h || <span className="sr-only">Ver</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr
                  key={v.id}
                  className={cn(
                    "border-b border-divider last:border-0",
                    v.id === sel?.id && "bg-tram-revision-bg/60",
                  )}
                >
                  <td className="px-3 py-2.5 font-mono font-semibold">
                    {versionLabel(v.version_no)}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge
                      status={statusOf(v.status).status}
                      label={statusOf(v.status).label}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    {d.authors.find((p) => p.id === v.author_id)?.full_name ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{docDate(v.issue_date)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{docDate(v.review_due_date)}</td>
                  <td className="px-3 py-2.5">{v.change_description || "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Link href={qs("documento", v.version_no)}>Ver</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "flujo" && sel ? (
        <Flow
          sel={sel}
          sigs={d.signatures.filter((s) => s.record_id === sel.id)}
          cr={cr}
          trainings={d.trainings.filter((t) => t.version_id === sel.id).length}
          parentPending={parentPending}
        />
      ) : null}

      {tab === "firmas" && sel ? (
        <section className="grid gap-3">
          <DocumentViewSignaturesOnly box={d.signatureBox(sel.id)} />
          <h2 className="text-card-title">Historial de actualizaciones</h2>
          <ul className="grid gap-1 text-sm">
            {history.map((h) => (
              <li key={h.version_no}>
                <span className="font-mono font-semibold">{versionLabel(h.version_no)}</span> ·{" "}
                {docDate(h.issue_date)} · {h.change_description}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "copias" ? (
        <CopiesPanel
          canManage={a.isAqDoc}
          vigenteVersionId={current?.status === "vigente" ? current.id : null}
          rows={d.distribution.map((r): CopyRow => ({
            id: r.id,
            versionNo: versions.find((v) => v.id === r.version_id)?.version_no ?? 0,
            target:
              (r.organizational_areas as unknown as { name: string } | null)?.name ??
              r.recipient ??
              "—",
            copyType: r.copy_type as CopyRow["copyType"],
            deliveredAt: r.delivered_at,
            recalledAt: r.recalled_at,
            recallNote: r.recall_note,
          }))}
        />
      ) : null}

      {tab === "bitacora" && sel ? (
        <Trail versionId={sel.id} code={`${doc.code} v${versionLabel(sel.version_no)}`} />
      ) : null}

      {tab === "lotes" ? (
        <EmptyState
          title="Ningún lote registrado en la plataforma usa este documento todavía"
          text="Cada lote congelará el código y la versión vigente de los documentos que use (RF-101). El registro de lote llega en la etapa de producción."
        />
      ) : null}

      {cr ? (
        <p className="text-small text-text-secondary">
          Solicitud de cambio {cr.code} · origen {ORIGIN_LABELS[cr.origin] ?? cr.origin}
          {cr.origin_ref ? ` ${cr.origin_ref}` : ""} · revisión del procedimiento padre:{" "}
          {cr.parent_review ? PARENT_REVIEW_LABELS[cr.parent_review] : "no aplica"}
        </p>
      ) : null}
    </main>
  );
}

function DocumentViewSignaturesOnly({ box }: { box: SignatureBoxRow[] }) {
  const labels = {
    actualizo: "Actualizado por",
    reviso: "Revisado por",
    aprobo: "Aprobado por",
  } as const;
  return (
    <div
      className="grid grid-cols-3 rounded-[10px] border border-border bg-surface text-sm"
      data-testid="signatures-tab"
    >
      {(["actualizo", "reviso", "aprobo"] as const).map((m, i) => {
        const s = box.find((x) => x?.meaning === m) ?? null;
        return (
          <div key={m} className={cn("grid gap-0.5 p-3.5", i < 2 && "border-r border-border")}>
            <span className="text-label text-text-secondary uppercase">{labels[m]}</span>
            {s ? (
              <>
                <b className="font-semibold">{s.name}</b>
                <span className="text-text-secondary">{s.jobTitle}</span>
                <span className="font-mono text-xs">
                  {s.shortSignature} · {formatDateTime(s.signedAt)}
                </span>
              </>
            ) : (
              <span className="text-text-muted">Pendiente</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Flow({
  sel,
  sigs,
  cr,
  trainings,
  parentPending,
}: {
  sel: {
    status: string;
    locked_at: string | null;
    document_id: string | null;
    request_id: string | null;
  };
  sigs: { meaning: string; signer_name: string; signed_at: string }[];
  cr: { code: string } | null;
  trainings: number;
  parentPending: boolean;
}) {
  const order = [
    "solicitado",
    "preliminar",
    "en_estandarizacion",
    "codificado",
    "en_revision",
    "en_aprobacion",
    "vigente",
  ];
  const idx = order.indexOf(sel.status === "obsoleto" ? "vigente" : sel.status);
  const who = (m: string) => sigs.find((s) => s.meaning === m);
  const steps: { label: string; sub: string; state: "done" | "cur" | "pen" }[] = [
    {
      label: "Solicitud",
      sub: cr?.code ?? "Solicitud documental",
      state: idx >= 0 ? "done" : "pen",
    },
    { label: "Preliminar", sub: "Autor", state: idx > 1 ? "done" : idx >= 0 ? "cur" : "pen" },
    {
      label: "Estandarización",
      sub: "Aseguramiento de la calidad",
      state: idx > 2 ? "done" : idx === 2 ? "cur" : "pen",
    },
    {
      label: "Código",
      sub: sel.document_id ? "Asignado" : "Pendiente",
      state: idx > 3 ? "done" : idx === 3 ? "cur" : "pen",
    },
    {
      label: "Revisión",
      sub: who("reviso")?.signer_name ?? "Pendiente",
      state: who("reviso") ? "done" : idx === 4 ? "cur" : "pen",
    },
    {
      label: "Aprobación",
      sub: who("aprobo")?.signer_name ?? "Pendiente",
      state: who("aprobo") ? "done" : idx === 5 ? "cur" : "pen",
    },
    {
      label: "Vigente",
      sub:
        idx >= 6
          ? "Publicada"
          : parentPending && sel.locked_at
            ? "Bloqueado por regla"
            : "Pendiente",
      state: idx >= 6 ? "done" : sel.locked_at ? "cur" : "pen",
    },
    {
      label: "Capacitación",
      sub: trainings ? "Divulgada" : "Pendiente",
      state: trainings ? "done" : "pen",
    },
  ];
  return (
    <ol
      className="grid grid-cols-8 gap-2 rounded-[10px] border border-border bg-surface p-5 max-[1279px]:grid-cols-4"
      aria-label="Flujo del documento"
    >
      {steps.map((s) => (
        <li key={s.label} className="grid justify-items-center gap-1.5 text-center">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-full border-2",
              s.state === "done" && "border-primary bg-primary text-white",
              s.state === "cur" &&
                "border-primary bg-white text-primary ring-4 ring-tram-en-curso-bg",
              s.state === "pen" && "border-border-control bg-surface-sunken text-text-secondary",
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
          <span className="sr-only">
            {s.state === "done" ? "completado" : s.state === "cur" ? "en curso" : "pendiente"}
          </span>
        </li>
      ))}
    </ol>
  );
}

async function Trail({ versionId, code }: { versionId: string; code: string }) {
  const a = await getDocAccess();
  const rows = (await callRpc(a.supabase, "get_audit_trail", {
    p_table: "document_versions",
    p_record_id: versionId,
  }).catch(() => [])) as Array<Record<string, unknown>>;
  const entries: AuditEntry[] = rows.map((r) => ({
    id: Number(r.id),
    at: String(r.at),
    actorName: (r.actor_name as string | null) ?? null,
    actorShortSignature: (r.actor_short_signature as string | null) ?? null,
    action: String(r.action),
    tableName: String(r.table_name),
    before: (r.before as Record<string, unknown> | null) ?? null,
    after: (r.after as Record<string, unknown> | null) ?? null,
    reason: (r.reason as string | null) ?? null,
  }));
  if (entries.length === 0)
    return (
      <EmptyState
        title="Sin entradas visibles en la bitácora"
        text="La bitácora la consultan los roles con lectura de trazabilidad y auditoría."
      />
    );
  return <AuditTrailPanel code={code} entries={entries} />;
}
