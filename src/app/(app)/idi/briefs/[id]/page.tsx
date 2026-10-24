import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { BriefForm } from "@/components/rd/brief-form";
import { SignatureStamp } from "@/components/gxp/signature-stamp";
import { StatusBadge } from "@/components/gxp/status-badge";
import type { BriefInput, CompetitorInput } from "@/lib/rd/actions";
import { getRdAccess } from "@/lib/rd/access";
import { BRIEF_STATUS } from "@/lib/rd/labels";

export const metadata: Metadata = { title: "Brief · GRUFARCOL eBR" };

// S-06 · Brief: edición de Comercial (borrador o devuelto) y decisión de Dirección técnica.
export default async function BriefPage({ params }: PageProps<"/idi/briefs/[id]">) {
  const { id } = await params;
  const a = await getRdAccess();
  const [{ data: b }, { data: comp }, { data: products }, { data: sigs }] = await Promise.all([
    a.supabase.from("briefs").select("*").eq("id", id).maybeSingle(),
    a.supabase.from("brief_competitors").select("*").eq("brief_id", id).order("order_no"),
    a.supabase.from("products").select("id, code, name").eq("active", true).order("code"),
    a.supabase
      .from("signatures")
      .select("meaning, signer_name, short_signature, signed_at")
      .eq("record_table", "briefs")
      .eq("record_id", id)
      .order("signed_at"),
  ]);
  if (!b) notFound();
  const st = BRIEF_STATUS[b.status];
  const mine = b.created_by === a.ctx.userId;
  const editable = a.briefCreate && mine && ["borrador", "devuelto"].includes(b.status);
  const initial: BriefInput = {
    product_id: b.product_id,
    execution_date: b.execution_date,
    project_name: b.project_name,
    project_type: b.project_type,
    product_category: b.product_category,
    justification: b.justification,
    sources_description: b.sources_description,
    sensorial: (b.sensorial ?? {}) as Record<string, string>,
    target: (b.target ?? {}) as Record<string, string>,
    channels: b.channels ?? [],
    channels_other: b.channels_other ?? "",
    margin_pct: b.margin_pct == null ? null : Number(b.margin_pct),
    suggested_price_by_presentation: (
      (b.suggested_price_by_presentation as { presentation: string; price: number | null }[]) ?? []
    ).length
      ? (b.suggested_price_by_presentation as { presentation: string; price: number | null }[])
      : [
          { presentation: "400 mL", price: null },
          { presentation: "200 mL", price: null },
        ],
    legal_requirements: b.legal_requirements,
    implementation_costs: b.implementation_costs,
    recommendations: b.recommendations,
  };
  const competitors: CompetitorInput[] = (comp ?? []).map((c) => ({
    manufacturer: c.manufacturer,
    product_name: c.product_name,
    container: c.container ?? "",
    cap_type: c.cap_type ?? "",
    label_type: c.label_type ?? "",
    claims: c.claims ?? "",
    actives: c.actives ?? "",
    price: c.price == null ? null : Number(c.price),
    net_content_ml: c.net_content_ml == null ? null : Number(c.net_content_ml),
    aroma: c.aroma ?? "",
    color: c.color ?? "",
    appearance: c.appearance ?? "",
  }));
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={`${b.code} · ${b.project_name || "Brief sin nombre"}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Briefs", href: "/idi/briefs" },
          { label: b.code },
        ]}
        meta={
          <>
            <StatusBadge status={st.status} label={st.label} />
            {b.status === "aprobado" && a.protoRead ? (
              <Link href={`/idi/prototipos?brief=${b.id}`} className="text-small">
                Ver los prototipos de este brief
              </Link>
            ) : null}
          </>
        }
      />
      {b.status === "devuelto" && b.return_reason ? (
        <p
          role="note"
          className="rounded-lg border border-neutral-strong bg-surface-sunken px-3.5 py-2.5 text-sm"
        >
          Devuelto por Dirección técnica: {b.return_reason}
        </p>
      ) : null}
      {(sigs ?? []).length ? (
        <SignatureStamp
          signatures={(sigs ?? []).map((s) => ({
            meaning: s.meaning,
            signerName: s.signer_name,
            shortSignature: s.short_signature,
            signedAt: s.signed_at,
          }))}
        />
      ) : null}
      <BriefForm
        id={b.id}
        code={b.code}
        initial={initial}
        initialCompetitors={
          competitors.length ? competitors : [{ manufacturer: "", product_name: "" }]
        }
        products={(products ?? []).map((p) => ({ id: p.id, label: `${p.code} · ${p.name}` }))}
        editable={editable}
        canSubmit={editable}
        canDecide={a.briefApprove && !mine}
        signer={`${a.ctx.fullName}${a.ctx.shortSignature ? ` (${a.ctx.shortSignature})` : ""}`}
        status={b.status}
      />
    </main>
  );
}
