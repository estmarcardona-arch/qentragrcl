"use client";

import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import { EmptyState, ErrorState, LoadingSkeleton } from "./state-card";

/*
 * Tabla de datos (Prompt 0: encabezado, fila, ordenar, búsqueda, paginación) sobre TanStack Table v9.
 * Las features se declaran a nivel de módulo (requisito de v9). Las columnas se crean con
 * `dataTableColumns<Fila>()` para que tengan el tipo de estas features.
 * Para listas grandes (p. ej. 10.000 filas, PRD §1) la paginación y el filtrado irán al servidor.
 */

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

export type DataTableFeatures = typeof dataTableFeatures;

export function dataTableColumns<TRow extends RowData>() {
  return createColumnHelper<DataTableFeatures, TRow>();
}

type DataTableProps<TRow extends RowData> = {
  /** Descripción accesible de la tabla. */
  caption: string;
  columns: ColumnDef<DataTableFeatures, TRow, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  data: TRow[];
  loading?: boolean;
  error?: { title: string; text?: string; action?: ReactNode } | null;
  empty?: { title: string; text?: string; action?: ReactNode };
  searchPlaceholder?: string;
  pageSize?: number;
  /** Filas compactas (vista compacta del Prompt 0). */
  compact?: boolean;
  /** Clases por fila (p. ej. resaltar una fila vencida). */
  rowClassName?: (row: TRow) => string | undefined;
};

export function DataTable<TRow extends RowData>({
  caption,
  columns,
  data,
  loading,
  error,
  empty = { title: "No hay registros" },
  searchPlaceholder = "Buscar…",
  pageSize = 10,
  compact,
  rowClassName,
}: DataTableProps<TRow>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    globalFilterFn: "includesString",
    initialState: { pagination: { pageIndex: 0, pageSize } },
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  if (loading)
    return <LoadingSkeleton variant="table" label={`Cargando ${caption.toLowerCase()}…`} />;
  if (error) return <ErrorState {...error} />;
  if (data.length === 0) return <EmptyState {...empty} />;

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex } = table.state.pagination;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <div className="grid overflow-hidden rounded-[10px] border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Search aria-hidden className="size-4 text-text-muted" />
        <Input
          type="search"
          aria-label={`Buscar en ${caption.toLowerCase()}`}
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={(e) => table.setGlobalFilter(e.target.value)}
          className="h-9 max-w-sm"
        />
        <span className="ml-auto text-small text-text-secondary" aria-live="polite">
          {formatNumber(filteredCount)} de {formatNumber(data.length)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-sunken">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  const Icon =
                    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      className="border-b border-border px-4 py-2.5 text-label whitespace-nowrap text-text-strong uppercase"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 uppercase"
                        >
                          <table.FlexRender header={header} />
                          <Icon aria-hidden className="size-3.5" />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-text-secondary">
                  Sin resultados para «{globalFilter}».
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-divider last:border-0 hover:bg-background",
                    rowClassName?.(row.original),
                  )}
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className={cn("px-4", compact ? "py-1.5" : "py-3")}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
        <span className="text-small text-text-secondary">
          Página {formatNumber(pageIndex + 1)} de {formatNumber(pageCount)}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft aria-hidden />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
