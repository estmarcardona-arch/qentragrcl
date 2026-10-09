import type { Metadata } from "next";
import { Lock, PenLine } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { getDocAccess } from "@/lib/documents/access";
import {
  VALIDITY_BADGE,
  VERSION_BADGE,
  docDate,
  versionLabel,
  type Validity,
  type VersionStatus,
} from "@/lib/documents/labels";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Plantillas de proceso · GRUFARCOL eBR" };

// S-43 · Catálogo de etapas con el sello de documento controlado de cada plantilla (RF-05).
export default async function TemplatesPage() {
  const a = await getDocAccess();
  const { supabase } = a;
  const [{ data: stages }, { data: master }] = await Promise.all([
    supabase.from("stage_definitions").select("*").eq("active", true).order("order_no"),
    supabase
      .from("v_master_list")
      .select(
        "id, code, version_label, version_status, review_date, validity, open_version_no, open_version_status",
      ),
  ]);
  const { data: openVersions } = await supabase
    .from("document_versions")
    .select("document_id, version_no, author_id, updated_at, status")
    .not("status", "in", "(vigente,obsoleto)");
  const { data: people } = await supabase.from("profiles").select("id, full_name");

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Plantillas de proceso"
        description="Una plantilla por etapa. Todo cambio crea una versión nueva en borrador que sigue la revisión y aprobación del SGD."
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Documentos", href: "/documentos" },
          { label: "Plantillas de proceso" },
        ]}
      />
      {(stages ?? []).length === 0 ? (
        <EmptyState title="No hay etapas en el catálogo" />
      ) : (
        <ul className="grid grid-cols-3 gap-3 max-[1279px]:grid-cols-2" data-testid="stages">
          {(stages ?? []).map((s) => {
            const m = master?.find((x) => x.id === s.governing_document_id);
            const draft = openVersions?.find((v) => v.document_id === s.governing_document_id);
            const validity = (m?.validity ?? "sin_dato") as Validity;
            return (
              <li
                key={s.id}
                className="grid content-start gap-2 rounded-[10px] border border-border bg-surface p-4"
                data-stage={s.code}
              >
                <div className="flex items-start justify-between gap-2">
                  <b className="text-base font-semibold">{s.name}</b>
                  {m ? (
                    <StatusBadge
                      status={VALIDITY_BADGE[validity].status}
                      label={VALIDITY_BADGE[validity].label}
                    />
                  ) : null}
                </div>
                {m ? (
                  <p className="flex items-center gap-1.5 rounded-md border border-border bg-surface-sunken px-2.5 py-1.5 font-mono text-xs">
                    <Lock aria-hidden className="size-3.5" />
                    {m.code} · v{m.version_label} · revisión {docDate(m.review_date)}
                  </p>
                ) : (
                  <p className="text-small text-text-secondary">
                    Sin documento controlado asignado (pendiente, D-42).
                  </p>
                )}
                {m?.version_status ? (
                  <span className="text-small">
                    Versión vigente: <b className="font-mono">{m.version_label}</b> ·{" "}
                    {VERSION_BADGE[m.version_status as VersionStatus]?.label}
                  </span>
                ) : null}
                {draft ? (
                  <span className="flex items-center gap-1.5 text-small text-tram-en-curso-fg">
                    <PenLine aria-hidden className="size-3.5" />
                    Borrador abierto: v{versionLabel(draft.version_no)} de{" "}
                    {people?.find((p) => p.id === draft.author_id)?.full_name} ·{" "}
                    {formatDate(draft.updated_at)}
                  </span>
                ) : (
                  <span className="text-small text-text-secondary">Sin borrador abierto</span>
                )}
                {m ? (
                  <Link href={`/master/plantillas/${s.code}`} className="text-sm font-medium">
                    {a.canEditTemplates ? "Abrir plantilla" : "Ver plantilla"}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
