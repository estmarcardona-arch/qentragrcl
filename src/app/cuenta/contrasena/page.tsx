import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/common/state-card";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Contraseña · GRUFARCOL eBR" };

// Crear la contraseña (invitación o restablecimiento) o cambiarla (obligatorio si caducó).
export default function PasswordPage({ searchParams }: PageProps<"/cuenta/contrasena">) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Suspense fallback={<LoadingSkeleton label="Cargando…" className="w-full max-w-[440px]" />}>
        <PasswordCard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PasswordCard({
  searchParams,
}: Pick<PageProps<"/cuenta/contrasena">, "searchParams">) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const { origen } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["password_min_length", "password_history_count"]);
  const setting = (k: string, d: number) => Number(data?.find((s) => s.key === k)?.value ?? d);

  const title =
    origen === "invitacion"
      ? "Bienvenido: cree su contraseña"
      : origen === "recuperacion"
        ? "Restablezca su contraseña"
        : ctx.passwordExpired
          ? "Su contraseña venció"
          : "Cambie su contraseña";

  return (
    <div className="grid w-full max-w-[440px] gap-[18px] rounded-xl border border-border bg-surface p-8 shadow-[0_8px_28px_rgba(22,27,35,.08)]">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
          <ShieldCheck aria-hidden className="size-5" />
        </span>
        <span className="text-base leading-5 font-semibold">GRUFARCOL eBR</span>
      </div>
      <div>
        <h1 className="mb-1 text-page-title">{title}</h1>
        <p className="text-sm leading-[21px] text-text-secondary">
          {ctx.fullName} · {ctx.email}
        </p>
      </div>
      <PasswordForm
        minLength={setting("password_min_length", 12)}
        historyCount={setting("password_history_count", 5)}
      />
    </div>
  );
}
