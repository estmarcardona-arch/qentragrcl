import { describe, expect, it } from "vitest";
import { canonicalJsonb, recordHash, sha256Hex } from "./hash";

// DI-7 · la huella de la app coincide con public.record_hash() de la base.
// Vector calculado en Postgres (Supabase) con el mismo registro.
const ROW = {
  id: "d0000000-0000-4000-8000-000000000001",
  value: 'glicerina 60,00 kg "lote" ñ\n',
  qty: 60.5,
  nested: { b: 1, aa: [1, 2, { z: null }] },
  batch_id: null,
  status: "ejecutado",
  locked_at: "2026-10-05T19:32:00+00:00",
  created_by: "a0000000-0000-4000-8000-000000000001",
  updated_at: "x",
  updated_by: "y",
};

describe("DI-7 · huella del registro", () => {
  it("SHA-256 estándar (vector FIPS 180-2)", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("el texto canónico es igual al jsonb::text de Postgres", () => {
    const { status, locked_at, updated_at, updated_by, ...content } = ROW;
    void status;
    void locked_at;
    void updated_at;
    void updated_by;
    expect(canonicalJsonb(content)).toBe(
      '{"id": "d0000000-0000-4000-8000-000000000001", "qty": 60.5, "value": "glicerina 60,00 kg \\"lote\\" ñ\\n", ' +
        '"nested": {"b": 1, "aa": [1, 2, {"z": null}]}, "batch_id": null, ' +
        '"created_by": "a0000000-0000-4000-8000-000000000001"}',
    );
  });

  it("recordHash coincide con public.record_hash() y excluye estado y bloqueo", async () => {
    expect(await recordHash(ROW)).toBe(
      "027589b87c255908ea69ed963a312a8c6517ae680798befadd93de8d072356c2",
    );
    expect(await recordHash({ ...ROW, status: "aprobado", locked_at: null })).toBe(
      "027589b87c255908ea69ed963a312a8c6517ae680798befadd93de8d072356c2",
    );
  });

  it("cualquier cambio de contenido cambia la huella", async () => {
    expect(await recordHash({ ...ROW, value: "glicerina 61,00 kg" })).not.toBe(
      "027589b87c255908ea69ed963a312a8c6517ae680798befadd93de8d072356c2",
    );
  });
});
