import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, NoPermissionState } from "@/components/common/state-card";
import {
  StandardizationPanel,
  type CodeFormData,
} from "@/components/documents/standardization-panel";
import { StatusBadge } from "@/components/gxp/status-badge";
import type { Observation } from "@/lib/documents/actions";
import { getDocAccess } from "@/lib/documents/access";
import { VERSION_BADGE, type VersionStatus } from "@/lib/documents/labels";
import { formatDate } from "@/lib/format";
import { callRpc } from "@/lib/rpc";

export const metadata: Metadata = { title: "Estandarización · GRUFARCOL eBR" };

// S-49 · Bandeja de estandarización de la analista de gestión documental (RF-94) y S-45b · asignación
// del código (RF-93). Solo aq_doc; la base lo vuelve a validar (FORBIDDEN_ROLE).
export default async function StandardizationPage({
  searchParams,
}: PageProps<"/documentos/estandarizacion">) {
  const a = await getDocAccess();
  if (!a.isAqDoc) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="Solo Aseguramiento de la calidad asigna códigos"
          text="La estandarización y la codificación las hace la analista de gestión documental. Su solicitud queda en su bandeja."
        />
      </main>
    );
  }
  const sp = await searchParams;
  const { supabase } = a;
  const { data: inbox } = await supabase
    .from("document_versions")
    .select(
      "id, status, version_no, author_id, document_id, request_id, content, updated_at, controlled_documents!document_versions_document_id_fkey(code, title, type_id, parent_code, process_id), document_requests(code, proposed_title, type_id, process_id, parent_document_id)",
    )
    .in("status", ["preliminar", "en_estandarizacion"])
    .order("updated_at", { ascending: false });
  const rows = inbox ?? [];
  const authorIds = [...new Set(rows.map((r) => r.author_id))];
  const { data: people } = await supabase
    .from("profiles")
    .select("id, full_name, job_title")
    .in("id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]);
  const sel =
    rows.find((r) => r.id === sp.v) ?? rows.find((r) => r.status === "en_estandarizacion") ?? null;
  const docOf = (r: (typeof rows)[number]) =>
    r.controlled_documents as unknown as {
      code: string;
      title: string;
      type_id: string;
      parent_code: string | null;
      process_id: string;
    } | null;
  const reqOf = (r: (typeof rows)[number]) =>
    r.document_requests as unknown as {
      code: string;
      proposed_title: string | null;
      type_id: string;
      process_id: string;
      parent_document_id: string | null;
    } | null;

  let panel = null;
  if (sel && sel.status === "en_estandarizacion") {
    const doc = docOf(sel);
    const req = reqOf(sel);
    const typeId = doc?.type_id ?? req?.type_id ?? "";
    const processId = doc?.process_id ?? req?.process_id ?? "";
    const [
      { data: type },
      { data: area },
      { data: routes },
      { data: checks },
      { data: parent },
      obs,
    ] = await Promise.all([
      supabase
        .from("document_types")
        .select("id, type_code, name, validity_rule")
        .eq("id", typeId)
        .maybeSingle(),
      supabase
        .from("organizational_areas")
        .select("name, process_code")
        .eq("id", processId)
        .maybeSingle(),
      supabase
        .from("approval_routes")
        .select("id, code, name, description")
        .eq("active", true)
        .order("code", { ascending: false }),
      supabase
        .from("standardization_checks")
        .select("result")
        .eq("version_id", sel.id)
        .order("checked_at", { ascending: false })
        .limit(1),
      supabase
        .from("controlled_documents")
        .select("code")
        .eq("id", req?.parent_document_id ?? "00000000-0000-0000-0000-000000000000")
        .maybeSingle(),
      callRpc(supabase, "style_observations", { p_content: sel.content, p_type_id: typeId }).catch(
        () => [],
      ),
    ]);
    let preview = doc?.code ?? "";
    if (!doc && type && area) {
      const prefix = parent?.code
        ? `${parent.code}-${type.type_code}-`
        : `${area.process_code}-${type.type_code}-`;
      const { data: same } = await supabase
        .from("controlled_documents")
        .select("code")
        .like("code", `${prefix}%`);
      const nums = (same ?? [])
        .map((x) => Number(x.code.slice(prefix.length, prefix.length + (parent ? 2 : 3))))
        .filter((x) => !Number.isNaN(x));
      preview = `${prefix}${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(parent ? 2 : 3, "0")}`;
    }
    const author = people?.find((p) => p.id === sel.author_id);
    const code: CodeFormData = {
      isCreation: !doc,
      codePreview: preview,
      versionNo: sel.version_no,
      proposedTitle: req?.proposed_title ?? doc?.title ?? "",
      typeName: type?.name ?? "",
      processLabel: area ? `${area.name} (${area.process_code})` : "—",
      parentCode: parent?.code ?? doc?.parent_code ?? null,
      authorLabel: `${author?.full_name ?? ""}${author?.job_title ? ` · ${author.job_title}` : ""}`,
      validityRule: type?.validity_rule ?? "periodo",
      routes: (routes ?? []).map((r) => ({ ...r })),
      defaultRouteCode: ["ADM", "TH"].includes(area?.process_code ?? "")
        ? "administrativa"
        : "tecnica",
    };
    panel = (
      <StandardizationPanel
        key={sel.id}
        versionId={sel.id}
        content={sel.content as Record<string, string>}
        observations={obs as Observation[]}
        checked={checks?.[0]?.result === "cumple"}
        code={code}
      />
    );
  }

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Estandarización"
        description={`Bandeja de preliminares de ${a.ctx.fullName}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Documentos", href: "/documentos" },
          { label: "Estandarización" },
        ]}
      />
      <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-4 max-[1279px]:grid-cols-1">
        <nav aria-label="Preliminares recibidos" className="grid content-start gap-2">
          {rows.length === 0 ? (
            <EmptyState
              title="No hay preliminares por estandarizar"
              text="Cuando un autor envíe un preliminar aparecerá aquí."
            />
          ) : (
            rows.map((r) => {
              const doc = docOf(r);
              const req = reqOf(r);
              const b = VERSION_BADGE[r.status as VersionStatus];
              return (
                <Link
                  key={r.id}
                  href={`/documentos/estandarizacion?v=${r.id}`}
                  aria-current={r.id === sel?.id ? "page" : undefined}
                  className={cn(
                    "grid gap-1 rounded-[10px] border bg-surface p-3 text-sm no-underline",
                    r.id === sel?.id
                      ? "border-primary bg-tram-revision-bg shadow-[inset_3px_0_0_var(--color-primary)]"
                      : "border-border",
                  )}
                >
                  <span className="font-mono text-xs font-semibold text-text-secondary">
                    {doc ? `${doc.code} v${String(r.version_no).padStart(2, "0")}` : req?.code}
                  </span>
                  <b className="font-medium text-foreground">{doc?.title ?? req?.proposed_title}</b>
                  <span className="text-xs text-text-secondary">
                    {people?.find((p) => p.id === r.author_id)?.full_name} ·{" "}
                    {formatDate(r.updated_at)}
                  </span>
                  <StatusBadge status={b.status} label={b.label} />
                </Link>
              );
            })
          )}
        </nav>
        <div>
          {panel ?? (
            <EmptyState
              title={sel ? "El preliminar está en redacción" : "Seleccione un preliminar"}
              text={
                sel
                  ? "El autor aún no lo envía a estandarización."
                  : "Elija un preliminar enviado para revisar su estructura y redacción."
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}
