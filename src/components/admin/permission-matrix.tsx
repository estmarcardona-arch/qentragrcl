import { ROLE_LABELS, type AppRole } from "@/lib/auth/roles";

export type MatrixRow = { code: string; name: string; cells: Record<string, string> };

/**
 * Matriz de permisos (solo lectura), leída de la tabla module_permissions (no de un texto fijo).
 * Debe coincidir con el PRD 2.2: lo verifica la prueba E2E.
 */
export function PermissionMatrix({ roles, rows }: { roles: AppRole[]; rows: MatrixRow[] }) {
  return (
    <section aria-label="Matriz de permisos" className="grid gap-3">
      <h2 className="text-card-title">Matriz de permisos (solo lectura)</h2>
      <p className="text-small text-text-secondary">
        L = leer · C = crear o editar borrador · F = firmar · A = aprobar · — = sin acceso. Fuente:
        PRD 2.2. Se cambia solo por migración aprobada.
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
              {roles.map((r) => (
                <th
                  key={r}
                  scope="col"
                  data-role={r}
                  className="border-b border-border px-3 py-2 font-mono font-semibold"
                  title={ROLE_LABELS[r]}
                >
                  {r}
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
                {roles.map((r) => (
                  <td
                    key={r}
                    className={`px-3 py-2 ${row.cells[r] === "—" ? "text-text-muted" : ""}`}
                  >
                    {row.cells[r] ?? "—"}
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
