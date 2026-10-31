import { expect, test, type Browser, type Page } from "@playwright/test";
import { DEV_PASSWORD, hasSeedUsers, loginOk, USERS } from "./helpers";

// E6 · Equipos y hoja de vida (PRD 1.10, RF-50, RF-51): BAL-014 queda «No apto para uso» por la calibración vencida
// (AC-45) y el jefe de bodega registra la calibración nueva con su certificado y huella (AC-44). Requiere la semilla
// de equipos del 0B (CI).
// Requisitos: RF-50, RF-51, AC-44, AC-45.
const hasSeedDocs = process.env.E2E_SEED_DOCS === "1";

async function as(
  browser: Browser,
  email: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginOk(page, email);
  return { page, close: () => ctx.close() };
}

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n",
);

test.describe.serial("E6 · equipos y hoja de vida", () => {
  test.skip(!hasSeedUsers || !hasSeedDocs, "Requiere la semilla de equipos (CI)");

  test("AC-45 · ET-02 con el mantenimiento vencido no es apto y explica por qué", async ({
    browser,
  }) => {
    const p = await as(browser, USERS.paola);
    await p.page.goto("/equipos/ET-02");
    await expect(p.page.getByTestId("verdict")).toContainText("No apto para uso");
    await expect(p.page.getByTestId("reasons")).toContainText(
      "mantenimiento vencido el 20/10/2026",
    );
    await expect(p.page.getByTestId("card-calificacion")).toContainText("No aplica");
    await p.close();
  });

  test("AC-45 · RF-51 · BAL-014 con la calibración vencida queda «No apto para uso» y avisa en la campana", async ({
    browser,
  }, info) => {
    // BAL-014 cambia en la prueba siguiente: ambas corren solo en el proyecto de escritorio.
    test.skip(info.project.name !== "escritorio", "Depende del estado de BAL-014");
    const h = await as(browser, USERS.hernan);
    // La campana trae los avisos de vencimiento generados para quien registra equipos.
    await expect(h.page.getByTestId("bell")).toHaveAccessibleName(/sin leer/);
    await h.page.getByTestId("bell").click();
    await expect(
      h.page.getByRole("menuitem", { name: /Calibración de BAL-014 vencida/ }),
    ).toBeVisible();
    await h.page.keyboard.press("Escape");

    await h.page.goto("/equipos");
    const row = h.page.locator('tr[data-code="BAL-014"]');
    await expect(row).toContainText("Calibración vencida");
    await expect(row).toContainText("No apto para uso");
    await h.page.getByRole("link", { name: "Con alertas" }).click();
    await expect(h.page.locator('tr[data-code="BAL-014"]')).toBeVisible();

    await h.page.goto("/equipos/BAL-014");
    await expect(h.page.getByTestId("verdict")).toContainText("No apto para uso");
    await expect(h.page.getByTestId("reasons")).toContainText("calibración vencida el 02/10/2026");
    await expect(h.page.getByTestId("card-calibracion")).toContainText("Vencido");
    await h.close();
  });

  test("RF-50 · AC-44 · el jefe de bodega registra la calibración con su certificado y deja de estar vencida", async ({
    browser,
  }, info) => {
    test.skip(info.project.name !== "escritorio", "Cambia datos: se ejecuta en un solo proyecto");
    test.setTimeout(120_000);
    const h = await as(browser, USERS.hernan);
    await h.page.goto("/equipos/BAL-014");
    await h.page.getByRole("button", { name: "Registrar calibración" }).click();
    const dialog = h.page.getByRole("dialog");
    await expect(dialog).toContainText("Ejecuté");
    const next = new Date();
    next.setFullYear(next.getFullYear() + 1);
    await dialog.getByLabel(/Próximo vencimiento/).fill(next.toISOString().slice(0, 10));
    await dialog.getByLabel("Proveedor o ejecutor").fill("Metrología Andina");
    await dialog.getByLabel("N.º de certificado o informe").fill("CAL-BAL014-E2E");
    // Sin certificado no se registra (AC-44).
    await dialog.getByLabel("Contraseña").fill(DEV_PASSWORD);
    await dialog.getByRole("button", { name: "Firmar y registrar" }).click();
    await expect(dialog.getByRole("alert")).toContainText("certificado");

    await dialog.getByLabel(/Certificado/).setInputFiles({
      name: "CAL-BAL014-E2E.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
    await dialog.getByLabel("Contraseña").fill(DEV_PASSWORD);
    await dialog.getByRole("button", { name: "Firmar y registrar" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    await expect(h.page.getByTestId("card-calibracion")).toContainText("Vigente");
    await expect(h.page.getByTestId("reasons")).not.toContainText("calibración");
    const ev = h.page.locator('[data-testid="events"] li[data-type="calibracion"]').first();
    await expect(ev).toContainText("CAL-BAL014-E2E.pdf");
    await expect(ev).toContainText("SHA-256");
    await expect(ev).toContainText("Hernán Salgado");
    await h.close();
  });
});
