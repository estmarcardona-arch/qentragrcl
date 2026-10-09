import { isSystemRole, type SystemRole } from "@/lib/auth/roles";

// Tarjetas del panel por rol (S-02). Títulos y enlaces del diseño (Prompt 1); los roles sin lámina
// en el diseño usan sus tareas del PRD 2.2. En E1 no hay módulos de datos: todas muestran «Sin datos».

export type CardIcon =
  | "factory"
  | "sign"
  | "clock"
  | "lock"
  | "file"
  | "flag"
  | "box"
  | "triangle"
  | "eye"
  | "approve"
  | "release"
  | "diamond"
  | "users"
  | "flask"
  | "audit"
  | "chart";

export type DashboardCard = {
  id: string;
  icon: CardIcon;
  label: string;
  link: string;
  /** Etapa del PRD en que la tarjeta tendrá datos. */
  stage: string;
};

const C = (
  id: string,
  icon: CardIcon,
  label: string,
  link: string,
  stage: string,
): DashboardCard => ({
  id,
  icon,
  label,
  link,
  stage,
});

export const CARDS_BY_ROLE: Record<SystemRole, DashboardCard[]> = {
  prod_aux: [
    C("mis-lotes", "factory", "Mis lotes de hoy", "Ver mis lotes", "E6"),
    C("mi-firma", "sign", "Pendiente de mi firma", "Ir a firmar", "E6"),
    C("control-peso", "clock", "Control de peso", "Abrir control", "E6"),
    C("equipo-alerta", "lock", "Equipo con alerta", "Ver equipo", "E5"),
  ],
  prod_coord: [
    C("lotes-activos", "factory", "Lotes activos del día", "Ver lotes", "E6"),
    C("verificaciones", "sign", "Verificaciones pendientes de mi firma", "Ir a verificar", "E6"),
    C("ordenes-crear", "file", "Órdenes por crear", "Ver órdenes", "E6"),
    C("despejes", "flag", "Despejes de línea pendientes", "Ver despejes", "E6"),
  ],
  bodega_aux: [
    C("recepciones", "box", "Recepciones pendientes", "Ver recepciones", "E4"),
    C("rotulos", "file", "Rótulos por imprimir", "Ver rótulos", "E4"),
    C("cuarentena", "clock", "Lotes en cuarentena esperando calidad", "Ver cuarentena", "E4"),
    C("inventario-alerta", "triangle", "Inventario con alerta", "Ver alertas", "E4"),
  ],
  bodega_jefe: [
    C("ocupacion", "box", "Ocupación por bodega", "Ver bodegas", "E4"),
    C("traslados", "release", "Traslados pendientes", "Ver traslados", "E4"),
    C("por-vencer", "clock", "Lotes por vencer", "Ver inventario", "E4"),
  ],
  cc_jefe: [
    C("insumos-cuarentena", "clock", "Insumos en cuarentena por liberar", "Ver cuarentena", "E4"),
    C("resultados", "eye", "Resultados por revisar", "Revisar", "E7"),
    C("certificados", "file", "Certificados por aprobar", "Ver certificados", "E7"),
    C("desviacion-cargo", "flag", "Desviación a mi cargo", "Ver desviación", "E8"),
  ],
  aq_dir: [
    C("expedientes", "file", "Expedientes por revisar", "Ver expedientes", "E9"),
    C("desviaciones", "flag", "Desviaciones abiertas", "Ver desviaciones", "E8"),
    C("capa", "clock", "CAPA por vencer", "Ver CAPA", "E8"),
    C("versiones-aq", "approve", "Aprobaciones de versiones", "Ver versiones", "E2B"),
  ],
  dt: [
    C("liberacion", "release", "Lotes pendientes de liberación", "Abrir liberación", "E9"),
    C("versiones-dt", "approve", "Versiones por aprobar", "Ver versiones", "E2B"),
    C("criticas", "diamond", "Desviaciones críticas abiertas", "Ver desviación", "E8"),
  ],
  aq_doc: [
    C("estandarizar", "file", "Documentos por estandarizar", "Ver bandeja", "E2B"),
    C("en-revision", "eye", "Documentos en revisión", "Ver documentos", "E2B"),
    C("revisiones-vencidas", "clock", "Revisiones periódicas vencidas", "Ver listado", "E2B"),
    C("capacitaciones", "users", "Capacitaciones pendientes", "Ver seguimiento", "E2B"),
  ],
  master: [
    C("borradores", "file", "Mis borradores", "Ver borradores", "E2B"),
    C("devueltas", "flag", "Versiones devueltas", "Ver versiones", "E2B"),
    C("plantillas", "flask", "Plantillas de proceso", "Abrir plantillas", "E2B"),
  ],
  gerencia: [
    C(
      "admin-aprobar",
      "approve",
      "Documentos administrativos por aprobar",
      "Ver documentos",
      "E2B",
    ),
    C("formulas-aprobar", "flask", "Fórmulas y prototipos por aprobar", "Ver aprobaciones", "E3"),
    C("liberados-mes", "chart", "Lotes liberados del mes", "Ver resumen", "E9"),
  ],
  comercial: [
    C("mis-briefs", "file", "Mis briefs", "Ver briefs", "E3"),
    C("briefs-revision", "eye", "Briefs en revisión", "Ver estado", "E3"),
  ],
  idi: [
    C("briefs-aprobados", "file", "Briefs aprobados por atender", "Ver briefs", "E3"),
    C("estabilidad", "clock", "Lecturas de estabilidad programadas", "Ver cronograma", "E3"),
    C("versiones-borrador", "flask", "Versiones en borrador", "Ver fórmulas", "E3"),
  ],
  lab_aux: [
    C("muestras", "flask", "Muestras por analizar", "Ver muestras", "E7"),
    C("lecturas", "clock", "Lecturas de estabilidad de hoy", "Ver lecturas", "E3"),
  ],
  admin: [
    C("usuarios", "users", "Usuarios activos", "Ver usuarios", "E2"),
    C("auditores", "clock", "Accesos de auditor por vencer", "Ver accesos", "E2"),
  ],
  auditor: [
    C("expedientes-consulta", "file", "Expedientes de lote", "Buscar lote", "E10"),
    C("bitacora", "audit", "Bitácora de auditoría", "Abrir bitácora", "E10"),
  ],
};

/** Tarjeta para quien solo tiene roles adicionales (PRD 2.6). */
const CUSTOM_ROLE_CARD = C(
  "rol-adicional",
  "file",
  "Pendientes de su rol",
  "Ver sus módulos",
  "E3",
);

/** Tarjetas de un usuario con varios roles, sin duplicados. */
export function cardsForRoles(roles: readonly string[]): DashboardCard[] {
  const seen = new Set<string>();
  const cards = roles
    .flatMap((r) => (isSystemRole(r) ? CARDS_BY_ROLE[r] : []))
    .filter((c) => !seen.has(c.id) && seen.add(c.id));
  return cards.length ? cards : [CUSTOM_ROLE_CARD];
}

/** Saludo según la hora de Bogotá; el director técnico con tratamiento, como en el diseño. */
export function greeting(fullName: string, hour: number): string {
  const part = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const m = /^(dr|dra)\.?\s+\S+\s+(\S+)/i.exec(fullName.trim());
  const who = m
    ? `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}. ${m[2]}`
    : fullName.trim().split(/\s+/)[0];
  return `${part}, ${who}`;
}

/** Semana ISO 8601 (la semana empieza el lunes, RNF-03). */
export function isoWeek(year: number, month: number, day: number): number {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
