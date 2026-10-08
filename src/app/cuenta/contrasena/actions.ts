"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { log } from "@/lib/log";
import { callRpc } from "@/lib/rpc";

export type PasswordState = { errors?: string[] };

/**
 * Crear o cambiar la contraseña con la política del sistema (mínimo 12, sin reutilizar la actual ni
 * las últimas N). La política se valida en la base antes de cambiarla en Supabase Auth.
 */
export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { errors: ["Las contraseñas no coinciden."] };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const policy = (await callRpc(supabase, "check_password_policy", { p_password: password })) as {
    ok: boolean;
    errors: string[];
  };
  if (!policy.ok) return { errors: policy.errors };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    log.warn("auth.password_change_failed", { code: error.code ?? error.message });
    return {
      errors: [
        error.code === "same_password"
          ? "No puede reutilizar la contraseña actual."
          : "No se pudo cambiar la contraseña. Intente de nuevo.",
      ],
    };
  }
  await callRpc(supabase, "record_password_change", { p_password: password });
  log.info("auth.password_changed", {});
  redirect("/inicio");
}
