import { expect, test, type Browser, type Page } from "@playwright/test";
import { hasSeedUsers, loginOk, USERS } from "./helpers";

// E5B · Maestro de materiales y productos (PRD 1.9, RF-26) y recepción técnica con orden de compra, unidades de
// empaque y rótulo PDF descargable (RF-20 v1.9; AC-42, AC-43). Requiere terceros y bodegas (semilla de la CI o
// catálogos de la nube).
// Requisitos: RF-20, RF-26, AC-42, AC-43.
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

test.describe("E5B · maestro de materiales y recepción técnica", () => {
  test.skip(!hasSeedUsers || !hasSeedDocs, "Requiere la semilla (terceros y bodegas)");

  test("RF-26 · AC-43 · el jefe de bodega crea el ítem y la recepción de 2 cajas × 100 queda en cuarentena con rótulo PDF", async ({
    browser,
  }, info) => {
    test.skip(info.project.name !== "escritorio", "Crea datos: se ejecuta en un solo proyecto");
    test.setTimeout(180_000);
    const code = `EM-T${String(Date.now()).slice(-8)}`;

    // 1. Hernán crea el empaque en el maestro con unidad, almacenamiento y empaque de compra.
    const h = await as(browser, USERS.hernan);
    await h.page.goto("/bodega/maestros?tipo=empaque");
    await h.page.getByRole("link", { name: "Nuevo ítem" }).click();
    await h.page.locator("#it-code").fill(code);
    await h.page.locator("#it-name").fill("Plegadiza de prueba E2E");
    await h.page.locator("#it-unit").selectOption("und");
    await h.page.locator("#it-storage").fill("Lugar seco, 15–25 °C");
    await h.page.locator("#it-pkg").fill("Caja");
    await h.page.getByLabel("Contenido por empaque").fill("100");
    await h.page.getByRole("button", { name: "Crear ítem" }).click();
    await expect(h.page).toHaveURL(/\/bodega\/maestros\/[0-9a-f-]{36}\?nuevo=1$/, {
      timeout: 15_000,
    });
    const itemUrl = h.page.url().replace("?nuevo=1", "");
    await expect(h.page.getByRole("heading", { level: 1 })).toContainText(code);
    // Un código repetido se rechaza (RF-26).
    await h.page.goto("/bodega/maestros/nuevo?tipo=empaque");
    await h.page.locator("#it-code").fill(code);
    await h.page.locator("#it-name").fill("Duplicado");
    await h.page.locator("#it-unit").selectOption("und");
    await h.page.getByRole("button", { name: "Crear ítem" }).click();
    await expect(h.page.getByRole("alert").filter({ hasText: "ya existe" })).toBeVisible();
    await h.close();

    // 2. Marta lo recibe: 2 cajas × 100 = 200 und, con orden de compra; la cantidad se calcula sola.
    const m = await as(browser, USERS.marta);
    await m.page.goto("/bodega/inventario");
    await m.page.getByRole("link", { name: "Ingreso a bodega (recepción técnica)" }).click();
    await m.page
      .locator("#r-material")
      .selectOption({ label: `Plegadiza de prueba E2E · ${code}` });
    await expect(m.page.getByText("Almacenamiento: Lugar seco, 15–25 °C")).toBeVisible();
    await m.page.locator("#r-supplier").selectOption({ label: "Química Andina S.A.S." });
    await m.page.locator("#r-lot").fill(`PLG-${code}`);
    await m.page.locator("#r-expiry").fill("2031-06-30");
    await m.page.locator("#r-po").fill("OC-2026-0457");
    await expect(m.page.locator("#r-pkg-type")).toHaveValue("Caja");
    await expect(m.page.locator("#r-pkg-qty")).toHaveValue("100");
    await m.page.locator("#r-pkg-count").fill("2");
    await expect(m.page.getByTestId("package-total")).toHaveText("= 200 und");
    await expect(m.page.locator("#r-qty")).toHaveValue("200");
    await expect(
      m.page.getByRole("radiogroup", { name: "Ubicaciones sugeridas" }).getByRole("radio").first(),
    ).toBeVisible({ timeout: 15_000 });
    await m.page.getByRole("button", { name: "Recibir y generar rótulo" }).click();
    await expect(m.page).toHaveURL(/\/bodega\/rotulos\/[0-9a-f-]{36}\?nuevo=1$/, {
      timeout: 15_000,
    });
    const label = m.page.getByTestId("label");
    await expect(m.page.getByTestId("label-status")).toContainText("CUARENTENA");
    await expect(label).toContainText("2 Caja × 100 und");
    await expect(label).toContainText("OC-2026-0457");
    await expect(m.page.getByTestId("label-storage")).toContainText("Lugar seco, 15–25 °C");

    // 3. El rótulo se descarga en PDF.
    const lotId = new URL(m.page.url()).pathname.split("/").pop()!;
    const pdf = await m.page.request.get(`/bodega/rotulos/${lotId}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await m.close();

    // 4. «Dónde se usa»: el ítem muestra su lote en bodega; ya no cambia de código (trazabilidad).
    const h2 = await as(browser, USERS.hernan);
    await h2.page.goto(itemUrl);
    await expect(h2.page.getByTestId("where-used")).toContainText(`PLG-${code}`);
    await expect(h2.page.locator("#it-code")).toBeDisabled();
    await h2.close();
  });
});
