// Lectura de la matriz de permisos del PRD (sección 2.2) desde el Markdown.
// Fuente de verdad para: la migración que llena module_permissions (scripts/gen-permission-matrix.ts),
// la prueba unitaria y la prueba E2E que compara la pantalla S-04 con el PRD.

export type MatrixCell = {
  /** Texto de la celda normalizado (sin **, espacios simples); «—» = sin acceso. */
  text: string;
  read: boolean;
  create: boolean;
  sign: boolean;
  approve: boolean;
};

export type PermissionMatrix = {
  roles: string[];
  rows: { module: string; cells: MatrixCell[] }[];
};

export function normalizeCell(raw: string): string {
  return raw.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

/** Letras L, C, F, A fuera de paréntesis (los paréntesis son aclaraciones). */
export function cellFlags(text: string): Omit<MatrixCell, "text"> {
  const bare = text.replace(/\([^)]*\)/g, " ");
  const has = (l: string) => new RegExp(`(^|\\s)${l}(\\s|$)`).test(bare);
  return { read: has("L"), create: has("C"), sign: has("F"), approve: has("A") };
}

export function parsePrdMatrix(markdown: string): PermissionMatrix {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => l.startsWith("| Módulo |"));
  if (start < 0) throw new Error("No se encontró la matriz de permisos (| Módulo |) en el PRD");
  const split = (l: string) =>
    l
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
  const header = split(lines[start]);
  const roles = header.slice(1);
  const rows: PermissionMatrix["rows"] = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith("|"); i++) {
    const cells = split(lines[i]);
    if (cells.length !== header.length) {
      throw new Error(`Fila ${i + 1} con ${cells.length} columnas; se esperaban ${header.length}`);
    }
    rows.push({
      module: normalizeCell(cells[0]),
      cells: cells.slice(1).map((c) => {
        const text = normalizeCell(c);
        return { text, ...cellFlags(text) };
      }),
    });
  }
  return { roles, rows };
}

/** Código estable del módulo a partir de su nombre («Recepción / Inventario» → «recepcion_inventario»). */
export function moduleCode(name: string): string {
  return name
    .split("(")[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
