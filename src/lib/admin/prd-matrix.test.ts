import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cellFlags, moduleCode, parsePrdMatrix } from "./prd-matrix";

const PRD = readFileSync("docs/PRD_GRUFARCOL.md", "utf8");

// RF-04 · la matriz de permisos se toma del PRD 2.2 (16 columnas: módulo + 15 roles).
describe("RF-04 · matriz de permisos del PRD", () => {
  const m = parsePrdMatrix(PRD);

  it("tiene 16 columnas: módulo + los 15 roles", () => {
    expect(m.roles).toHaveLength(15);
    expect(m.roles).toContain("aq_doc");
    expect(m.roles).toContain("gerencia");
  });

  it("tiene los 19 módulos con un código único", () => {
    expect(m.rows).toHaveLength(19);
    const codes = m.rows.map((r) => moduleCode(r.module));
    expect(new Set(codes).size).toBe(19);
  });

  it("interpreta las letras fuera de paréntesis", () => {
    expect(cellFlags("C F")).toEqual({ read: false, create: true, sign: true, approve: false });
    expect(cellFlags("F A (libera)")).toEqual({
      read: false,
      create: false,
      sign: true,
      approve: true,
    });
    expect(cellFlags("C (versión en borrador)")).toEqual({
      read: false,
      create: true,
      sign: false,
      approve: false,
    });
    expect(cellFlags("—")).toEqual({ read: false, create: false, sign: false, approve: false });
  });

  it("dt libera el lote (celda en negrita del PRD)", () => {
    const row = m.rows.find((r) => r.module.startsWith("Liberación final"))!;
    expect(row.cells[m.roles.indexOf("dt")].text).toBe("F A (libera)");
  });
});
