import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { DEFAULT_IDLE_MINUTES } from "@/lib/auth/constants";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión · GRUFARCOL eBR" };

// S-01 · Inicio de sesión (Prompt 1). El valor configurado de inactividad se aplica al iniciar sesión;
// aquí se muestra el valor por defecto del PRD.
export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Suspense fallback={null}>
          <LoginForm idleMinutes={DEFAULT_IDLE_MINUTES} />
        </Suspense>
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-divider px-8 py-[18px] text-[13px] leading-[19px] text-text-secondary">
        <span className="flex items-center gap-2">
          <ShieldCheck aria-hidden className="size-4" />
          Los registros de esta plataforma tienen validez de evidencia.
        </span>
        <span className="font-mono text-xs font-medium">GRUFARCOL eBR v0.1.0</span>
      </footer>
    </div>
  );
}
