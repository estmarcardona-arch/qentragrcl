"use client";

import { Clock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LAST_ACTIVITY_COOKIE } from "@/lib/auth/constants";
import { signOut } from "@/app/login/actions";

const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
const WARNING_SECONDS = 60;

/**
 * Cierre de sesión por inactividad (RF-01). Escucha la actividad del usuario, actualiza la cookie
 * de última actividad (la usa el proxy en cada navegación) y avisa 60 s antes de cerrar.
 */
export function IdleTimer({ minutes }: { minutes: number }) {
  const lastActivity = useRef(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const expiring = useRef(false);

  const touch = useCallback(() => {
    const now = Date.now();
    // Escribe la cookie como máximo cada 15 s.
    if (now - lastActivity.current > 15_000) {
      document.cookie = `${LAST_ACTIVITY_COOKIE}=${now}; path=/; samesite=lax`;
    }
    lastActivity.current = now;
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    lastActivity.current = Date.now();
    for (const e of EVENTS) window.addEventListener(e, touch, { passive: true });
    const id = window.setInterval(() => {
      const idleMs = Date.now() - lastActivity.current;
      const remaining = Math.ceil((minutes * 60_000 - idleMs) / 1000);
      if (remaining <= 0 && !expiring.current) {
        expiring.current = true;
        void signOut("inactividad");
      } else if (remaining <= WARNING_SECONDS) {
        setSecondsLeft(Math.max(remaining, 0));
      }
    }, 1000);
    return () => {
      for (const e of EVENTS) window.removeEventListener(e, touch);
      window.clearInterval(id);
    };
  }, [minutes, touch]);

  if (secondsLeft === null) return null;
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Aviso de cierre de sesión por inactividad"
      className="fixed right-6 bottom-6 z-50 grid max-w-sm grid-cols-[24px_1fr] gap-3 rounded-[10px] border border-neutral-strong bg-surface p-4 shadow-lg"
    >
      <Clock aria-hidden className="size-6 text-text-secondary" />
      <div className="grid gap-2">
        <b className="text-[15px] font-semibold">Su sesión se cerrará en {secondsLeft} s</b>
        <span className="text-small text-text-secondary">
          Por seguridad, la sesión se cierra tras {minutes} minutos de inactividad.
        </span>
        <Button size="sm" className="justify-self-start" onClick={touch}>
          Seguir trabajando
        </Button>
      </div>
    </div>
  );
}
