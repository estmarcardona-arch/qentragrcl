import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { PresentationForm, ProductForm } from "@/components/warehouse/item-forms";
import { formatNumber } from "@/lib/format";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import { loadUnits } from "@/lib/warehouse/items";

export const metadata: Metadata = { title: "Producto terminado · GRUFARCOL eBR" };

type Doc = {
  version_no: number;
  status: string;
  controlled_documents: { code: string } | null;
} | null;

// S-50 · Producto terminado (RF-26): datos, presentaciones y «dónde se usa» (briefs, fórmulas, especificaciones e
// instructivos de I+D; los lotes de producto llegan con Producción, F6).
export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/bodega/maestros/productos/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const a = await getWarehouseAccess();
  if (!a.itemRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso al maestro de materiales y productos" />
      </main>
    );
  }
  const { data: p } = await a.supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const docSel =
    "document_versions(version_no, status, controlled_documents!document_versions_document_id_fkey(code))";
  const [
    units,
    { data: lines },
    { data: pres },
    { data: briefs },
    { data: formulas },
    { data: specs },
    { data: instr },
  ] = await Promise.all([
    loadUnits(a),
    a.supabase.from("product_lines").select("id, code, name").order("code"),
    a.supabase.from("product_presentations").select("*").eq("product_id", id).order("code"),
    a.supabase.from("briefs").select("id, code, project_name, status").eq("product_id", id),
    a.supabase
      .from("formulas")
      .select(`document_version_id, batch_size, ${docSel}`)
      .eq("product_id", id),
    a.supabase
      .from("specifications")
      .select(`document_version_id, scope, ${docSel}`)
      .eq("product_id", id),
    a.supabase
      .from("instructions")
      .select(`document_version_id, stage, ${docSel}`)
      .eq("product_id", id),
  ]);
  const docLabel = (d: unknown) => {
    const v = d as Doc;
    return `${v?.controlled_documents?.code ?? "Borrador"} v${String(v?.version_no ?? 0).padStart(2, "0")} · ${v?.status ?? ""}`;
  };
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={`${p.code} · ${p.name}`}
        description={`Producto terminado · versión ${p.version}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Materiales y productos", href: "/bodega/maestros?tipo=pt" },
          { label: p.code },
        ]}
        meta={
          <StatusBadge
            status={p.active ? "vigente" : "sin_dato"}
            label={p.active ? "Activo" : "Inactivo"}
          />
        }
      />
      {sp.nuevo ? (
        <p
          role="status"
          className="rounded-lg border border-tram-en-curso-bd bg-tram-en-curso-bg px-3.5 py-2.5 text-sm text-tram-en-curso-fg"
        >
          Producto {p.code} creado. Agregue sus presentaciones.
        </p>
      ) : null}
      <ProductForm
        id={id}
        lines={(lines ?? []).map((l) => ({ id: l.id, label: `${l.code} · ${l.name}` }))}
        editable={a.itemEdit}
        initial={{
          code: p.code,
          name: p.name,
          line_id: p.line_id,
          titular: p.titular ?? "",
          sanitary_registration: p.sanitary_registration ?? "",
          sanitary_registration_expires: p.sanitary_registration_expires ?? "",
          shelf_life_months: p.shelf_life_months,
          storage_conditions: p.storage_conditions ?? "",
          active: p.active,
        }}
      />
      <section
        aria-labelledby="presentaciones"
        className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
      >
        <h2 id="presentaciones" className="text-card-title">
          Presentaciones
        </h2>
        {(pres ?? []).length ? (
          <ul className="flex flex-wrap gap-2" data-testid="presentations">
            {(pres ?? []).map((x) => (
              <li key={x.id} className="rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-mono font-semibold">{x.code}</span> · {x.name} ·{" "}
                {formatNumber(Number(x.net_content), 2)} {x.unit}
                {!x.active ? " · inactiva" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-sm text-text-secondary">Sin presentaciones.</span>
        )}
        {a.itemEdit ? <PresentationForm productId={id} units={units} /> : null}
      </section>
      <section
        aria-labelledby="usos"
        className="grid gap-2 rounded-[10px] border border-border bg-surface p-5"
        data-testid="where-used"
      >
        <h2 id="usos" className="text-card-title">
          Dónde se usa
        </h2>
        <p className="text-small text-text-secondary">
          Del brief al producto terminado. Los lotes de producto y su consumo de materias primas,
          envases y empaques se agregan con Producción (F6); la trazabilidad completa, con F10.
        </p>
        <ul className="grid gap-1 text-sm">
          {(briefs ?? []).map((b) => (
            <li key={b.id}>
              Brief{" "}
              <Link href={`/idi/briefs/${b.id}`} className="font-mono">
                {b.code}
              </Link>{" "}
              · {b.project_name} · {b.status}
            </li>
          ))}
          {(formulas ?? []).map((f) => (
            <li key={f.document_version_id}>
              Fórmula{" "}
              <Link href={`/idi/formulas/${f.document_version_id}`} className="font-mono">
                {docLabel(f.document_versions)}
              </Link>{" "}
              · lote {formatNumber(Number(f.batch_size), 0)} kg
            </li>
          ))}
          {(specs ?? []).map((s) => (
            <li key={s.document_version_id}>
              Especificación ({s.scope}){" "}
              <Link href={`/idi/especificaciones/${s.document_version_id}`} className="font-mono">
                {docLabel(s.document_versions)}
              </Link>
            </li>
          ))}
          {(instr ?? []).map((s) => (
            <li key={s.document_version_id}>
              Instructivo ({s.stage}){" "}
              <Link href={`/idi/instructivos/${s.document_version_id}`} className="font-mono">
                {docLabel(s.document_versions)}
              </Link>
            </li>
          ))}
          {!(briefs ?? []).length &&
          !(formulas ?? []).length &&
          !(specs ?? []).length &&
          !(instr ?? []).length ? (
            <li className="text-text-secondary">Aún no se usa en I+D.</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
