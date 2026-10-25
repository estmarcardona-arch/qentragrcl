import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { ReleasePanel, type QuarantineLot } from "@/components/warehouse/release-panel";
import { formatDate, formatDateTime } from "@/lib/format";
import { getWarehouseAccess } from "@/lib/warehouse/access";
import { LOT_STATUS } from "@/lib/warehouse/labels";

export const metadata: Metadata = { title: "Liberación de insumos · GRUFARCOL eBR" };

// S-13 · Liberación de insumos (RF-22): bandeja de lotes en cuarentena con sus resultados; el laboratorio los
// registra y Control de calidad aprueba o rechaza con firma. Resueltos recientemente al final.
export default async function ReleasePage() {
  const a = await getWarehouseAccess();
  if (!a.releaseRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso a la liberación de insumos"
          text="Su rol no tiene permiso en «Liberación de insumos» (PRD 2.2)."
        />
      </main>
    );
  }
  const [{ data: lots }, { data: tests }, { data: recent }] = await Promise.all([
    a.supabase
      .from("material_lots")
      .select(
        "id, internal_code, supplier_lot, received_at, expiry_date, coa_ref, materials(code, name), external_parties(name)",
      )
      .eq("status", "cuarentena")
      .order("received_at"),
    a.supabase.from("lot_tests").select("*").order("order_no"),
    a.supabase
      .from("material_lots")
      .select(
        "id, internal_code, supplier_lot, status, status_reason, released_at, materials(code, name), external_parties(name)",
      )
      .neq("status", "cuarentena")
      .not("released_at", "is", null)
      .order("released_at", { ascending: false })
      .limit(5),
  ]);
  const queue: QuarantineLot[] = (lots ?? []).map((l) => {
    const m = l.materials as { code: string; name: string } | null;
    return {
      id: l.id,
      code: l.internal_code,
      material: `${m?.name} · ${m?.code}`,
      supplierLot: l.supplier_lot,
      supplier: (l.external_parties as { name: string } | null)?.name ?? "—",
      received: formatDateTime(l.received_at),
      expiry: formatDate(l.expiry_date),
      coa: l.coa_ref,
      tests: (tests ?? [])
        .filter((t) => t.lot_id === l.id)
        .map((t) => ({
          id: t.id,
          name: t.name,
          method: t.method,
          acceptance: t.acceptance,
          value: t.result_value,
          conforming: t.conforming,
          recordedBy: t.recorded_by,
        })),
    };
  });
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Liberación de insumos"
        description={`${queue.length} lote${queue.length === 1 ? "" : "s"} en cuarentena por liberar`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Calidad" },
          { label: "Liberación de insumos" },
        ]}
      />
      <section aria-labelledby="cuarentena" className="grid gap-3">
        <h2 id="cuarentena" className="text-card-title">
          Lotes en cuarentena por liberar ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <EmptyState
            title="No hay lotes en cuarentena"
            text="Los lotes recibidos aparecen aquí hasta su liberación."
          />
        ) : (
          queue.map((l) => (
            <ReleasePanel
              key={l.id}
              lot={l}
              canRecord={a.recordResults}
              canRelease={a.release}
              userId={a.ctx.userId}
              signer={a.signer}
            />
          ))
        )}
      </section>
      <section aria-labelledby="resueltos" className="grid gap-2">
        <h2 id="resueltos" className="text-card-title">
          Resueltos recientemente
        </h2>
        {(recent ?? []).length === 0 ? (
          <EmptyState title="Sin decisiones recientes" />
        ) : (
          <ul className="grid gap-2">
            {(recent ?? []).map((l) => {
              const m = l.materials as { code: string; name: string } | null;
              const st = LOT_STATUS[l.status] ?? LOT_STATUS.aprobado;
              return (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-4 py-3 text-sm"
                >
                  <span>
                    <b className="font-semibold">
                      {m?.name} · {m?.code}
                    </b>{" "}
                    <Link href={`/bodega/inventario/${l.id}`} className="font-mono">
                      {l.internal_code}
                    </Link>{" "}
                    · {l.supplier_lot} · {(l.external_parties as { name: string } | null)?.name}
                    {l.status_reason ? ` · ${l.status_reason}` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs">{formatDate(String(l.released_at))}</span>
                    <StatusBadge status={st.status} label={st.label} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
