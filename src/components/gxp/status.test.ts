import { describe, expect, it } from "vitest";
import { STATUSES } from "./status";

// RNF-01 · ningún estado se comunica solo con color; las familias no se mezclan (Prompt 0).
describe("RNF-01 · catálogo de estados", () => {
  const entries = Object.entries(STATUSES);

  it("todo estado tiene ícono y texto", () => {
    for (const [, def] of entries) {
      expect(def.icon).toBeTruthy();
      expect(def.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("el semáforo (q-*) solo se usa en la familia calidad", () => {
    for (const [key, def] of entries) {
      const usesSemaphore = /\bbg-q-/.test(def.className);
      expect(usesSemaphore, key).toBe(def.family === "calidad");
    }
  });

  it("el violeta (sev-*) solo se usa en la familia severidad", () => {
    for (const [key, def] of entries) {
      expect(/\bbg-sev-/.test(def.className), key).toBe(def.family === "severidad");
    }
  });

  it("el trámite usa solo tokens tram-*", () => {
    for (const [key, def] of entries) {
      if (def.family === "tramite") expect(def.className, key).toMatch(/^bg-tram-/);
    }
  });
});
