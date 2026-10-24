import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import { TRANSFER_STATUS } from "@/lib/warehouse/labels";

export const metadata: Metadata = { title: "Traslados · GRUFARCOL eBR" };

type Wh = {
  code: string;
  name: string;
  site_type: string;
  external_parties: { name: string } | null;
} | null;

// S-42a · Traslados (RF-25): código, origen, destino (interno o externo), estado de trámite y fecha; filtro
// «Solo externos». Los externos llevan borde azul.
export default async function TransfersPage({ searchParams }: PageProps<"/bodega/traslados">) {
  const a = await getWarehouseAccess();
  if (!a.trRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a los traslados" />
      </main>
    );
  }
  const sp = await searchParams;
  const onlyExt = sp.externos === "1";
  const { data } = await a.supabase
    .from("stock_transfers")
    .select(
      "id, code, status, created_at, dispatched_at, received_at, from:warehouses!stock_transfers_from_warehouse_id_fkey(code, name, site_type, external_parties(name)), to:warehouses!stock_transfers_to_warehouse_id_fkey(code, name, site_type, external_parties(name))",
    )
    .order("code", { ascending: false });
  const all = (data ?? []).map((t) => ({ ...t, from: t.from as Wh, to: t.to as Wh }));
  const externals = all.filter((t) => t.to?.site_type === "externa");
  const rows = onlyExt ? externals : all;
  const th = "border-b border-border px-3 py-2.5 text-label uppercase";
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Traslados"
        description="Entre bodegas internas y hacia bodegas externas"
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Bodega" },
          { label: "Traslados" },
        ]}
        actions={
          a.trCreate ? (
            <Button asChild>
              <Link href="/bodega/traslados/nuevo">
                <Plus aria-hidden /> Nuevo traslado
              </Link>
            </Button>
          ) : null
        }
      />
      <nav aria-label="Filtro" className="flex gap-1.5">
        {[
          ["", `Todos (${all.length})`],
          ["1", `Solo externos (${externals.length})`],
        ].map(([v, l]) => (
          <Link
            key={v || "todos"}
            href={v ? "/bodega/traslados?externos=1" : "/bodega/traslados"}
            aria-current={(v === "1") === onlyExt ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[13px] no-underline",
              (v === "1") === onlyExt
                ? "border-primary bg-primary font-semibold text-white"
                : "border-border-control bg-white font-medium text-text-strong",
            )}
          >
            {l}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState
          title="No hay traslados"
          text={a.trCreate ? "Cree el primero con «Nuevo traslado»." : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm" data-testid="transfers">
            <caption className="sr-only">Traslados</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {["Código", "Origen", "Destino", "Estado", "Fecha"].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const ext = t.to?.site_type === "externa";
                const st = TRANSFER_STATUS[t.status];
                return (
                  <tr
                    key={t.id}
                    data-code={t.code}
                    className={cn(
                      "border-b border-divider last:border-0",
                      ext && "shadow-[inset_3px_0_0_var(--primary)]",
                    )}
                  >
                    <td className="px-3 py-2.5 font-mono text-[13px] font-semibold">
                      <Link href={`/bodega/traslados/${t.id}`}>{t.code}</Link>
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{t.from?.code}</td>
                    <td className="px-3 py-2.5 font-semibold">
                      {t.to?.code}
                      {ext ? ` · ${t.to?.external_parties?.name} · Externa` : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={st.status} label={st.label} />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {formatDate(t.received_at ?? t.dispatched_at ?? t.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
