// Cookies de sesión de la plataforma (además de las de Supabase Auth).
/** Marca de la última actividad del usuario (ms desde época). */
export const LAST_ACTIVITY_COOKIE = "ebr_last_activity";
/** Minutos de inactividad permitidos (se fija al iniciar sesión desde app_settings). */
export const IDLE_MINUTES_COOKIE = "ebr_idle_min";
/** Valor por defecto del PRD (RF-01): 15 minutos. */
export const DEFAULT_IDLE_MINUTES = 15;

/** Rutas que no exigen sesión. */
export const PUBLIC_PATHS = ["/login", "/auth", "/verificar", "/api/health", "/_design"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Evita redirecciones abiertas: solo rutas internas. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) {
    return "/inicio";
  }
  return next;
}
