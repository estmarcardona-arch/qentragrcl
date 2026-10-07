import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// RNF-01 (parcial en E0) · la página base cumple WCAG 2.1 AA según axe.
test.describe("RNF-01 · página de inicio de la etapa E0", () => {
  test("carga en español de Colombia", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es-CO");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Registro electrónico de lote",
    );
  });

  test("sin violaciones de accesibilidad AA", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
