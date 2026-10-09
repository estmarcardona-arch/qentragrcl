import type { Metadata } from "next";
import { Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "cn";
import { PageHeader } from "@/components/common/page-header";
import { TemplateEditor, type EditorStep } from "@/components/documents/template-editor";
import { SodNotice } from "@/components/gxp/sod-notice";
import { StatusBadge } from "@/components/gxp/status-badge";
import { getDocAccess } from "@/lib/documents/access";
import { VERSION_BADGE, versionLabel, type VersionStatus } from "@/lib/documents/labels";

export const metadata: Metadata = { title: "Plantilla de proceso · GRUFARCOL eBR" };

type StepRow = {
  order_no: number;
  label: string;
  text: string;
  params: {
    name: string;
    unit: string;
    min: number | null;
    max: number | null;
    frequency: string;
  }[];
  requires_equipment: string | null;
  requires_verification: boolean;
  checklist_item: boolean;
};

// S-43 · Editor de la plantilla de una etapa (versión en borrador) y comparación con la vigente (RF-05, AC-20).
export default async function TemplatePage({
  params,
  searchParams,
}: PageProps<"/master/plantillas/[stage]">) {
  const { stage: code } = await params;
  const sp = await searchParams;
  const a = await getDocAccess();
  const { supabase, ctx } = a;
  const { data: stage } = await supabase
    .from("stage_definitions")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (!stage?.governing_document_id) notFound();
  const [{ data: doc }, { data: versions }] = await Promise.all([
    supabase
      .from("controlled_documents")
      .select("id, code, title, current_version_id")
      .eq("id", stage.governing_document_id)
      .maybeSingle(),
    supabase
      .from("document_versions")
      .select("id, version_no, status, author_id, change_description, locked_at")
      .eq("document_id", stage.governing_document_id)
      .order("version_no", { ascending: false }),
  ]);
  if (!doc) notFound();
  const vigente = versions?.find((v) => v.id === doc.current_version_id) ?? null;
  const open = versions?.find((v) => !["vigente", "obsoleto"].includes(v.status)) ?? null;
  const ids = [vigente?.id, open?.id].filter(Boolean) as string[];
  const { data: templates } = await supabase
    .from("process_templates")
    .select(
      "id, document_version_id, process_template_steps(order_no, label, text, params, requires_equipment, requires_verification, checklist_item)",
    )
    .in("document_version_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const stepsOf = (vid?: string) =>
    (
      (templates?.find((t) => t.document_version_id === vid)?.process_template_steps ??
        []) as unknown as StepRow[]
    ).sort((x, y) => x.order_no - y.order_no);
  const vSteps = stepsOf(vigente?.id);
  const oSteps = stepsOf(open?.id);
  const { data: author } = open
    ? await supabase.from("profiles").select("full_name").eq("id", open.author_id).maybeSingle()
    : { data: null };
  const mine = open?.author_id === ctx.userId;
  const editable =
    a.canEditTemplates && (!open || (mine && ["solicitado", "preliminar"].includes(open.status)));
  const tab = sp.vista === "comparar" ? "comparar" : "editar";
  const checklist = stage.code === "despeje";
  const base = open ? oSteps : vSteps;
  const toEditor = (s: StepRow, isNew: boolean): EditorStep => ({
    label: s.label,
    text: s.text,
    params: s.params ?? [],
    requires_equipment: s.requires_equipment ?? "",
    requires_verification: s.requires_verification,
    checklist_item: s.checklist_item,
    isNew,
  });
  const vTexts = new Set(vSteps.map((s) => s.text));
  const nextNo = open?.version_no ?? (versions?.[0]?.version_no ?? 0) + 1;

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={`${stage.name} · ${doc.code}`}
        description={
          open
            ? `Versión ${versionLabel(open.version_no)} · ${VERSION_BADGE[open.status as VersionStatus].label.toLowerCase()} de ${author?.full_name ?? ""} · ${oSteps.length} pasos`
            : `Versión vigente ${versionLabel(vigente?.version_no)} · ${vSteps.length} pasos`
        }
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Plantillas de proceso", href: "/master/plantillas" },
          { label: stage.name },
        ]}
        meta={
          <>
            {vigente ? (
              <StatusBadge
                status="publicado"
                label={`v${versionLabel(vigente.version_no)} vigente`}
              />
            ) : null}
            {open ? (
              <StatusBadge
                status={VERSION_BADGE[open.status as VersionStatus].status}
                label={`v${versionLabel(open.version_no)} ${VERSION_BADGE[open.status as VersionStatus].label.toLowerCase()}`}
              />
            ) : null}
            <Link href={`/documentos/${doc.id}`} className="text-small">
              Ver el documento controlado
            </Link>
          </>
        }
      />
      <nav aria-label="Vista" className="flex gap-1 border-b border-border">
        {[
          ["editar", editable ? "Editar borrador" : "Pasos"],
          ["comparar", "Comparar versiones"],
        ].map(([k, l]) => (
          <Link
            key={k}
            href={`/master/plantillas/${code}?vista=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm no-underline",
              tab === k
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-text-strong",
            )}
          >
            {l}
          </Link>
        ))}
      </nav>

      {tab === "editar" ? (
        editable ? (
          <TemplateEditor
            stageCode={stage.code}
            stageName={stage.name}
            versionId={open && mine ? open.id : null}
            nextVersionNo={nextNo}
            initialSteps={base.map((s) => toEditor(s, Boolean(open) && !vTexts.has(s.text)))}
            initialReason={open && mine ? open.change_description : ""}
            checklist={checklist}
          />
        ) : (
          <div className="grid gap-3">
            {a.canEditTemplates && open && !mine ? (
              <SodNotice
                title="Hay una versión en curso de otro autor"
                reason={`La versión ${versionLabel(open.version_no)} de ${author?.full_name ?? ""} está ${VERSION_BADGE[open.status as VersionStatus].label.toLowerCase()}. Solo se edita un borrador a la vez.`}
              />
            ) : null}
            {a.canEditTemplates &&
            open &&
            mine &&
            !["solicitado", "preliminar"].includes(open.status) ? (
              <p
                role="note"
                className="flex items-center gap-2 rounded-lg border border-neutral-strong bg-surface-sunken px-3.5 py-2.5 text-sm"
              >
                <Lock aria-hidden className="size-4" />
                Esta versión ya no es un borrador (
                {VERSION_BADGE[open.status as VersionStatus].label.toLowerCase()}): no se edita. Si
                necesita otro cambio, cree una versión nueva cuando quede vigente.
              </p>
            ) : null}
            <StepsTable steps={base} highlight={open ? (s) => !vTexts.has(s.text) : undefined} />
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 gap-4 max-[1279px]:grid-cols-1" data-testid="compare">
          <section className="grid content-start gap-2">
            <h2 className="flex items-center gap-2 text-card-title">
              Versión {versionLabel(vigente?.version_no)} · vigente{" "}
              <StatusBadge status="publicado" label="Vigente" />
            </h2>
            <StepsTable steps={vSteps} />
            <p className="text-small text-text-secondary">
              Congelada en los lotes creados mientras estuvo vigente.
            </p>
          </section>
          <section className="grid content-start gap-2">
            <h2 className="flex items-center gap-2 text-card-title">
              {open
                ? `Versión ${versionLabel(open.version_no)} · borrador`
                : "Sin borrador abierto"}
              {open ? (
                <StatusBadge
                  status="preliminar"
                  label={VERSION_BADGE[open.status as VersionStatus].label}
                />
              ) : null}
            </h2>
            {open ? (
              <>
                <p className="text-small">
                  {oSteps.filter((s) => !vTexts.has(s.text)).length} paso(s) agregado(s) o
                  modificado(s) ·{" "}
                  {vSteps.filter((s) => !oSteps.some((o) => o.text === s.text)).length} eliminado(s)
                  o modificado(s). Motivo: {open.change_description || "—"}. Solo aplica a lotes
                  creados después de quedar vigente.
                </p>
                <StepsTable steps={oSteps} highlight={(s) => !vTexts.has(s.text)} />
              </>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}

function StepsTable({
  steps,
  highlight,
}: {
  steps: StepRow[];
  highlight?: (s: StepRow) => boolean;
}) {
  return (
    <ol className="grid gap-1.5">
      {steps.map((s) => {
        const hl = highlight?.(s) ?? false;
        return (
          <li
            key={`${s.order_no}-${s.label}`}
            className={cn(
              "grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border px-3 py-2 text-sm",
              hl ? "bg-tram-revision-bg shadow-[inset_4px_0_0_var(--color-primary)]" : "bg-white",
            )}
          >
            <span className="font-mono text-[13px] font-semibold">{s.label}</span>
            <span>
              <span className="block font-medium">{s.text}</span>
              <span className="text-xs text-text-secondary">
                {[
                  (s.params ?? [])
                    .map(
                      (p) =>
                        `${p.name}: ${p.min ?? ""}${p.max != null && p.max !== p.min ? `–${p.max}` : ""} ${p.unit} · ${p.frequency}`,
                    )
                    .join("; "),
                  s.requires_equipment ? `Equipo: ${s.requires_equipment}` : "",
                  s.requires_verification ? "Verificación de segunda persona" : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            {hl ? <StatusBadge status="en_curso" label="Agregado" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
