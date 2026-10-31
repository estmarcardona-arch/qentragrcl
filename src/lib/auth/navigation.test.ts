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

  it("desde F4 se habilitan Bodega y Calidad, y desde F5 Equipos, según el rol", () => {
    const enabled = (roles: string[]) =>
      navForRoles(roles)
        .filter((n) => n.stage === null)
        .map((n) => n.key);
    expect(enabled(["prod_aux"])).toEqual(["inicio", "documentos", "equipos"]);
    expect(enabled(["bodega_aux"])).toEqual(["inicio", "documentos", "bodega", "equipos"]);
    expect(enabled(["lab_aux"])).toEqual(["inicio", "documentos", "calidad", "equipos"]);
    expect(enabled(["cc_jefe"])).toEqual([
      "inicio",
      "aprobaciones",
      "documentos",
      "calidad",
      "equipos",
    ]);
    expect(enabled(["dt"])).toEqual([
      "inicio",
      "aprobaciones",
      "documentos",
      "idi",
      "calidad",
      "equipos",
      "cambios_roles",
    ]);
    // D-20: Aseguramiento de la calidad aprueba las bodegas externas.
    expect(enabled(["aq_dir"])).toEqual([
      "inicio",
      "aprobaciones",
      "documentos",
      "bodega",
      "calidad",
      "equipos",
      "cambios_roles",
    ]);
    // RF-23: el administrador también crea bodegas (Prompt 4B); no ve Equipos (matriz 2.2).
    expect(enabled(["admin"])).toEqual(["inicio", "bodega", "cambios_roles", "administracion"]);
    expect(enabled(["comercial"])).not.toContain("equipos");
  });

  it("RF-92: todos los roles con acceso al SGD ven Documentos; el administrador no (matriz 2.2)", () => {
    const withDocs = SYSTEM_ROLES.filter((r) => NAV_BY_ROLE[r].includes("documentos"));
    expect(withDocs).toEqual(SYSTEM_ROLES.filter((r) => r !== "admin"));
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
