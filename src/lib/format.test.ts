import { describe, expect, it } from "vitest";
import {
  formatCOP,
  formatDate,
  formatDateTime,
  formatDocumentDate,
  formatNumber,
  formatPercent,
  formatTime,
} from "./format";

// RNF-03 · valores tomados del Prompt 0B.
describe("format (RNF-03)", () => {
  it("formatea pesos colombianos con punto de miles", () => {
    expect(formatCOP(135131500)).toBe("$135.131.500");
    expect(formatCOP(13175000)).toBe("$13.175.000");
    expect(formatCOP(28900)).toBe("$28.900");
    expect(formatCOP(1951.05)).toBe("$1.951,05");
    expect(formatCOP(-1490)).toBe("-$1.490");
  });

  it("formatea números con coma decimal y miles desde 4 cifras", () => {
    expect(formatNumber(2000, 1)).toBe("2.000,0");
    expect(formatNumber(1884, 2)).toBe("1.884,00");
    expect(formatNumber(60, 2)).toBe("60,00");
    expect(formatNumber(4875)).toBe("4.875");
  });

  it("formatea porcentajes con espacio", () => {
    expect(formatPercent(98.2)).toBe("98,2 %");
    expect(formatPercent(100, 2)).toBe("100,00 %");
  });

  it("muestra la hora UTC en America/Bogota (UTC-5) con formato de 24 h", () => {
    // 05/10/2026 14:32 en Bogotá = 19:32 UTC
    const t = "2026-10-05T19:32:00Z";
    expect(formatDate(t)).toBe("05/10/2026");
    expect(formatTime(t)).toBe("14:32");
    expect(formatDateTime(t)).toBe("05/10/2026 14:32");
    expect(formatDocumentDate(t)).toBe("05-10-2026");
  });

  it("cambia de día según la zona horaria de Bogotá", () => {
    // 02:00 UTC del 06/10 es aún 05/10 21:00 en Bogotá
    expect(formatDateTime("2026-10-06T02:00:00Z")).toBe("05/10/2026 21:00");
  });

  it("usa 00 para la medianoche (no 24)", () => {
    expect(formatTime("2026-10-05T05:00:00Z")).toBe("00:00");
  });

  it("rechaza fechas inválidas", () => {
    expect(() => formatDate("no es fecha")).toThrow(RangeError);
  });
});
