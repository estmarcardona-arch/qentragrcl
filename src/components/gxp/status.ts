import {
  ChevronUp,
  ChevronsUp,
  CircleCheck,
  CircleMinus,
  CircleX,
  Clock,
  Circle,
  Eye,
  Lock,
  OctagonAlert,
  PenLine,
  Play,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

/*
 * Catálogo de estados del sistema de diseño (Prompt 0, punto 2).
 * Tres familias que no se mezclan:
 *   calidad   → semáforo (verde/ámbar/rojo/gris): estado de calidad y vigencia.
 *   tramite   → neutro y azul primario: avance de tareas y registros.
 *   severidad → violeta: solo desviaciones y CAPA.
 * Cada estado tiene ícono y texto: el color nunca es el único portador del significado.
 */

export type StatusFamily = "calidad" | "tramite" | "severidad";

export type StatusDefinition = {
  family: StatusFamily;
  label: string;
  icon: LucideIcon;
  /** Clases Tailwind de fondo, texto y borde (tokens de globals.css). */
  className: string;
};

const ok = "bg-q-ok-bg text-q-ok-fg ring-q-ok-bd";
const warn = "bg-q-warn-bg text-q-warn-fg ring-q-warn-bd";
const bad = "bg-q-bad-bg text-q-bad-fg ring-q-bad-bd";
const off = "bg-q-off-bg text-q-off-fg ring-q-off-bd";

export const STATUSES = {
  // A. Semáforo de calidad y vigencia
  aprobado: { family: "calidad", label: "Aprobado", icon: CircleCheck, className: ok },
  vigente: { family: "calidad", label: "Vigente", icon: CircleCheck, className: ok },
  cuarentena: { family: "calidad", label: "Cuarentena", icon: TriangleAlert, className: warn },
  por_vencer: { family: "calidad", label: "Por vencer", icon: Clock, className: warn },
  rechazado: { family: "calidad", label: "Rechazado", icon: CircleX, className: bad },
  vencido: { family: "calidad", label: "Vencido", icon: CircleX, className: bad },
  borrador: { family: "calidad", label: "Borrador", icon: CircleMinus, className: off },
  sin_dato: { family: "calidad", label: "Sin dato", icon: CircleMinus, className: off },

  // B. Estado de trámite
  en_curso: {
    family: "tramite",
    label: "En curso",
    icon: Play,
    className: "bg-tram-en-curso-bg text-tram-en-curso-fg ring-tram-en-curso-bd",
  },
  pendiente: {
    family: "tramite",
    label: "Pendiente",
    icon: Circle,
    className: "bg-tram-pendiente-bg text-tram-pendiente-fg ring-tram-pendiente-bd",
  },
  completada: {
    family: "tramite",
    label: "Completada",
    icon: CircleCheck,
    className: "bg-tram-completada-bg text-tram-completada-fg ring-tram-completada-bd",
  },
  bloqueada: {
    family: "tramite",
    label: "Bloqueada",
    icon: Lock,
    className: "bg-tram-bloqueada-bg text-tram-bloqueada-fg ring-tram-bloqueada-bd",
  },
  en_revision: {
    family: "tramite",
    label: "En revisión",
    icon: Eye,
    className: "bg-tram-revision-bg text-tram-revision-fg ring-tram-revision-bd",
  },
  firmada: {
    family: "tramite",
    label: "Firmada",
    icon: PenLine,
    className: "bg-tram-firmada-bg text-tram-firmada-fg ring-tram-firmada-bd",
  },

  // C. Severidad de desviación
  menor: {
    family: "severidad",
    label: "Menor",
    icon: ChevronUp,
    className: "bg-sev-menor-bg text-sev-menor-fg ring-sev-menor-bd",
  },
  mayor: {
    family: "severidad",
    label: "Mayor",
    icon: ChevronsUp,
    className: "bg-sev-mayor-bg text-sev-mayor-fg ring-sev-mayor-bd",
  },
  critica: {
    family: "severidad",
    label: "Crítica",
    icon: OctagonAlert,
    className: "bg-sev-critica-bg text-sev-critica-fg ring-sev-critica-bd",
  },
} as const satisfies Record<string, StatusDefinition>;

export type StatusKey = keyof typeof STATUSES;
