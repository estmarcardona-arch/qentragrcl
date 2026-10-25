import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { MaterialForm } from "@/components/warehouse/item-forms";
import { formatDate, formatNumber } from "@/lib/format";
import type { MaterialInput } from "@/lib/warehouse/actions";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import { loadUnits } from "@/lib/warehouse/items";
import { ITEM_TYPES, LOT_STATUS } from "@/lib/warehouse/labels";

export const metadata: Metadata = { title: "Ítem del maestro · GRUFARCOL eBR" };

type Version = {
  version_no: number;
  status: string;
  controlled_documents: { code: string } | null;
} | null;

// S-50 · Ítem del maestro (RF-26): datos editables con motivo y «dónde se usa»: prototipos y fórmulas de I+D, lotes
// en bodega y, desde F6, dispensaciones y lotes de producto (base de la trazabilidad RF-70).
export default async function ItemPage({
  params,
  searchParams,
}: PageProps<"/bodega/maestros/[id]">) {
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
  const { data: m } = await a.supabase.from("materials").select("*").eq("id", id).maybeSingle();
  if (!m) notFound();
  const [units, { data: protos }, { data: formulas }, { data: lots }] = await Promise.all([
    loadUnits(a),
    a.supabase
      .from("prototype_items")
      .select("pct, formula_prototypes(id, code, status, briefs(code))")
      .eq("material_id", id),
    a.supabase
      .from("formula_items")
      .select(
        "pct, formulas(id, document_version_id, products(code, name), document_versions(version_no, status, controlled_documents!document_versions_document_id_fkey(code)))",
      )
      .eq("material_id", id),
    a.supabase
      .from("v_lot_stock")
      .select("*")
      .eq("material_id", id)
      .order("received_at", { ascending: false }),
  ]);
  const used = (protos ?? []).length > 0 || (formulas ?? []).length > 0 || (lots ?? []).length > 0;
  const typeLabel = ITEM_TYPES.find(([t]) => t === m.type)?.[1] ?? m.type;
  const initial: MaterialInput = {
    code: m.code,
    name: m.name,
    type: m.type as MaterialInput["type"],
    unit: m.unit,
    inci_name: m.inci_name ?? "",
    default_function: m.default_function ?? "",
    requires_coa: m.requires_coa,
    storage_conditions: m.storage_conditions ?? "",
    shelf_life_months: m.shelf_life_months,
    shelf_life_kind: m.shelf_life_kind as MaterialInput["shelf_life_kind"],
    default_package_type: m.default_package_type ?? "",
    default_package_qty: m.default_package_qty == null ? null : Number(m.default_package_qty),
    active: m.active,
  };
  const th = "px-2 py-2 text-label uppercase";
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={`${m.code} · ${m.name}`}
        description={`${typeLabel} · unidad ${m.unit} · versión ${m.version}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Materiales y productos", href: `/bodega/maestros?tipo=${m.type}` },
          { label: m.code },
        ]}
        meta={
          <StatusBadge
            status={m.active ? "vigente" : "sin_dato"}
            label={m.active ? "Activo" : "Inactivo"}
          />
        }
      />
      {sp.nuevo ? (
        <p
          role="status"
          className="rounded-lg border border-tram-en-curso-bd bg-tram-en-curso-bg px-3.5 py-2.5 text-sm text-tram-en-curso-fg"
        >
          Ítem {m.code} creado. Ya se puede usar en I+D y recibir en bodega.
        </p>
      ) : null}
      <MaterialForm id={id} initial={initial} units={units} editable={a.itemEdit} locked={used} />

      <section
        aria-labelledby="usos"
        className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
        data-testid="where-used"
      >
        <h2 id="usos" className="text-card-title">
          Dónde se usa
        </h2>
        <p className="text-small text-text-secondary">
          Trazabilidad del ítem desde I+D hasta bodega. La dispensación y los lotes de producto
          terminado se agregan con Producción (F6) y la consulta completa hacia atrás y hacia
          adelante con Trazabilidad (F10).
        </p>
        <div className="grid grid-cols-2 gap-4 max-[1279px]:grid-cols-1">
          <div className="grid content-start gap-1.5">
            <h3 className="text-sm font-semibold">I+D · prototipos</h3>
            {(protos ?? []).length ? (
              <ul className="grid gap-1 text-sm">
                {(protos ?? []).map((p, i) => {
                  const fp = p.formula_prototypes as {
                    id: string;
                    code: string;
                    status: string;
                    briefs: { code: string } | null;
                  } | null;
                  return (
                    <li key={i}>
                      <Link href={`/idi/prototipos/${fp?.id}`} className="font-mono">
                        {fp?.code}
                      </Link>{" "}
                      · brief {fp?.briefs?.code} · {formatNumber(Number(p.pct), 2)} %
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span className="text-sm text-text-secondary">Sin prototipos.</span>
            )}
          </div>
          <div className="grid content-start gap-1.5">
            <h3 className="text-sm font-semibold">I+D · fórmulas maestras</h3>
            {(formulas ?? []).length ? (
              <ul className="grid gap-1 text-sm">
                {(formulas ?? []).map((f, i) => {
                  const fo = f.formulas as {
                    document_version_id: string;
                    products: { code: string; name: string } | null;
                    document_versions: Version;
                  } | null;
                  const v = fo?.document_versions;
                  return (
                    <li key={i}>
                      <Link href={`/idi/formulas/${fo?.document_version_id}`} className="font-mono">
                        {v?.controlled_documents?.code ?? "Fórmula"} v
                        {String(v?.version_no ?? 0).padStart(2, "0")}
                      </Link>{" "}
                      · {fo?.products?.code} {fo?.products?.name} · {formatNumber(Number(f.pct), 2)}{" "}
                      %
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span className="text-sm text-text-secondary">Sin fórmulas.</span>
            )}
          </div>
        </div>
        <div className="grid gap-1.5">
          <h3 className="text-sm font-semibold">Bodega · lotes recibidos</h3>
          {(lots ?? []).length ? (
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Lotes del ítem</caption>
              <thead className="bg-surface-sunken">
                <tr>
                  {[
                    "Código interno",
                    "Lote proveedor",
                    "Proveedor",
                    "Vence",
                    "Recibido",
                    "Saldo",
                    "Calidad",
                  ].map((h) => (
                    <th key={h} scope="col" className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(lots ?? []).map((l) => {
                  const st = LOT_STATUS[String(l.effective_status)] ?? LOT_STATUS.cuarentena;
                  return (
                    <tr key={l.id} className="border-t border-divider">
                      <td className="px-2 py-1.5 font-mono text-xs font-semibold">
                        <Link href={`/bodega/inventario/${l.id}`}>{l.internal_code}</Link>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs">{l.supplier_lot}</td>
                      <td className="px-2 py-1.5">{l.supplier_name}</td>
                      <td className="px-2 py-1.5 font-mono text-xs">
                        {formatDate(String(l.expiry_date))}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs">
                        {formatNumber(Number(l.qty_received), 2)} {l.unit}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs">
                        {formatNumber(Number(l.qty_on_hand), 2)} {l.unit}
                      </td>
                      <td className="px-2 py-1.5">
                        <StatusBadge status={st.status} label={st.label} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <span className="text-sm text-text-secondary">Aún no se ha recibido ningún lote.</span>
          )}
        </div>
      </section>
    </main>
  );
}
