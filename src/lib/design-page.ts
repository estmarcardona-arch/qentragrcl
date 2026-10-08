// La página /_design es solo de revisión: activa en desarrollo y, si se pide, en el entorno
// de pruebas (ENABLE_DESIGN_PAGE=true). En producción no se define esa variable.
export function isDesignPageEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" || env.ENABLE_DESIGN_PAGE === "true";
}
