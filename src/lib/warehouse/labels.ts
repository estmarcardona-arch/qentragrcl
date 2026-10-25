import type { StatusKey } from "@/components/gxp/status";

// Estados de calidad del lote (semáforo con ícono y texto; Prompt 4) y de trámite del traslado (Prompt 4B).
export const LOT_STATUS: Record<string, { status: StatusKey; label: string }> = {
  cuarentena: { status: "cuarentena", label: "Cuarentena" },
  aprobado: { status: "aprobado", label: "Aprobado" },
  rechazado: { status: "rechazado", label: "Rechazado" },
  vencido: { status: "vencido", label: "Vencido" },
  agotado: { status: "sin_dato", label: "Agotado" },
};

export const TRANSFER_STATUS: Record<string, { status: StatusKey; label: string }> = {
  borrador: { status: "preliminar", label: "Borrador" },
  despachado: { status: "en_curso", label: "Despachado · En tránsito" },
  recibido: { status: "completada", label: "Recibido" },
  anulado: { status: "obsoleto", label: "Anulado" },
};

export const WAREHOUSE_STATUS: Record<string, { status: StatusKey; label: string }> = {
  activa: { status: "vigente", label: "Activa" },
  pendiente_aprobacion: {
    status: "pendiente",
    label: "Pendiente de aprobación de Aseguramiento de la calidad",
  },
  rechazada: { status: "rechazado", label: "Rechazada" },
  inactiva: { status: "sin_dato", label: "Inactiva" },
};

export const FUNCTIONS: [string, string][] = [
  ["materias_primas", "Materias primas"],
  ["material_envase", "Material de envase"],
  ["material_empaque", "Material de empaque"],
  ["granel", "Granel"],
  ["producto_terminado", "Producto terminado"],
  ["rechazo", "Rechazo"],
  ["devolucion", "Devolución"],
];
export const FUNCTION_LABELS = Object.fromEntries(FUNCTIONS);

export const MATERIAL_CLASSES: [string, string][] = [
  ["materia_prima", "Materias primas"],
  ["material_envase", "Material de envase"],
  ["material_empaque", "Material de empaque"],
  ["granel", "Granel"],
  ["producto_terminado", "Producto terminado"],
];
export const CLASS_LABELS = Object.fromEntries(MATERIAL_CLASSES);

export const ZONE_LABELS: Record<string, string> = {
  cuarentena: "Zona de cuarentena",
  aprobado: "Zona de aprobados",
  general: "Zona general",
};

export const MOVEMENT_LABELS: Record<string, string> = {
  recepcion: "Recepción",
  dispensacion: "Dispensación",
  ajuste: "Ajuste",
  devolucion: "Devolución",
  traslado: "Traslado",
  envio_externo: "Envío a bodega externa",
  recepcion_externa: "Recepción en bodega externa",
};

export const ADJUST_KINDS: [string, string][] = [
  ["merma", "Merma"],
  ["conteo", "Conteo físico"],
  ["muestra", "Muestra"],
  ["otro", "Otro"],
];

export const PARTY_KINDS: Record<string, string> = {
  proveedor: "Proveedor",
  maquilador: "Maquilador",
  almacenamiento: "Almacenamiento externo",
  otro: "Otro",
};

/** Vigencia por días a vencer: alerta a 30, 60 y 90 días (RF-21). */
export function expiryBadge(days: number): { status: StatusKey; label: string } {
  if (days < 0) return { status: "vencido", label: `Vencido hace ${-days} d` };
  if (days <= 90) return { status: "por_vencer", label: `Por vencer · ${days} d` };
  return { status: "vigente", label: "Vigente" };
}

/** Tipos de ítem del maestro de materiales (RF-26). */
export const ITEM_TYPES: ["mp" | "envase" | "empaque", string][] = [
  ["mp", "Materia prima"],
  ["envase", "Material de envase"],
  ["empaque", "Material de empaque"],
];
