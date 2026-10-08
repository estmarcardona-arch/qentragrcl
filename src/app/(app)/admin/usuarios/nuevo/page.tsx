import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { InviteForm } from "@/components/admin/invite-form";
import type { AreaOption } from "@/components/admin/types";
import { createClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "Nuevo usuario · GRUFARCOL eBR" };

export default async function NewUserPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizational_areas")
    .select("id, name, process_code")
    .eq("active", true)
    .order("name");
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Nuevo usuario"
        description="Se crea una invitación con enlace de un solo uso. El acceso de auditor exige fecha de vencimiento."
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Usuarios y roles", href: "/admin/usuarios" },
          { label: "Nuevo usuario" },
        ]}
      />
      <InviteForm areas={(data ?? []) as AreaOption[]} />
    </main>
  );
}
