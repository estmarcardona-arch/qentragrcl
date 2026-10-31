import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { OrderForm } from "@/components/production/order-form";
import { callRpc } from "@/lib/rpc";
import { getProductionAccess } from "@/lib/production/access";

export const metadata: Metadata = { title: "Crear orden de producción · GRUFARCOL eBR" };

// S-15 · Crear orden de producción (RF-30).
export default async function NewOrderPage() {
  const a = await getProductionAccess();
  if (!a.createOrder) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="Las órdenes las crea coordinación de producción"
          text="Su rol no tiene permiso para crear órdenes (PRD 2.2)."
        />
      </main>
    );
  }
  const [{ data: products }, now] = await Promise.all([
    a.supabase
      .from("products")
      .select(
        "id, code, name, product_lines(regulatory_profile), product_presentations(id, name, net_content, unit, active)",
      )
      .eq("active", true)
      .order("code"),
    callRpc(a.supabase, "reference_now").catch(() => new Date().toISOString()),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(
    new Date(String(now)),
  );
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Crear orden de producción"
        description="Producto, cantidad y versiones aprobadas que se congelarán"
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Producción", href: "/produccion/lotes" },
          { label: "Crear orden" },
        ]}
      />
      <OrderForm
        today={today}
        products={(products ?? []).map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          profile: String(
            (p.product_lines as { regulatory_profile: string } | null)?.regulatory_profile ??
              "cosmetico",
          ),
          presentations: (
            (p.product_presentations as
              | { id: string; name: string; net_content: number; unit: string; active: boolean }[]
              | null) ?? []
          )
            .filter((x) => x.active)
            .map((x) => ({
              id: x.id,
              name: x.name,
              net_content: Number(x.net_content),
              unit: x.unit,
            })),
        }))}
      />
    </main>
  );
}
