import type { RoleInfo } from "@/lib/auth/roles";

export type MatrixRow = { code: string; name: string; cells: Record<string, string> };

/**
 * Matriz de permisos (solo lectura), leída de la tabla module_permissions (no de un texto fijo).
 * Columnas de los roles del sistema = PRD 2.2 (lo verifica la prueba E2E); después, los roles
 * adicionales activos (PRD 2.6), marcados con «adicional».
 */
export function PermissionMatrix({ roles, rows }: { roles: RoleInfo[]; rows: MatrixRow[] }) {
  const columns = [
    ...roles.filter((r) => r.is_system),
    ...roles.filter((r) => !r.is_system && r.active),
  ];
  return (
    <section aria-label="Matriz de permisos" className="grid gap-3">
      <h2 className="text-card-title">Matriz de permisos (solo lectura)</h2>
      <p className="text-small text-text-secondary">
        L = leer · C = crear o editar borrador · F = firmar · A = aprobar · — = sin acceso. Los
        roles del sistema son la línea base del PRD 2.2; los permisos de los roles adicionales se
        configuran en «Roles y permisos».
      </p>
      <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
        <table data-testid="permission-matrix" className="w-max min-w-full text-left text-xs">
          <caption className="sr-only">Permisos por módulo y rol</caption>
          <thead className="bg-surface-sunken">
            <tr>
              <th
                scope="col"
                className="sticky left-0 border-b border-border bg-[inherit] px-3 py-2 font-semibold"
              >
                Módulo
              </th>
              {columns.map((r) => (
                <th
                  key={r.code}
                  scope="col"
                  data-role={r.code}
                  data-system={r.is_system ? "true" : "false"}
                  className="border-b border-border px-3 py-2 font-mono font-semibold"
                  title={r.name}
                >
                  {r.code}
                  {r.is_system ? null : (
                    <span className="block font-sans text-[10px] font-normal text-text-muted">
                      adicional
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} className="border-b border-divider last:border-0">
                <th scope="row" className="sticky left-0 max-w-72 bg-surface px-3 py-2 font-medium">
                  {row.name}
                </th>
                {columns.map((r) => (
                  <td
                    key={r.code}
                    data-system={r.is_system ? "true" : "false"}
                    className={`px-3 py-2 ${row.cells[r.code] === "—" ? "text-text-muted" : ""}`}
                  >
                    {row.cells[r.code] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
