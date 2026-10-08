import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "./constants";

describe("RF-01 · rutas protegidas", () => {
  it("las rutas públicas no exigen sesión", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/verificar/K7Q2-M9XP-4TD8")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/inicio")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });

  it("solo redirige a rutas internas después del inicio de sesión", () => {
    expect(safeNextPath("/produccion/lotes")).toBe("/produccion/lotes");
    expect(safeNextPath("https://malicioso.test")).toBe("/inicio");
    expect(safeNextPath("//malicioso.test")).toBe("/inicio");
    expect(safeNextPath("/login")).toBe("/inicio");
    expect(safeNextPath(null)).toBe("/inicio");
  });
});
