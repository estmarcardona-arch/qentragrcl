import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { callRpc, type DbClient } from "./index";

function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: unknown[][] = [];
  // rpc usa `this` como el cliente real de supabase-js: detecta llamadas sin enlazar.
  const client = {
    marker: "cliente",
    rpc(this: { marker?: string }, ...a: unknown[]) {
      if (this?.marker !== "cliente") throw new TypeError("rpc llamado sin this");
      calls.push(a);
      return Promise.resolve(result);
    },
  } as unknown as DbClient;
  return { client, calls };
}

describe("callRpc", () => {
  it("llama la función por nombre y devuelve los datos", async () => {
    const { client, calls } = fakeClient({ data: { ok: true }, error: null });
    await expect(callRpc(client, "health_check")).resolves.toEqual({ ok: true });
    expect(calls[0][0]).toBe("health_check");
  });

  it("convierte el error de la base en AppError con el código del PRD", async () => {
    const { client } = fakeClient({ data: null, error: { message: "RECORD_LOCKED: firmado" } });
    const p = callRpc(client, "health_check");
    await expect(p).rejects.toBeInstanceOf(AppError);
    await expect(p).rejects.toMatchObject({ code: "RECORD_LOCKED" });
  });
});
