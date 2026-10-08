"use client";

import { DataTable, dataTableColumns } from "@/components/common/data-table";
import { StatusBadge } from "@/components/gxp/status-badge";
import type { StatusKey } from "@/components/gxp/status";
import { formatDate, formatNumber } from "@/lib/format";

// Datos ficticios del Prompt 0B (lotes de insumo).
type MaterialLot = {
  code: string;
  material: string;
  supplierLot: string;
  expiry: string;
  qtyKg: number | null;
  status: StatusKey;
  location: string;
};

const LOTS: MaterialLot[] = [
  {
    code: "MP-2026-0187",
    material: "Glicerina",
    supplierLot: "GLI-2509-A",
    expiry: "2027-09-30T05:00:00Z",
    qtyKg: 40,
    status: "aprobado",
    location: "MP-E03-P2-01",
  },
  {
    code: "MP-2026-0204",
    material: "Glicerina",
    supplierLot: "GLI-2511-B",
    expiry: "2027-12-31T05:00:00Z",
    qtyKg: 120,
    status: "aprobado",
    location: "MP-E03-P2-02",
  },
  {
    code: "MP-2026-0198",
    material: "Fenoxietanol",
    supplierLot: "FEN-2510-C",
    expiry: "2028-03-15T05:00:00Z",
    qtyKg: null,
    status: "cuarentena",
    location: "MP-E01-P1-02",
  },
  {
    code: "MP-2026-0190",
    material: "Poloxámero 184",
    supplierLot: "—",
    expiry: "",
    qtyKg: null,
    status: "aprobado",
    location: "MP-E02-P1-01",
  },
  {
    code: "MP-2026-0192",
    material: "Ácido cítrico",
    supplierLot: "—",
    expiry: "",
    qtyKg: null,
    status: "rechazado",
    location: "RE-E01-P1-01",
  },
  {
    code: "MP-2026-0171",
    material: "Perfume",
    supplierLot: "—",
    expiry: "2026-09-30T05:00:00Z",
    qtyKg: null,
    status: "vencido",
    location: "RE-E01-P1-02",
  },
];

const col = dataTableColumns<MaterialLot>();
const columns = col.columns([
  col.accessor("code", {
    header: "Lote interno",
    cell: (info) => <span className="font-mono text-code">{info.getValue()}</span>,
  }),
  col.accessor("material", { header: "Material" }),
  col.accessor("supplierLot", {
    header: "Lote proveedor",
    cell: (info) => <span className="font-mono text-code">{info.getValue()}</span>,
  }),
  col.accessor("expiry", {
    header: "Vence",
    cell: (info) => (info.getValue() ? formatDate(info.getValue()) : "Sin dato"),
  }),
  col.accessor("qtyKg", {
    header: "Saldo (kg)",
    cell: (info) => {
      const v = info.getValue();
      return v === null ? "Sin dato" : formatNumber(v, 2);
    },
  }),
  col.accessor("status", {
    header: "Estado de calidad",
    enableSorting: false,
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  col.accessor("location", {
    header: "Ubicación",
    cell: (info) => <span className="font-mono text-code">{info.getValue()}</span>,
  }),
]);

export function DemoTable({ mode }: { mode: "datos" | "cargando" | "vacio" | "error" }) {
  return (
    <DataTable
      caption="Lotes de insumo"
      columns={columns}
      data={mode === "datos" ? LOTS : []}
      loading={mode === "cargando"}
      error={
        mode === "error"
          ? {
              title: "No se pudo cargar el inventario",
              text: "Sus filtros se conservan; intente de nuevo.",
            }
          : null
      }
      empty={{
        title: "Aún no hay lotes recibidos",
        text: "Cuando bodega reciba un lote aparecerá aquí.",
      }}
      searchPlaceholder="Buscar por lote, material o ubicación"
      pageSize={5}
    />
  );
}
