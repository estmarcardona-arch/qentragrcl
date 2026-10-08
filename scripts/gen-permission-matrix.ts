// Genera el bloque INSERT de module_permissions desde la matriz del PRD 2.2 (fuente de verdad).
// Uso: npx tsx scripts/gen-permission-matrix.ts > /tmp/matriz.sql  (se pega en una migración NUEVA).
import { readFileSync } from "node:fs";
import { moduleCode, parsePrdMatrix } from "../src/lib/admin/prd-matrix";

const m = parsePrdMatrix(readFileSync("docs/PRD_GRUFARCOL.md", "utf8"));
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

console.log("insert into public.permission_modules (code, name, order_no) values");
console.log(
  m.rows.map((r, i) => `  (${q(moduleCode(r.module))}, ${q(r.module)}, ${i + 1})`).join(",\n") +
    ";\n",
);
console.log(
  "insert into public.module_permissions (module_code, role, cell_text, can_read, can_create, can_sign, can_approve) values",
);
const values: string[] = [];
for (const r of m.rows) {
  r.cells.forEach((c, i) => {
    values.push(
      `  (${q(moduleCode(r.module))}, ${q(m.roles[i])}, ${q(c.text)}, ${c.read}, ${c.create}, ${c.sign}, ${c.approve})`,
    );
  });
}
console.log(values.join(",\n") + ";");
