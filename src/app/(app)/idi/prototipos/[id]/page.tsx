import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/gxp/status-badge";
import {
  ApprovalBlock,
  CriteriaPanel,
  PrototypeActions,
  type CriteriaView,
} from "@/components/rd/prototype-actions";
import { PrototypeEditor } from "@/components/rd/prototype-editor";
import { StabilityPanel, type ReadingView, type TestView } from "@/components/rd/stability-panel";
import { getRdAccess } from "@/lib/rd/access";
import { PROTOTYPE_STATUS } from "@/lib/rd/labels";
import { callRpc } from "@/lib/rpc";

export const metadata: Metadata = { title: "Prototipo · GRUFARCOL eBR" };

// S-36 · Prototipo: datos e ingredientes, estabilidad preliminar (RF-16), criterios (D-13) y aprobación como fórmula.
export default async function PrototypePage({ params }: PageProps<"/idi/prototipos/[id]">) {
  const { id } = await params;
  const a = await getRdAccess();
  const { data: p } = await a.supabase
    .from("formula_prototypes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  const [
    { data: brief },
    { data: items },
    { data: materials },
    { data: studies },
    { data: approvals },
    { count: roots },
  ] = await Promise.all([
    a.supabase
      .from("briefs")
      .select("id, code, project_name, project_type, product_id, products(code, name)")
      .eq("id", p.brief_id)
      .maybeSingle(),
    a.supabase
      .from("prototype_items")
      .select("material_id, pct, phase, function")
      .eq("prototype_id", id)
      .order("order_no"),
    a.supabase
      .from("materials")
      .select("id, code, name, default_function")
      .eq("type", "mp")
      .order("code"),
    a.supabase
      .from("stability_studies")
      .select("*")
      .eq("prototype_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
    a.supabase
      .from("prototype_approvals")
      .select("approver_role, approver_name, decided_at, client_reference")
      .eq("prototype_id", id)
      .order("decided_at"),
    a.supabase
      .from("formula_prototypes")
      .select("id", { count: "exact", head: true })
      .eq("brief_id", p.brief_id)
      .is("parent_prototype_id", null),
  ]);
  const study = studies?.[0] ?? null;
  const productId = brief?.product_id ?? null;
  const product = brief?.products as { code: string; name: string } | null;

  const [tests, readings, missing, protocol, closer, criteria] = study
    ? await Promise.all([
        a.supabase
          .from("stability_tests")
          .select("*")
          .eq("study_id", study.id)
          .order("created_at")
          .then((r) => r.data ?? []),
        a.supabase
          .from("stability_readings")
          .select("*, stability_tests!inner(study_id)")
          .eq("stability_tests.study_id", study.id)
          .order("due_at")
          .then((r) => r.data ?? []),
        callRpc(a.supabase, "stability_missing", { p_study: study.id }).catch(() => []),
        a.supabase
          .from("document_versions")
          .select("version_no, controlled_documents!document_versions_document_id_fkey(code)")
          .eq("id", study.protocol_document_version_id)
          .maybeSingle()
          .then((r) => r.data),
        study.closed_by
          ? a.supabase
              .from("profiles")
              .select("full_name")
              .eq("id", study.closed_by)
              .maybeSingle()
              .then((r) => r.data)
          : Promise.resolve(null),
        productId
          ? a.supabase
              .from("stability_criteria")
              .select("*")
              .eq("product_id", productId)
              .maybeSingle()
              .then((r) => r.data)
          : Promise.resolve(null),
      ])
    : [
        [],
        [],
        [],
        null,
        null,
        productId
          ? (
              await a.supabase
                .from("stability_criteria")
                .select("*")
                .eq("product_id", productId)
                .maybeSingle()
            ).data
          : null,
      ];

  const st = PROTOTYPE_STATUS[p.status];
  const editable = a.isIdi && p.status === "borrador";
  const required =
    brief?.project_type === "maquila_tercero" ? ["gerencia", "dt", "cliente"] : ["gerencia", "dt"];
  const conforming = study && study.status === "cerrado" && study.result === "cumple";
  const blockedReason =
    p.status === "aprobado"
      ? null
      : (roots ?? 0) < 2
        ? "Se requieren al menos 2 prototipos para elegir."
        : !study
          ? "Requiere un estudio de estabilidad preliminar completo y conforme."
          : !conforming
            ? "El estudio de estabilidad debe estar cerrado como «Cumple»."
            : null;
  const doc = protocol?.controlled_documents as { code: string } | null;
  const showApprovals =
    ["seleccionado", "aprobado"].includes(p.status) || a.approverRoles.length > 0;
  const now = new Date().toISOString();

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={`Prototipo ${p.code}`}
        description={
          brief
            ? `Brief ${brief.code} · ${brief.project_name}${product ? ` · ${product.code} ${product.name}` : ""}`
            : undefined
        }
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Prototipos", href: `/idi/prototipos?brief=${p.brief_id}` },
          { label: p.code },
        ]}
        meta={
          <>
            <StatusBadge status={st.status} label={st.label} />
            {p.status_reason ? (
              <span className="text-small text-text-secondary">{p.status_reason}</span>
            ) : null}
          </>
        }
      />
      <PrototypeActions
        id={p.id}
        code={p.code}
        status={p.status}
        canAuthor={a.isIdi}
        canCreateFormula={a.isIdi && a.masterCreate}
        productId={productId}
      />
      <PrototypeEditor
        id={p.id}
        briefId={p.brief_id}
        editable={editable}
        initial={{
          product_type: p.product_type,
          target_description: p.target_description,
          benefit: p.benefit,
          concept: p.concept,
          draft_instruction: p.draft_instruction,
        }}
        initialItems={(items ?? []).map((i) => ({
          material_id: i.material_id,
          pct: Number(i.pct),
          phase: i.phase ?? "",
          function: i.function ?? "",
        }))}
        materials={(materials ?? []).map((m) => ({
          id: m.id,
          code: m.code,
          name: m.name,
          function: m.default_function,
        }))}
      />
      {study ? (
        <StabilityPanel
          study={{
            id: study.id,
            status: study.status,
            result: study.result,
            start_date: study.start_date,
            end_date: study.end_date,
            protocol: doc
              ? `${doc.code} v${String(protocol?.version_no).padStart(2, "0")}`
              : "Protocolo",
            conclusions: study.conclusions,
            early_close_reason: study.early_close_reason,
            closed_by_name: closer?.full_name ?? null,
            closed_at: study.closed_at,
          }}
          tests={tests.map((t): TestView => ({
            id: t.id,
            test_type: t.test_type,
            required: t.required,
            condition_min: t.condition_min,
            condition_max: t.condition_max,
            unit: t.unit,
            replicates: t.replicates,
            report_file: t.report_file,
            external_lab_name: t.external_lab_name,
            sample_volume_ml: t.sample_volume_ml,
          }))}
          readings={readings.map((r): ReadingView => ({
            test_id: r.test_id,
            time_point: r.time_point,
            replicate: r.replicate,
            due_at: r.due_at,
            recorded_at: r.recorded_at,
            temperature: r.temperature,
            ph: r.ph,
            organoleptic: r.organoleptic as ReadingView["organoleptic"],
            value: r.value,
            analytes: r.analytes as ReadingView["analytes"],
            in_range: r.in_range,
            within_window: r.within_window,
            recorded_by: r.recorded_by,
          }))}
          missing={(missing ?? []) as { test: string; time_point: string; missing: number }[]}
          now={now}
          canRecord={a.canRecord}
          canClose={a.canClose}
          criteriaDefined={Boolean(
            criteria &&
            criteria.ph_max_variation != null &&
            criteria.viscosity_max_variation_pct != null &&
            criteria.micro_limits != null &&
            criteria.organoleptic_changes_allowed != null &&
            criteria.reading_window_hours != null,
          )}
          signer={a.ctx.fullName}
          path={`/idi/prototipos/${p.id}`}
        />
      ) : null}
      {productId && product ? (
        <CriteriaPanel
          productId={productId}
          productLabel={`${product.code} ${product.name}`}
          criteria={criteria as CriteriaView}
          editable={a.canCriteria}
          path={`/idi/prototipos/${p.id}`}
        />
      ) : null}
      {showApprovals ? (
        <ApprovalBlock
          id={p.id}
          code={p.code}
          required={required}
          approvals={approvals ?? []}
          blockedReason={blockedReason}
          myRoles={a.ctx.roles}
          signer={a.ctx.fullName}
        />
      ) : null}
    </main>
  );
}
