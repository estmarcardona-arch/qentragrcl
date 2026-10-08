import { describe, expect, it } from "vitest";
import { hasAnyRole, initials, ROLE_LABELS } from "./roles";

describe("roles", () => {
  it("los 15 roles del PRD tienen nombre visible", () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(15);
  });
  it("iniciales sin tratamiento", () => {
    expect(initials("Dr. Esteban Gaviria")).toBe("EG");
    expect(initials("Paola Mejía")).toBe("PM");
  });
  it("hasAnyRole", () => {
    expect(hasAnyRole(["prod_aux"], ["prod_aux", "prod_coord"])).toBe(true);
    expect(hasAnyRole(["comercial"], ["dt"])).toBe(false);
  });
});
