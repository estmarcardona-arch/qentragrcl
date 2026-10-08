// Matriz de trazabilidad requisito → prueba (PRD §14).
// Falla si un requisito de una etapa ya alcanzada (<= etapa_actual) no tiene prueba,
// si el archivo de prueba no existe o si el archivo no menciona el ID del requisito.
// Con --write regenera docs/VALIDACION/MATRIZ.md.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

type Test = { tipo: string; archivo: string };
type Req = { id: string; etapa: string; descripcion: string; pruebas: Test[] };
type Matrix = { etapa_actual: string; orden_etapas: string[]; requisitos: Req[] };

const MATRIX = "docs/VALIDACION/matriz-trazabilidad.json";
const OUTPUT = "docs/VALIDACION/MATRIZ.md";

const matrix = JSON.parse(readFileSync(MATRIX, "utf8")) as Matrix;
const current = matrix.orden_etapas.indexOf(matrix.etapa_actual);
if (current < 0) {
  console.error(`etapa_actual desconocida: ${matrix.etapa_actual}`);
  process.exit(1);
}

const errors: string[] = [];
const ids = new Set<string>();
for (const req of matrix.requisitos) {
  if (ids.has(req.id)) errors.push(`${req.id}: ID duplicado`);
  ids.add(req.id);
  const stage = matrix.orden_etapas.indexOf(req.etapa);
  if (stage < 0) errors.push(`${req.id}: etapa desconocida ${req.etapa}`);
  if (stage > current) continue;
  if (req.pruebas.length === 0) errors.push(`${req.id} (${req.etapa}): sin prueba`);
  for (const t of req.pruebas) {
    if (!existsSync(t.archivo)) {
      errors.push(`${req.id}: no existe ${t.archivo}`);
    } else if (!readFileSync(t.archivo, "utf8").includes(req.id)) {
      errors.push(`${req.id}: ${t.archivo} no menciona el ID`);
    }
  }
}

if (process.argv.includes("--write")) {
  const rows = matrix.requisitos.map((r) => {
    const tests = r.pruebas.map((t) => `${t.tipo}: \`${t.archivo}\``).join("<br>") || "—";
    const due = matrix.orden_etapas.indexOf(r.etapa) <= current;
    const state = !due ? "Etapa futura" : r.pruebas.length ? "Cubierto" : "SIN PRUEBA";
    return `| ${r.id} | ${r.etapa} | ${r.descripcion} | ${tests} | ${state} |`;
  });
  const md = [
    "# Matriz de trazabilidad requisito → prueba",
    "",
    `Generada por \`npm run traceability:write\` desde \`${MATRIX}\`. Etapa actual: **${matrix.etapa_actual}**.`,
    "",
    "| Requisito | Etapa | Descripción | Pruebas | Estado |",
    "|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  writeFileSync(OUTPUT, md);
  console.log(`Escrito ${OUTPUT}`);
}

if (errors.length) {
  console.error("Matriz de trazabilidad con errores:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const due = matrix.requisitos.filter((r) => matrix.orden_etapas.indexOf(r.etapa) <= current).length;
console.log(`Matriz OK: ${due} requisitos hasta ${matrix.etapa_actual} con prueba.`);
