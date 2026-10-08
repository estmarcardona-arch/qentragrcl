import { describe, expect, it } from "vitest";
import { isDesignPageEnabled } from "./design-page";

const env = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;

describe("página /_design", () => {
  it("activa en desarrollo", () => {
    expect(isDesignPageEnabled(env({ NODE_ENV: "development" }))).toBe(true);
  });
  it("oculta en producción por defecto", () => {
    expect(isDesignPageEnabled(env({ NODE_ENV: "production" }))).toBe(false);
  });
  it("activa en pruebas solo con ENABLE_DESIGN_PAGE=true", () => {
    expect(isDesignPageEnabled(env({ NODE_ENV: "production", ENABLE_DESIGN_PAGE: "true" }))).toBe(
      true,
    );
  });
});
