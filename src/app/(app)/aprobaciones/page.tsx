import type { Metadata } from "next";
import { Lock } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { formatDate, formatNumber } from "@/lib/format";
import { SECTIONS, VERSION_BADGE, type VersionStatus } from "@/lib/documents/labels";
import { getRdAccess } from "@/lib/rd/access";
import { callRpc } from "@/lib/rpc";

export const metadata: Metadata = { title: "Aprobaciones · GRUFARCOL eBR" };

const APPROVER_ROLES = ["dt", "aq_dir", "gerencia"];

type VRow = {
  id: string;
  status: string;
  version_no: number;
  author_id: string;
  document_id: string | null;
  supersedes_id: string | null;
  change_description: string;
  updated_at: string;
  content: Record<string, string> | null;
  controlled_documents: { code: string; title: string } | null;
};

// S-10 · Bandeja de aprobación (RF-14): versiones del SGD que le toca firmar al usuario según la ruta
// (my_pending_versions), prototipos por aprobar como fórmula y briefs enviados. Quien creó una versión no la aprueba (SOD).
export default async function ApprovalsPage({ searchParams }: PageProps<"/aprobaciones">) {
  const a = await getRdAccess();
  const pending = await callRpc(a.supabase, "my_pending_versions").catch(() => []);
  const isApprover = a.ctx.roles.some((r) => APPROVER_ROLES.includes(r)) || pending.length > 0;
  if (!isApprover && !a.briefApprove) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene bandeja de aprobación"
          text="Aprueban Dirección técnica, Aseguramiento de la calidad y Gerencia (PRD 2.2)."
        />
      </main>
    );
  }
  const sp = await searchParams;
  const [{ data: versions }, { data: protos }, { data: briefs }, { data: people }] =
    await Promise.all([
      a.supabase
        .from("document_versions")
        .select(
          "id, status, version_no, author_id, document_id, supersedes_id, change_description, updated_at, content, controlled_documents!document_versions_document_id_fkey(code, title)",
        )
        .in(
          "id",
          pending.map((p) => p.version_id),
        )
        .order("updated_at"),
      a.protoRead
        ? a.supabase
            .from("formula_prototypes")
            .select("id, code, concept, brief_id, prototype_approvals(approver_role)")
            .eq("status", "seleccionado")
            .order("code")
        : Promise.resolve({ data: [] as never[] }),
      a.briefApprove
        ? a.supabase
            .from("briefs")
            .select("id, code, project_name, updated_at, created_by")
            .eq("status", "enviado")
            .order("updated_at")
        : Promise.resolve({ data: [] as never[] }),
      a.supabase.from("profiles").select("id, full_name"),
    ]);
  const rows = (versions ?? []) as unknown as VRow[];
  const name = (id: string | null) => people?.find((p) => p.id === id)?.full_name ?? "—";
  const selected = rows.find((r) => r.id === sp.v) ?? null;
  const myProtos = (protos ?? []).filter((p) =>
    a.approverRoles.some((r) => !(p.prototype_approvals ?? []).some((x) => x.approver_role === r)),
  );

  // Comparación con la versión que reemplaza (fórmula: ingredientes; otros: secciones).
  let prevVersionNo: number | null = null;
  let compare:
    | null
    | {
        kind: "formula";
        rows: { code: string; name: string; before: number | null; after: number | null }[];
      }
    | { kind: "sections"; rows: { label: string; before: string; after: string }[] } = null;
  if (selected?.supersedes_id) {
    const [{ data: prev }, { data: forms }] = await Promise.all([
      a.supabase
        .from("document_versions")
        .select("version_no, content")
        .eq("id", selected.supersedes_id)
        .maybeSingle(),
      a.supabase
        .from("formulas")
        .select("document_version_id, formula_items(material_id, pct, materials(code, name))")
        .in("document_version_id", [selected.id, selected.supersedes_id]),
    ]);
    prevVersionNo = prev?.version_no ?? null;
    const fNew = forms?.find((f) => f.document_version_id === selected.id);
    const fOld = forms?.find((f) => f.document_version_id === selected.supersedes_id);
    if (fNew || fOld) {
      const ids = [
        ...new Set(
          [...(fOld?.formula_items ?? []), ...(fNew?.formula_items ?? [])].map(
            (i) => i.material_id,
          ),
        ),
      ];
      compare = {
        kind: "formula",
        rows: ids.map((id) => {
          const o = fOld?.formula_items.find((i) => i.material_id === id);
          const n = fNew?.formula_items.find((i) => i.material_id === id);
          const m = (n ?? o)?.materials as { code: string; name: string } | null;
          return {
            code: m?.code ?? "",
            name: m?.name ?? "",
            before: o ? Number(o.pct) : null,
            after: n ? Number(n.pct) : null,
          };
        }),
      };
    } else {
      const before = (prev?.content ?? {}) as Record<string, string>;
      const after = selected.content ?? {};
      compare = {
        kind: "sections",
        rows: SECTIONS.filter((s) => s.key in before || s.key in after).map((s) => ({
          label: s.label,
          before: before[s.key] ?? "",
          after: after[s.key] ?? "",
        })),
      };
    }
  }

  const th = "border-b border-border px-3 py-2.5 text-label uppercase";
  return (
    <main className="grid content-start gap-5 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Aprobaciones"
        description="Versiones en revisión o aprobación, prototipos por aprobar como fórmula y briefs enviados."
        breadcrumbs={[{ label: "Inicio", href: "/inicio" }, { label: "Aprobaciones" }]}
      />

      {isApprover ? (
        <section aria-labelledby="versiones" className="grid gap-2">
          <h2 id="versiones" className="text-card-title">
            Versiones por revisar o aprobar ({rows.length})
          </h2>
          {rows.length === 0 ? (
            <EmptyState title="No hay versiones pendientes" />
          ) : (
            <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
              <table className="w-full text-left text-sm" data-testid="pending-versions">
                <caption className="sr-only">Versiones pendientes</caption>
                <thead className="bg-surface-sunken">
                  <tr>
                    {[
                      "Documento",
                      "Versión",
                      "Creada por",
                      "Fecha",
                      "Cambios",
                      "Estado",
                      "Acción",
                    ].map((h) => (
                      <th key={h} scope="col" className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = VERSION_BADGE[r.status as VersionStatus];
                    const mine = r.author_id === a.ctx.userId;
                    return (
                      <tr
                        key={r.id}
                        data-code={r.controlled_documents?.code}
                        className={`border-b border-divider last:border-0 ${selected?.id === r.id ? "bg-tram-en-curso-bg" : ""}`}
                      >
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-[13px] font-semibold">
                            {r.controlled_documents?.code}
                          </span>{" "}
                          {r.controlled_documents?.title}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">
                          v{String(r.version_no).padStart(2, "0")}
                        </td>
                        <td className="px-3 py-2.5">{name(r.author_id)}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">
                          {formatDate(r.updated_at)}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.change_description || "Creación"}
                          {r.supersedes_id ? (
                            <Link href={`/aprobaciones?v=${r.id}`} className="ml-2 text-small">
                              Comparar
                            </Link>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">
                          {st ? <StatusBadge status={st.status} label={st.label} /> : r.status}
                        </td>
                        <td className="px-3 py-2.5">
                          {mine ? (
                            <span className="flex items-center gap-1 text-small text-text-secondary">
                              <Lock aria-hidden className="size-3.5" />
                              Usted creó esta versión: no puede aprobarla
                            </span>
                          ) : r.document_id ? (
                            <Link href={`/documentos/${r.document_id}?v=${r.version_no}`}>
                              {r.status === "en_revision" ? "Revisar y firmar" : "Aprobar"}
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {compare && selected ? (
        <section
          aria-labelledby="comparacion"
          className="grid gap-2 rounded-[10px] border border-border bg-surface p-5"
          data-testid="compare"
        >
          <h2 id="comparacion" className="text-card-title">
            Comparación: v{String(prevVersionNo ?? selected.version_no - 1).padStart(2, "0")} frente
            a v{String(selected.version_no).padStart(2, "0")}
          </h2>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Diferencias entre versiones</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {(compare.kind === "formula"
                  ? ["Materia prima", "Antes (%)", "Ahora (%)"]
                  : ["Sección", "Antes", "Ahora"]
                ).map((h) => (
                  <th key={h} scope="col" className="px-2 py-2 text-label uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compare.kind === "formula"
                ? compare.rows.map((r) => {
                    const changed = r.before !== r.after;
                    return (
                      <tr
                        key={r.code}
                        className={`border-t border-divider ${changed ? "bg-tram-revision-bg" : ""}`}
                        data-changed={changed || undefined}
                      >
                        <td className="px-2 py-1.5">
                          <span className="font-mono text-xs">{r.code}</span> {r.name}
                          {changed ? (
                            <span className="ml-2 text-xs font-semibold">Cambió</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 font-mono">
                          {r.before == null ? "—" : formatNumber(r.before, 2)}
                        </td>
                        <td className="px-2 py-1.5 font-mono">
                          {r.after == null ? "—" : formatNumber(r.after, 2)}
                        </td>
                      </tr>
                    );
                  })
                : compare.rows.map((r) => {
                    const changed = r.before !== r.after;
                    return (
                      <tr
                        key={r.label}
                        className={`border-t border-divider align-top ${changed ? "bg-tram-revision-bg" : ""}`}
                        data-changed={changed || undefined}
                      >
                        <td className="px-2 py-1.5 font-semibold">
                          {r.label}
                          {changed ? <span className="block text-xs">Cambió</span> : null}
                        </td>
                        <td className="px-2 py-1.5 whitespace-pre-line">{r.before || "—"}</td>
                        <td className="px-2 py-1.5 whitespace-pre-line">{r.after || "—"}</td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </section>
      ) : null}

      {a.approverRoles.length ? (
        <section aria-labelledby="prototipos" className="grid gap-2">
          <h2 id="prototipos" className="text-card-title">
            Prototipos por aprobar como fórmula ({myProtos.length})
          </h2>
          {myProtos.length === 0 ? (
            <EmptyState title="No hay prototipos pendientes de su firma" />
          ) : (
            <ul className="grid gap-2">
              {myProtos.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-4 py-3"
                >
                  <span>
                    <Link href={`/idi/prototipos/${p.id}`} className="font-mono font-semibold">
                      {p.code}
                    </Link>{" "}
                    · {p.concept}
                  </span>
                  <StatusBadge status="pendiente" label="Pendiente de su firma" />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {a.briefApprove ? (
        <section aria-labelledby="briefs" className="grid gap-2">
          <h2 id="briefs" className="text-card-title">
            Briefs enviados ({(briefs ?? []).length})
          </h2>
          {(briefs ?? []).length === 0 ? (
            <EmptyState title="No hay briefs por decidir" />
          ) : (
            <ul className="grid gap-2">
              {(briefs ?? []).map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-4 py-3"
                >
                  <span>
                    <Link href={`/idi/briefs/${b.id}`} className="font-mono font-semibold">
                      {b.code}
                    </Link>{" "}
                    · {b.project_name} · {name(b.created_by)}
                  </span>
                  <span className="font-mono text-xs">{formatDate(b.updated_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
