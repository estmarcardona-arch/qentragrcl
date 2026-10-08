import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// RNF-01 · los componentes base cumplen AA y comunican estado con ícono + texto.
test.describe("RNF-01 · /_design (componentes base)", () => {
  test("muestra las tres familias de estado con texto", async ({ page }) => {
    await page.goto("/_design");
    await expect(page.getByRole("heading", { level: 1, name: "Componentes base" })).toBeVisible();
    for (const label of ["Aprobado", "En curso", "Crítica"]) {
      await expect(page.locator(`[data-status]`, { hasText: label }).first()).toBeVisible();
    }
  });

  test("la tabla busca y ordena", async ({ page }) => {
    await page.goto("/_design");
    const table = page.getByRole("table", { name: "Lotes de insumo" });
    await page.getByRole("searchbox", { name: "Buscar en lotes de insumo" }).fill("glicerina");
    await expect(table.getByRole("row")).toHaveCount(3); // encabezado + 2 lotes
    await table.getByRole("button", { name: /Lote interno/ }).click();
    await expect(table.getByRole("columnheader", { name: /Lote interno/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  test("sin violaciones de accesibilidad AA", async ({ page }) => {
    await page.goto("/_design");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
