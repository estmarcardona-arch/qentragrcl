"use client";

import {
  CalendarX,
  CircleCheck,
  CircleX,
  Clock,
  Eye,
  EyeOff,
  Info,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import { signIn, type LoginState } from "./actions";

const BANNERS = {
  credentials: {
    tone: "bad",
    icon: CircleX,
    title: "No pudimos iniciar su sesión",
    text: "Verifique su correo y su contraseña. Tras 5 intentos fallidos el acceso se bloquea durante 15 minutos; puede esperar o solicitar el desbloqueo a Administración.",
  },
  invalid: {
    tone: "bad",
    icon: CircleX,
    title: "Revise los datos",
    text: "Escriba un correo electrónico válido y su contraseña.",
  },
  no_access: {
    tone: "neutral",
    icon: Lock,
    title: "Su cuenta no tiene acceso vigente",
    text: "No tiene un rol activo o su acceso venció. Solicite la asignación o la ampliación a Administración.",
  },
  expired: {
    tone: "neutral",
    icon: CalendarX,
    title: "Cuenta de auditor vencida",
    text: "Su acceso venció. Solicite una ampliación a Administración.",
  },
  contrasena: {
    tone: "ok",
    icon: CircleCheck,
    title: "Contraseña actualizada",
    text: "Ingrese con su nueva contraseña.",
  },
  enlace: {
    tone: "bad",
    icon: CircleX,
    title: "El enlace no es válido",
    text: "El enlace ya se usó o venció. Solicite uno nuevo a Administración.",
  },
  inactividad: {
    tone: "neutral",
    icon: Clock,
    title: "Su sesión se cerró por inactividad",
    text: "Por seguridad, la sesión se cierra tras el tiempo de inactividad configurado. Ingrese de nuevo para continuar.",
  },
  salida: {
    tone: "ok",
    icon: CircleCheck,
    title: "Sesión cerrada",
    text: "Cerró su sesión correctamente.",
  },
} as const;

const TONES = {
  bad: "bg-q-bad-bg ring-q-bad-bd [&_b]:text-q-bad-fg [&_svg]:text-q-bad-ic",
  ok: "bg-q-ok-bg ring-q-ok-bd [&_b]:text-q-ok-fg [&_svg]:text-q-ok-ic",
  neutral: "bg-surface-sunken ring-border [&_b]:text-foreground [&_svg]:text-text-secondary",
} as const;

export function LoginForm({ idleMinutes }: { idleMinutes: number }) {
  const params = useSearchParams();
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  const [showPassword, setShowPassword] = useState(false);

  const motivo = params.get("motivo");
  const bannerKey =
    state.error ??
    (motivo === "inactividad" ||
    motivo === "salida" ||
    motivo === "contrasena" ||
    motivo === "enlace"
      ? motivo
      : undefined);
  const base = bannerKey ? BANNERS[bannerKey] : null;
  const banner =
    base && bannerKey === "expired" && state.expiredAt
      ? {
          ...base,
          text: `Su acceso venció el ${formatDate(state.expiredAt)}. Solicite una ampliación a Administración.`,
        }
      : base;
  const fieldError = state.error === "credentials" || state.error === "invalid";

  return (
    <div className="grid w-full max-w-[440px] gap-[18px] rounded-xl border border-border bg-surface p-8 shadow-[0_8px_28px_rgba(22,27,35,.08)]">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
          <ShieldCheck aria-hidden className="size-5" />
        </span>
        <span className="text-base leading-5 font-semibold">GRUFARCOL eBR</span>
      </div>
      <div>
        <h1 className="mb-1 text-page-title">Iniciar sesión</h1>
        <p className="text-sm leading-[21px] text-text-secondary">
          Ingrese con su cuenta corporativa.
        </p>
      </div>

      {banner ? (
        <div
          role={banner.tone === "bad" ? "alert" : "status"}
          className={cn(
            "grid grid-cols-[24px_1fr] items-start gap-3 rounded-lg px-3.5 py-3 ring-1 ring-inset",
            TONES[banner.tone],
          )}
        >
          <banner.icon aria-hidden className="size-[22px]" />
          <span>
            <b className="block text-sm leading-5 font-semibold">{banner.title}</b>
            <span className="text-sm leading-[21px] text-text-strong">{banner.text}</span>
          </span>
        </div>
      ) : null}

      <form action={action} className="grid gap-[18px]" noValidate>
        <input type="hidden" name="next" value={params.get("next") ?? ""} />
        <div className="grid gap-1.5">
          <Label htmlFor="email" className="text-sm font-medium">
            Correo electrónico
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            defaultValue={state.email ?? ""}
            aria-invalid={fieldError || undefined}
            className="h-10 bg-white text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              aria-invalid={fieldError || undefined}
              aria-describedby={fieldError ? "password-error" : undefined}
              className="h-10 bg-white pr-11 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-secondary"
            >
              {showPassword ? (
                <EyeOff aria-hidden className="size-[18px]" />
              ) : (
                <Eye aria-hidden className="size-[18px]" />
              )}
            </button>
          </div>
          {fieldError ? (
            <p
              id="password-error"
              className="flex items-center gap-1.5 text-[13px] leading-[19px] font-medium text-q-bad-fg"
            >
              <CircleX aria-hidden className="size-3.5" />
              Correo o contraseña no válidos
            </p>
          ) : null}
        </div>
        <div className="flex justify-end">
          <span className="flex items-center gap-1.5 text-sm text-text-secondary">
            <Info aria-hidden className="size-4" />
            ¿Olvidó su contraseña? Solicite el restablecimiento a Administración.
          </span>
        </div>
        <Button type="submit" disabled={pending} className="h-11 text-[15px]">
          {pending ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>

      <div className="grid grid-cols-[18px_1fr] gap-2 rounded-lg bg-surface-sunken px-3 py-2.5 text-[13px] leading-[19px] text-neutral-strong">
        <Clock aria-hidden className="mt-px size-4 text-text-secondary" />
        <span>
          Por seguridad, su sesión se cierra tras{" "}
          <b className="font-semibold text-foreground">{idleMinutes} minutos</b> de inactividad.
        </span>
      </div>
    </div>
  );
}
