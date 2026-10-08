import { describe, expect, it } from "vitest";
import { AppError, ERROR_MESSAGES, toAppError } from "./errors";

describe("manejo centralizado de errores", () => {
  it("traduce el código de una excepción de la base", () => {
    const e = toAppError({ message: "SOD_VIOLATION: el ejecutor no puede verificar" });
    expect(e.code).toBe("SOD_VIOLATION");
    expect(e.details).toBe("el ejecutor no puede verificar");
    expect(e.rule).toBe(ERROR_MESSAGES.SOD_VIOLATION.rule);
  });

  it("acepta el código sin detalle", () => {
    expect(toAppError(new Error("RECORD_LOCKED")).code).toBe("RECORD_LOCKED");
  });

  it("todo mensaje dice qué regla y qué hacer", () => {
    for (const m of Object.values(ERROR_MESSAGES)) {
      expect(m.rule.length).toBeGreaterThan(0);
      expect(m.action.length).toBeGreaterThan(0);
    }
  });

  it("los errores desconocidos quedan como UNEXPECTED sin perder el mensaje", () => {
    const e = toAppError(new Error("connection refused"));
    expect(e.code).toBe("UNEXPECTED");
    expect(e.details).toBe("connection refused");
  });

  it("no envuelve dos veces un AppError", () => {
    const original = new AppError("LOT_EXPIRED");
    expect(toAppError(original)).toBe(original);
  });
});
