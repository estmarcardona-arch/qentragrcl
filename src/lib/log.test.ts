import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { log, redact } = await import("./log");

describe("registro estructurado", () => {
  it("oculta campos sensibles, también anidados", () => {
    expect(redact({ user: "u1", password: "x", nested: { access_token: "y", ok: 1 } })).toEqual({
      user: "u1",
      password: "[oculto]",
      nested: { access_token: "[oculto]", ok: 1 },
    });
  });

  it("escribe una línea JSON con nivel y evento", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    log.info("health.ok", { ms: 12 });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({ level: "info", event: "health.ok", ms: 12 });
    expect(typeof line.at).toBe("string");
    spy.mockRestore();
  });
});
