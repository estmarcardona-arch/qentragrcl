import { describe, expect, it } from "vitest";
import { SYSTEM_ROLES } from "@/lib/auth/roles";
import { CARDS_BY_ROLE, cardsForRoles, greeting, isoWeek } from "./cards";

// RF-02 · panel por rol con tareas propias.
describe("RF-02 · panel por rol", () => {
  it("todos los roles tienen tarjetas", () => {
    for (const role of SYSTEM_ROLES) {
      expect(CARDS_BY_ROLE[role].length).toBeGreaterThan(0);
    }
  });

  it("el auxiliar de producción ve sus cuatro tarjetas del diseño", () => {
    expect(cardsForRoles(["prod_aux"]).map((c) => c.label)).toEqual([
      "Mis lotes de hoy",
      "Pendiente de mi firma",
      "Control de peso",
      "Equipo con alerta",
    ]);
  });

  it("varios roles: tarjetas sin duplicados", () => {
    const ids = cardsForRoles(["aq_dir", "dt"]).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("saludo por hora y con tratamiento", () => {
    expect(greeting("Diego Cárdenas", 9)).toBe("Buenos días, Diego");
    expect(greeting("Dr. Esteban Gaviria", 15)).toBe("Buenas tardes, Dr. Gaviria");
    expect(greeting("Paola Mejía", 20)).toBe("Buenas noches, Paola");
  });

  it("semana ISO: el lunes 05/10/2026 es la semana 41", () => {
    expect(isoWeek(2026, 10, 5)).toBe(41);
  });
});
