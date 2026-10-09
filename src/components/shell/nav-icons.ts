import {
  Boxes,
  ClipboardCheck,
  Factory,
  FileText,
  FlaskConical,
  Flag,
  Gauge,
  GitBranch,
  House,
  ListChecks,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { NavKey } from "@/lib/auth/navigation";

// Íconos del menú (equivalentes lucide de los trazos del diseño S-02).
export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  inicio: House,
  aprobaciones: ClipboardCheck,
  documentos: FileText,
  idi: FlaskConical,
  bodega: Boxes,
  produccion: Factory,
  calidad: ShieldCheck,
  equipos: Gauge,
  desviaciones: Flag,
  trazabilidad: GitBranch,
  liberacion: Send,
  auditoria: ListChecks,
  cambios_roles: UserCog,
  administracion: SlidersHorizontal,
};
