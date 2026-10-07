// AGENTS.md regla 10: versiones exactas registradas en docs/VERSIONES.md.
// Falla si package.json tiene rangos (^, ~, *, x) o si VERSIONES.md no coincide.
// Con --write regenera la tabla de dependencias de VERSIONES.md.

import { readFileSync, writeFileSync } from "node:fs";

const FILE = "docs/VERSIONES.md";
const START = "<!-- deps:start -->";
const END = "<!-- deps:end -->";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const rows: [string, string, string][] = [
  ...Object.entries(pkg.dependencies).map(([n, v]): [string, string, string] => [
    n,
    v,
    "producción",
  ]),
  ...Object.entries(pkg.devDependencies).map(([n, v]): [string, string, string] => [
    n,
    v,
    "desarrollo",
  ]),
].sort((a, b) => a[0].localeCompare(b[0]));

const errors = rows
  .filter(([, v]) => !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v))
  .map(([n, v]) => `${n}: versión no exacta «${v}»`);

const table = [
  START,
  "| Paquete | Versión | Tipo |",
  "|---|---|---|",
  ...rows.map(([n, v, t]) => `| \`${n}\` | ${v} | ${t} |`),
  END,
].join("\n");

const doc = readFileSync(FILE, "utf8");
const current = doc.slice(doc.indexOf(START), doc.indexOf(END) + END.length);

if (process.argv.includes("--write")) {
  writeFileSync(FILE, doc.replace(current, table));
  console.log(`Escrito ${FILE}`);
} else if (current !== table) {
  errors.push(`${FILE} no coincide con package.json (ejecute npm run versions:write)`);
}

if (errors.length) {
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`Versiones OK: ${rows.length} dependencias exactas y registradas.`);
