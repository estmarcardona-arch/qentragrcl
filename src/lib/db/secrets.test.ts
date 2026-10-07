import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// AG-05 · AGENTS.md regla 5: la clave service_role nunca se usa en el código de la app.
// Si una etapa futura necesita la clave en el servidor, se exceptúa aquí de forma explícita.
const ALLOWED: string[] = [];
const PATTERN = /service_role|SERVICE_ROLE/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("AG-05 · sin service_role en el código de la aplicación", () => {
  it("ningún archivo de src/ menciona service_role", () => {
    const offenders = sourceFiles("src").filter(
      (f) => !ALLOWED.includes(f) && PATTERN.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("las variables públicas no incluyen la clave service_role", () => {
    const example = readFileSync(".env.example", "utf8");
    const publicVars = example.split("\n").filter((l) => l.startsWith("NEXT_PUBLIC_"));
    expect(publicVars.some((l) => PATTERN.test(l))).toBe(false);
  });
});
