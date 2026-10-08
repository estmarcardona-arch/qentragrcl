import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/state-card";
import type { AdminUser } from "@/components/admin/types";
import { UsersTable } from "@/components/admin/users-table";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "Usuarios y roles · GRUFARCOL eBR" };

// S-03 · Usuarios y roles (RF-03). La guarda de administrador está en el layout de /admin.
export default async function UsersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users");

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Usuarios y roles"
        description="Alta por invitación, roles con vigencia y desactivación. Los usuarios no se borran."
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Administración" },
          { label: "Usuarios y roles" },
        ]}
        actions={
          <Button asChild>
            <Link href="/admin/usuarios/nuevo">
              <UserPlus aria-hidden />
              Nuevo usuario
            </Link>
          </Button>
        }
      />
      <p className="text-small text-text-secondary">
        La administración de usuarios no incluye firmar registros de calidad.
      </p>
      {error ? (
        <ErrorState
          title="No se pudo cargar la lista de usuarios"
          text="Intente de nuevo."
          code={error.code}
        />
      ) : (
        <UsersTable users={(data ?? []) as unknown as AdminUser[]} />
      )}
    </main>
  );
}
