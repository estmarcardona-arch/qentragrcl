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

  it("en E2 están habilitados Inicio, Cambios de roles (quien solicita o aprueba) y Administración", () => {
    const enabled = (roles: string[]) =>
      navForRoles(roles)
        .filter((n) => n.stage === null)
        .map((n) => n.key);
    expect(enabled(["prod_aux"])).toEqual(["inicio"]);
    expect(enabled(["dt"])).toEqual(["inicio", "cambios_roles"]);
    expect(enabled(["aq_dir"])).toEqual(["inicio", "cambios_roles"]);
    expect(enabled(["admin"])).toEqual(["inicio", "cambios_roles", "administracion"]);
  });

  it("D-39/D-40: solo Administración, Calidad, Dirección técnica y el auditor ven los cambios de roles", () => {
    const withChanges = SYSTEM_ROLES.filter((r) => NAV_BY_ROLE[r].includes("cambios_roles"));
    expect(withChanges).toEqual(["aq_dir", "dt", "admin", "auditor"]);
  });

  it("RF-07: un rol adicional ve las secciones de los módulos donde tiene permiso", () => {
    const keys = navForRoles(["consulta_trazabilidad"], ["trazabilidad_auditoria"]).map(
      (n) => n.key,
    );
    expect(keys).toEqual(["inicio", "trazabilidad", "auditoria"]);
  });
});
