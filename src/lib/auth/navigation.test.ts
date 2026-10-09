import { describe, expect, it } from "vitest";
import { navForRoles, NAV_BY_ROLE } from "./navigation";
import { SYSTEM_ROLES } from "./roles";

// RF-02 · cada rol ve solo sus secciones.
describe("RF-02 · menú por rol", () => {
  it("todos los roles tienen menú y empiezan por Inicio", () => {
    for (const role of SYSTEM_ROLES) {
      expect(NAV_BY_ROLE[role][0]).toBe("inicio");
    }
  });

  it("el auxiliar de producción ve producción pero no administración", () => {
    const keys = navForRoles(["prod_aux"]).map((n) => n.key);
    expect(keys).toEqual([
      "inicio",
      "documentos",
      "produccion",
      "equipos",
      "desviaciones",
      "trazabilidad",
    ]);
    expect(keys).not.toContain("administracion");
  });

  it("solo el administrador ve Administración", () => {
    const withAdmin = SYSTEM_ROLES.filter((r) => NAV_BY_ROLE[r].includes("administracion"));
    expect(withAdmin).toEqual(["admin"]);
  });

  it("varios roles: unión sin duplicados en el orden del menú", () => {
    const keys = navForRoles(["prod_aux", "bodega_aux"]).map((n) => n.key);
    expect(keys).toEqual([
      "inicio",
      "documentos",
      "bodega",
      "produccion",
      "equipos",
      "desviaciones",
      "trazabilidad",
    ]);
  });

  it("en E2 están habilitados Inicio y, para el administrador, Administración", () => {
    expect(
      navForRoles(["dt"])
        .filter((n) => n.stage === null)
        .map((n) => n.key),
    ).toEqual(["inicio"]);
    expect(
      navForRoles(["admin"])
        .filter((n) => n.stage === null)
        .map((n) => n.key),
    ).toEqual(["inicio", "administracion"]);
  });

  it("RF-07: un rol adicional ve las secciones de los módulos donde tiene permiso", () => {
    const keys = navForRoles(["consulta_trazabilidad"], ["trazabilidad_auditoria"]).map(
      (n) => n.key,
    );
    expect(keys).toEqual(["inicio", "trazabilidad", "auditoria"]);
  });
});
