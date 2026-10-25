import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { getWarehouseAccess } from "@/lib/warehouse/access";

export const metadata: Metadata = { title: "Materiales y productos · GRUFARCOL eBR" };

const TABS = [
  ["mp", "Materias primas"],
  ["envase", "Material de envase"],
  ["empaque", "Material de empaque"],
  ["pt", "Productos terminados"],
] as const;
type Tab = (typeof TABS)[number][0];

// S-50 · Maestro de materiales y productos (RF-26, PRD 1.9): todo lo que se inventaría se crea antes aquí con su
// código y su forma de almacenamiento. Lo mantienen I+D, el jefe de bodega y Aseguramiento de la calidad.
export default async function ItemMasterPage({ searchParams }: PageProps<"/bodega/maestros">) {
  const a = await getWarehouseAccess();
  if (!a.itemRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso al maestro de materiales y productos"
          text="Su rol no tiene permiso en «Maestro de materiales y productos» (PRD 2.2)."
        />
      </main>
    );
  }
  const sp = await searchParams;
  const tab = (TABS.find(([t]) => t === sp.tipo)?.[0] ?? "mp") as Tab;
  const q = String(sp.q ?? "")
    .trim()
    .toLowerCase();
  const th = "border-b border-border px-3 py-2.5 text-label uppercase";
  const [{ data: materials }, { data: products }, { data: lots }] = await Promise.all([
    tab !== "pt"
      ? a.supabase.from("materials").select("*").eq("type", tab).order("code")
      : Promise.resolve({ data: [] as never[] }),
    tab === "pt"
      ? a.supabase
          .from("products")
          .select("*, product_lines(name), product_presentations(name, active)")
          .order("code")
      : Promise.resolve({ data: [] as never[] }),
    a.supabase.from("v_lot_stock").select("material_id, qty_on_hand, effective_status"),
  ]);
  const stockOf = (id: string) =>
    (lots ?? [])
      .filter((l) => l.material_id === id && l.effective_status !== "rechazado")
      .reduce((s, l) => s + Number(l.qty_on_hand), 0);
  const match = (...xs: (string | null | undefined)[]) =>
    !q || xs.join(" ").toLowerCase().includes(q);
  const mats = (materials ?? []).filter((m) => match(m.code, m.name, m.inci_name));
  const prods = (products ?? []).filter((p) => match(p.code, p.name, p.sanitary_registration));
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Materiales y productos"
        description="Maestro de ítems de inventario: código, unidad de almacenamiento, condiciones de almacenamiento y vida útil. Solo lo que existe aquí se recibe en bodega."
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Bodega" },
          { label: "Materiales y productos" },
        ]}
        actions={
          a.itemEdit ? (
            <Button asChild>
              <Link
                href={
                  tab === "pt"
                    ? "/bodega/maestros/productos/nuevo"
                    : `/bodega/maestros/nuevo?tipo=${tab}`
                }
              >
                <Plus aria-hidden /> {tab === "pt" ? "Nuevo producto terminado" : "Nuevo ítem"}
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <nav aria-label="Tipo de ítem" className="flex flex-wrap gap-1.5">
          {TABS.map(([t, l]) => (
            <Link
              key={t}
              href={`/bodega/maestros?tipo=${t}`}
              aria-current={t === tab ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] no-underline",
                t === tab
                  ? "border-primary bg-primary font-semibold text-white"
                  : "border-border-control bg-white font-medium text-text-strong",
              )}
            >
              {l}
            </Link>
          ))}
        </nav>
        <form action="/bodega/maestros" role="search" className="flex items-end gap-2">
          <input type="hidden" name="tipo" value={tab} />
          <label className="grid gap-1.5">
            <span className="text-label uppercase">Buscar</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Código o nombre"
              className="h-10 w-64 rounded-md border border-border-control bg-white px-2.5 text-sm"
            />
          </label>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </div>

      {tab !== "pt" ? (
        mats.length === 0 ? (
          <EmptyState
            title="No hay ítems de este tipo"
            text={
              a.itemEdit ? "Créelos con «Nuevo ítem» antes de recibirlos en bodega." : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
            <table className="w-full text-left text-sm" data-testid="items">
              <caption className="sr-only">Ítems del maestro</caption>
              <thead className="bg-surface-sunken">
                <tr>
                  {[
                    "Código",
                    "Nombre",
                    "Unidad",
                    "Almacenamiento",
                    "Vida útil",
                    "Empaque de compra",
                    "Existencias",
                    "Estado",
                  ].map((h) => (
                    <th key={h} scope="col" className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mats.map((m) => (
                  <tr
                    key={m.id}
                    data-code={m.code}
                    className={cn(
                      "border-b border-divider last:border-0",
                      !m.active && "text-text-secondary",
                    )}
                  >
                    <td className="px-3 py-2.5 font-mono text-[13px] font-semibold">
                      <Link href={`/bodega/maestros/${m.id}`}>{m.code}</Link>
                    </td>
                    <td className="px-3 py-2.5">
                      {m.name}
                      {m.inci_name ? (
                        <span className="block text-xs text-text-secondary">{m.inci_name}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{m.unit}</td>
                    <td className="px-3 py-2.5 text-xs">{m.storage_conditions ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {m.shelf_life_months
                        ? `${m.shelf_life_months} meses${m.shelf_life_kind === "reanalisis" ? " (reanálisis)" : ""}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {m.default_package_type
                        ? `${m.default_package_type} × ${formatNumber(Number(m.default_package_qty ?? 0), 0)} ${m.unit}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {formatNumber(stockOf(m.id), 2)} {m.unit}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge
                        status={m.active ? "vigente" : "sin_dato"}
                        label={m.active ? "Activo" : "Inactivo"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : prods.length === 0 ? (
        <EmptyState title="No hay productos terminados" />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm" data-testid="products">
            <caption className="sr-only">Productos terminados</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {[
                  "Código",
                  "Producto",
                  "Línea",
                  "Registro sanitario",
                  "Presentaciones",
                  "Vida útil",
                  "Almacenamiento",
                  "Estado",
                ].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prods.map((p) => (
                <tr key={p.id} data-code={p.code} className="border-b border-divider last:border-0">
                  <td className="px-3 py-2.5 font-mono text-[13px] font-semibold">
                    <Link href={`/bodega/maestros/productos/${p.id}`}>{p.code}</Link>
                  </td>
                  <td className="px-3 py-2.5">{p.name}</td>
                  <td className="px-3 py-2.5">
                    {(p.product_lines as { name: string } | null)?.name}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {p.sanitary_registration ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {((p.product_presentations as { name: string; active: boolean }[] | null) ?? [])
                      .filter((x) => x.active)
                      .map((x) => x.name)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {p.shelf_life_months ? `${p.shelf_life_months} meses` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs">{p.storage_conditions ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge
                      status={p.active ? "vigente" : "sin_dato"}
                      label={p.active ? "Activo" : "Inactivo"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
