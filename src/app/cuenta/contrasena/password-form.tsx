"use client";

import { CircleX, KeyRound } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, type PasswordState } from "./actions";

export function PasswordForm({
  minLength,
  historyCount,
}: {
  minLength: number;
  historyCount: number;
}) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  return (
    <form action={action} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="password" className="text-sm font-medium">
          Nueva contraseña
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={minLength}
          className="h-10 bg-white"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="confirm" className="text-sm font-medium">
          Confirme la contraseña
        </Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="h-10 bg-white"
        />
      </div>
      <ul className="grid gap-1 text-small text-text-secondary">
        <li>· Al menos {minLength} caracteres.</li>
        {historyCount > 0 ? (
          <li>· Distinta de la actual y de sus últimas {historyCount} contraseñas.</li>
        ) : null}
      </ul>
      {state.errors?.length ? (
        <div
          role="alert"
          className="grid gap-1 rounded-lg bg-q-bad-bg px-3.5 py-3 ring-1 ring-q-bad-bd ring-inset"
        >
          {state.errors.map((e) => (
            <p key={e} className="flex items-start gap-1.5 text-sm font-medium text-q-bad-fg">
              <CircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
              {e}
            </p>
          ))}
        </div>
      ) : null}
      <Button type="submit" disabled={pending} className="h-11">
        <KeyRound aria-hidden />
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
