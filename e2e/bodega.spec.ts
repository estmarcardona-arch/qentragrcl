import { expect, test, type Browser, type Page } from "@playwright/test";
import { DEV_PASSWORD, hasSeedUsers, loginOk, USERS } from "./helpers";

// E5 · Bodega y calidad de insumos (PRD F4): recepción en cuarentena → liberación por Control de calidad →
// traslado a una bodega externa con dos firmas y recepción (RF-20…RF-25; AC-21, AC-24), y la semilla del
// Prompt 0B (8 bodegas con estructura, 276 ubicaciones, kardex de glicerina y TR-2026-0007).
// Requiere la semilla completa: corre en la CI.
// Requisitos: RF-20, RF-21, RF-22, RF-23, RF-24, RF-25, AC-21, AC-24, AC-27.
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

async function sign(page: Page, button: RegExp | string, confirm: RegExp | string) {
  await page.getByRole("button", { name: button }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator("#reauth-password").fill(DEV_PASSWORD);
  await dialog.getByRole("button", { name: confirm }).click();
  try {
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  } catch {
    const text = (await dialog.innerText()).replace(/\s+/g, " ").slice(0, 600);
    throw new Error(`El diálogo de firma no se cerró. Diálogo: ${text}`);
  }
}

/** Mensaje de regla (excluye el anunciador de rutas de Next.js, que también es role=alert). */
const ruleAlert = (page: Page, text: string | RegExp) =>
  page.getByRole("alert").filter({ hasText: text });

test.describe("E5 · semilla de bodegas del Prompt 0B", () => {
  test.skip(!hasSeedUsers || !hasSeedDocs, "Requiere la semilla completa del Prompt 0B");

  test("RF-23 · AC-27 · las bodegas y ubicaciones del 0B cuadran con la pantalla", async ({
    page,
  }) => {
    await loginOk(page, USERS.hernan);
    await page.goto("/bodega/estructura");
    const cards = page.getByTestId("warehouses");
    await expect(cards.locator("li")).toHaveCount(9);
    await expect(page.getByText("· 276 ubicaciones")).toBeVisible();
    const mp = cards.locator('li[data-code="BOD-MP"]');
    await expect(mp.getByTestId("structure")).toHaveText("6 × 4 × 2 = 48 ubicaciones");
    await expect(mp).toContainText("Zona de cuarentena: estante E01");
    await expect(cards.locator('li[data-code="BOD-PT"]').getByTestId("structure")).toHaveText(
      "8 × 4 × 3 = 96 ubicaciones",
    );
    const ext = cards.locator('li[data-code="BOD-EXT-01"]');
    await expect(ext).toContainText("Externa · Maquilas del Norte S.A.S.");
    await expect(ext).toContainText("Calificado hasta 31/03/2027");
    await expect(ext.getByTestId("structure")).toHaveText("2 × 3 × 4 = 24 ubicaciones");
    await expect(cards.locator('li[data-code="BOD-EXT-02"]')).toContainText(
      "Calificación vencida el 30/09/2026",
    );
    await expect(cards.locator('li[data-code="BOD-RE"]')).toContainText("Bajo llave");

    // Mapa de BOD-MP: el fenoxietanol en cuarentena ocupa MP-E01-P1-02.
    await page.goto("/bodega/estructura/BOD-MP");
    const map = page.getByTestId("location-map");
    await expect(map.locator("button[data-code]")).toHaveCount(48);
    await map.locator('button[data-code="MP-E01-P1-02"]').click();
    await expect(page.getByTestId("location-detail")).toContainText("MP-2026-0198");
    await expect(page.getByTestId("location-detail")).toContainText("Cuarentena");
  });

  test("RF-21 · el kardex de glicerina coincide con el 0B (40,00 y 120,00 kg)", async ({
    page,
  }) => {
    await loginOk(page, USERS.hernan);
    await page.goto("/bodega/inventario");
    const inv = page.getByTestId("inventory");
    await expect(inv.locator('tr[data-code="MP-2026-0187"]')).toContainText("40,00 kg");
    await expect(inv.locator('tr[data-code="MP-2026-0187"]')).toContainText("Agotado");
    await expect(inv.locator('tr[data-code="MP-2026-0204"]')).toContainText("120,00 kg");
    await expect(inv.locator('tr[data-code="MP-2026-0204"]')).toContainText("100,00 kg");
    await expect(inv.locator('tr[data-code="MP-2026-0198"]')).toContainText("Cuarentena");
    await expect(inv.locator('tr[data-code="MP-2026-0192"]')).toContainText("Rechazado");
    await expect(inv.locator('tr[data-code="MP-2026-0171"]')).toContainText("Vencido");
    // Localizador «¿Dónde está este lote?».
    await page.getByPlaceholder(/Material, código interno/).fill("GLI-2511-B");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(inv.locator("tbody tr")).toHaveCount(1);
    await expect(inv).toContainText("MP-E03-P2-02");
    await inv.getByRole("link", { name: "MP-2026-0204" }).click();
    await expect(page.getByTestId("balance")).toHaveText("100,00 kg");
    await expect(page.getByTestId("kardex-calc")).toContainText("120,00 − 20,00 = 100,00 kg");
  });

  test("RF-25 · TR-2026-0007 está en tránsito con las firmas de despacho", async ({ page }) => {
    await loginOk(page, USERS.hernan);
    await page.goto("/bodega/traslados?externos=1");
    await page.getByTestId("transfers").getByRole("link", { name: "TR-2026-0007" }).click();
    await expect(page.getByText("Despachado · En tránsito").first()).toBeVisible();
    const timeline = page.getByTestId("timeline");
    await expect(timeline).toContainText("Despachó: Marta Quintero");
    await expect(timeline).toContainText("Aprobó: Hernán Salgado");
    await expect(page.getByTestId("transfer-lines")).toContainText("ENV-2510-A");
    await expect(page.getByTestId("transfer-lines")).toContainText("1.500 und");
  });
});

test.describe("E5 · recepción → liberación → traslado a bodega externa", () => {
  test.skip(!hasSeedUsers || !hasSeedDocs, "Requiere la semilla completa del Prompt 0B");

  test("RF-20 · RF-22 · RF-24 · RF-25 · AC-21 · AC-24 · ciclo completo con cuatro personas", async ({
    browser,
  }, info) => {
    test.skip(info.project.name !== "escritorio", "Crea datos: se ejecuta en un solo proyecto");
    test.setTimeout(300_000);
    const supplierLot = `ENV-E2E-${Date.now()}`;

    // 1. Marta recibe envases PET en cuarentena; un envase no va a producto terminado (AC-21).
    const m = await as(browser, USERS.marta);
    await m.page.goto("/bodega/recepcion");
    await m.page.locator("#r-material").selectOption({ label: "Envase PET 400 mL · EN-PET-400" });
    await m.page.locator("#r-supplier").selectOption({ label: "Química Andina S.A.S." });
    await m.page.locator("#r-lot").fill(supplierLot);
    await m.page.locator("#r-qty").fill("500");
    await expect(
      m.page.getByRole("radiogroup", { name: "Ubicaciones sugeridas" }).getByRole("radio").first(),
    ).toBeVisible({ timeout: 15_000 });
    await m.page.getByRole("button", { name: "Recibir y generar rótulo" }).click();
    await expect(
      m.page.getByRole("alert").filter({ hasText: "Falta fecha de vencimiento" }),
    ).toBeVisible();
    await m.page.locator("#r-expiry").fill("2031-12-31");
    const pt = await m.page
      .getByRole("group", { name: "Ubicación *" })
      .locator("select option", { hasText: "BOD-PT · PT-E01-P1-01" })
      .getAttribute("value");
    await m.page.getByRole("group", { name: "Ubicación *" }).locator("select").selectOption(pt!);
    await m.page.getByRole("button", { name: "Recibir y generar rótulo" }).click();
    await expect(ruleAlert(m.page, "no admite este tipo de material")).toBeVisible();
    await m.page
      .getByRole("radiogroup", { name: "Ubicaciones sugeridas" })
      .getByRole("radio")
      .first()
      .click();
    await m.page.getByRole("button", { name: "Recibir y generar rótulo" }).click();
    await expect(m.page).toHaveURL(/\/bodega\/rotulos\/[0-9a-f-]{36}\?nuevo=1$/, {
      timeout: 15_000,
    });
    await expect(m.page.getByTestId("label-status")).toContainText("CUARENTENA");
    await expect(m.page.getByTestId("label-location")).toContainText(/ME-E\d{2}-P\d-\d{2}/);
    const lotCode = (await m.page.getByRole("heading", { level: 1 }).innerText()).match(
      /ME-\d{4}-\d{4}/,
    )?.[0];
    expect(lotCode, "el lote recibe el código ME-AAAA-NNNN").toBeTruthy();

    // 2. Natalia (laboratorio) registra el resultado del CoA.
    const n = await as(browser, USERS.natalia);
    await n.page.goto("/calidad/insumos");
    const card = n.page.locator(`article[data-code="${lotCode}"]`);
    await card
      .getByLabel("Resultado de Certificado de análisis del proveedor")
      .fill("CoA revisado: conforme");
    await card
      .getByLabel("Conformidad de Certificado de análisis del proveedor")
      .selectOption("si");
    await card.getByRole("button", { name: /Registrar 1 resultado/ }).click();
    await expect(card.getByTestId("lot-tests")).toContainText("Conforme");
    await n.close();

    // 3. Ricardo (Control de calidad) libera el lote con firma.
    const r = await as(browser, USERS.ricardo);
    await r.page.goto("/calidad/insumos");
    const rc = r.page.locator(`article[data-code="${lotCode}"]`);
    await rc.getByRole("button", { name: "Aprobar y firmar" }).click();
    const dialog = r.page.getByRole("dialog");
    await dialog.locator("#reauth-password").fill(DEV_PASSWORD);
    await dialog.getByRole("button", { name: "Firmar liberación" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(r.page.locator(`article[data-code="${lotCode}"]`)).toHaveCount(0);
    await r.close();

    // 4. Marta prepara el envío: el destino con calificación vencida se bloquea (AC-24).
    await m.page.goto("/bodega/traslados/nuevo");
    const from = await m.page
      .locator("#t-from option", { hasText: "BOD-ME" })
      .getAttribute("value");
    await m.page.locator("#t-from").selectOption(from!);
    const ext2 = await m.page
      .locator("#t-to option", { hasText: "BOD-EXT-02" })
      .getAttribute("value");
    await m.page.locator("#t-to").selectOption(ext2!);
    await expect(ruleAlert(m.page, "Destino sin calificación vigente")).toBeVisible();
    const ext1 = await m.page
      .locator("#t-to option", { hasText: "BOD-EXT-01" })
      .getAttribute("value");
    await m.page.locator("#t-to").selectOption(ext1!);
    await expect(m.page.getByTestId("destination")).toContainText("Calificado hasta 31/03/2027");
    const lotOpt = await m.page
      .getByLabel("Lote a agregar")
      .locator("option", { hasText: lotCode! })
      .getAttribute("value");
    await m.page.getByLabel("Lote a agregar").selectOption(lotOpt!);
    await m.page.getByLabel(`Cantidad de ${lotCode}`).fill("200");
    await m.page.locator("#t-reason").fill("Envío a maquila para llenado");
    await m.page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(m.page).toHaveURL(/\/bodega\/traslados\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    const transferUrl = m.page.url();
    await sign(m.page, "Firmar despacho", "Firmar despacho");
    await expect(m.page.getByTestId("timeline")).toContainText("Despachó: Marta Quintero");
    await m.close();

    // 5. Hernán aprueba el despacho y firma la recepción con el acta del maquilador.
    const h = await as(browser, USERS.hernan);
    await h.page.goto(transferUrl);
    await sign(h.page, "Aprobar despacho", "Firmar aprobación");
    await expect(h.page.getByText("Despachado · En tránsito").first()).toBeVisible();
    await h.page.getByRole("button", { name: "Firmar recepción" }).click();
    const rd = h.page.getByRole("dialog");
    await rd.locator("select").first().selectOption({ index: 1 });
    await rd.getByPlaceholder("Referencia del acta (PDF)").fill("Acta AR-E2E");
    await rd.locator("#reauth-password").fill(DEV_PASSWORD);
    await rd.getByRole("button", { name: "Firmar recepción" }).click();
    await expect(rd).toBeHidden({ timeout: 15_000 });
    await expect(h.page.getByText("Recibido").first()).toBeVisible();
    await expect(h.page.getByTestId("transfer-lines")).toContainText(/EXT-01-E\d{2}-P\d-\d{2}/);
    await h.close();
  });
});
