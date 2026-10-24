import { expect, test, type Browser, type Page } from "@playwright/test";
import { DEV_PASSWORD, hasSeedUsers, loginOk, USERS } from "./helpers";

// E4 · Documentos maestros (PRD F3): brief → prototipos → estabilidad preliminar con usuarios distintos
// (RF-10, RF-14, RF-15, RF-16; AC-13, AC-16, AC-17, AC-18) y vistas de la semilla del Prompt 0B (RF-11, RF-17).
// Requiere la semilla completa (productos, materias primas y el protocolo CC-PC-001 vigente): corre en la CI.
// Requisitos: RF-10, RF-11, RF-14, RF-15, RF-16, RF-17, AC-13, AC-16, AC-17, AC-18.
const ESTEBAN = "esteban.gaviria@grufarcol.test";
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
    // Diagnóstico: el diálogo sigue abierto con el mensaje de la regla que lo impidió.
    const text = (await dialog.innerText()).replace(/\s+/g, " ").slice(0, 600);
    throw new Error(`El diálogo de firma no se cerró. Diálogo: ${text}`);
  }
}

/** Mensaje de error de la pantalla (excluye el anunciador de rutas de Next.js, que también es role=alert). */
const ruleAlert = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });

async function newPrototype(
  page: Page,
  briefId: string,
  concept: string,
  items: [string, number][],
) {
  await page.goto(`/idi/prototipos/nuevo?brief=${briefId}`);
  await page.locator("#p-product_type").fill("Loción micelar · cosmético");
  await page.locator("#p-concept").fill(concept);
  for (const [i, [material, pct]] of items.entries()) {
    if (i > 0) await page.getByRole("button", { name: "Agregar ingrediente" }).click();
    await page.getByLabel(`Materia prima ${i + 1}`).selectOption({ label: material });
    await page.getByLabel(`Porcentaje ${i + 1}`).fill(String(pct));
  }
  await expect(page.getByTestId("sum")).toContainText("Suma 100,00 %");
  await page.getByRole("button", { name: "Crear prototipo" }).click();
  await expect(page).toHaveURL(/\/idi\/prototipos\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  return page.url().split("/").pop()!;
}

async function fillTemperatureReadings(page: Page, temperature: number) {
  for (const rep of [1, 2, 3]) {
    await page.locator(`#r-${rep}-t`).fill(String(temperature));
    await page.locator(`#r-${rep}-ph`).fill("5.5");
    await page.locator(`#r-${rep}-a`).fill("Líquido translúcido");
    await page.locator(`#r-${rep}-c`).fill("Incoloro");
    await page.locator(`#r-${rep}-o`).fill("Característico");
  }
}

test.describe("E4 · brief, prototipos y estabilidad preliminar", () => {
  test.skip(!hasSeedUsers || !hasSeedDocs, "Requiere la semilla completa del Prompt 0B");

  test("RF-10 · RF-15 · RF-16 · brief aprobado → 2 prototipos → estabilidad con lecturas y bloqueos", async ({
    browser,
  }, info) => {
    test.skip(info.project.name !== "escritorio", "Crea datos: se ejecuta en un solo proyecto");
    test.setTimeout(300_000);
    const project = `Loción micelar E2E ${Date.now()}`;

    // 1. Camila (Comercial) elabora el brief, lo guarda y lo envía a I+D con su firma (RF-10).
    const c = await as(browser, USERS.camila);
    await c.page.goto("/idi/briefs/nuevo");
    await c.page.locator("#b-execution_date").fill("2026-10-24");
    await c.page.locator("#b-project_name").fill(project);
    await c.page
      .locator("#b-product")
      .selectOption({ label: "PRD-001 · Loción micelar ClariPlus" });
    await c.page.getByLabel("Cosmético", { exact: true }).check();
    await c.page.getByRole("radio", { name: "Nuevo en el portafolio" }).click();
    await c.page.locator("#b-justification").fill("Ampliar la línea de higiene facial");
    await c.page.getByLabel("manufacturer 1").fill("Lumia");
    await c.page.getByLabel("product_name 1").fill("Agua micelar sensible");
    await c.page.getByLabel("Precio 1").fill("32500");
    await c.page.getByLabel("Contenido 1").fill("400");
    await expect(c.page.getByTestId("competitors")).toContainText("$81,25");
    await c.page.getByLabel("Cadenas", { exact: true }).check();
    await c.page.locator("#b-margin_pct").fill("45");
    await c.page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(c.page).toHaveURL(/\/idi\/briefs\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    const briefId = c.page.url().split("/").pop()!;
    const heading = await c.page.getByRole("heading", { level: 1 }).innerText();
    const briefCode = heading.match(/BR-\d{4}-\d{4}/)?.[0];
    expect(briefCode, "el brief recibe código BR-AAAA-NNNN").toBeTruthy();
    await sign(c.page, "Enviar a I+D", "Firmar y enviar");
    await expect(c.page.getByText("Enviado a I+D").first()).toBeVisible();
    await expect(c.page.getByRole("button", { name: "Aprobar brief" })).toHaveCount(0);
    await c.close();

    // 2. El Dr. Gaviria lo encuentra en la bandeja (S-10) y lo aprueba con firma.
    const e = await as(browser, ESTEBAN);
    await e.page.goto("/aprobaciones");
    await e.page.getByRole("link", { name: briefCode! }).click();
    await expect(e.page).toHaveURL(new RegExp(`/idi/briefs/${briefId}$`));
    await sign(e.page, "Aprobar brief", "Firmar aprobación");
    await expect(e.page.getByText("Aprobado").first()).toBeVisible();

    // 3. Sebastián (I+D) crea el primer prototipo; con uno solo no se inicia la estabilidad (AC-13).
    const s = await as(browser, USERS.sebastian);
    await s.page.goto(`/idi/prototipos?brief=${briefId}`);
    await expect(s.page.getByRole("note")).toContainText("Se requieren al menos 2 prototipos");
    const p1 = await newPrototype(s.page, briefId, "Con extracto de manzanilla", [
      ["MP-001 · Agua purificada", 96.7],
      ["MP-014 · Glicerina", 3],
      ["MP-040 · Extracto de manzanilla", 0.3],
    ]);
    await expect(s.page.getByRole("heading", { level: 1 })).toContainText(/P-\d{4}/);
    await s.page.getByRole("button", { name: "Iniciar estudio de estabilidad" }).click();
    await expect(ruleAlert(s.page, "al menos 2 prototipos")).toBeVisible();

    // 4. Con el segundo prototipo ya se inicia el estudio y se genera el cronograma (AC-18).
    await newPrototype(s.page, briefId, "Sin extracto", [
      ["MP-001 · Agua purificada", 97],
      ["MP-014 · Glicerina", 3],
    ]);
    await s.page.goto(`/idi/prototipos/${p1}`);
    await s.page.getByRole("button", { name: "Iniciar estudio de estabilidad" }).click();
    const stability = s.page.getByTestId("stability");
    await expect(stability).toBeVisible({ timeout: 15_000 });
    await expect(s.page.getByText("En estabilidad").first()).toBeVisible();
    await s.close();

    // 5. Natalia (laboratorio) registra el tiempo 0 h del calentamiento y el formulario pasa al de 12 h.
    const n = await as(browser, USERS.natalia);
    await n.page.goto(`/idi/prototipos/${p1}`);
    await fillTemperatureReadings(n.page, 45.1);
    await n.page.getByRole("button", { name: "Registrar lectura de 0 h" }).click();
    await expect(n.page.getByRole("button", { name: "Registrar lectura de 12 h" })).toBeVisible({
      timeout: 15_000,
    });

    // AC-17: la viscosidad con una muestra de 200 mL se rechaza y no queda ninguna repetición registrada.
    await n.page
      .getByRole("navigation", { name: "Pruebas" })
      .getByRole("button", { name: "Viscosidad" })
      .click();
    await n.page.locator("#r-vol").fill("200");
    for (const rep of [1, 2, 3]) await n.page.locator(`#r-${rep}-v`).fill("11.8");
    await n.page.getByRole("button", { name: "Registrar lectura de 0 h" }).click();
    await expect(ruleAlert(n.page, "al menos 250 mL")).toBeVisible();
    await expect(n.page.getByRole("button", { name: "Registrar lectura de 0 h" })).toBeVisible();
    await n.page.locator("#r-vol").fill("300");
    await n.page.getByRole("button", { name: "Registrar lectura de 0 h" }).click();
    await expect(n.page.getByRole("button", { name: "Registrar lectura de 30 d" })).toBeVisible({
      timeout: 15_000,
    });
    await n.close();

    // 6. AC-16: Ricardo (Control de calidad) no puede cerrar como «Cumple» con lecturas pendientes.
    const r = await as(browser, USERS.ricardo);
    await r.page.goto(`/idi/prototipos/${p1}`);
    await expect(r.page.getByText("«Cumple» deshabilitado: faltan")).toBeVisible();
    await r.page.getByRole("button", { name: "Cerrar estudio" }).click();
    const dialog = r.page.getByRole("dialog");
    await expect(dialog.getByLabel("Cumple", { exact: true })).toBeDisabled();
    await expect(dialog).toContainText("solo se admite el cierre anticipado «No cumple»");
    await r.page.keyboard.press("Escape");
    await r.close();

    // 7. AC-13: Dirección técnica no puede aprobar como fórmula sin estudio conforme.
    await e.page.goto(`/idi/prototipos/${p1}`);
    const approval = e.page.getByTestId("approval-block");
    await expect(approval).toContainText(
      "El estudio de estabilidad debe estar cerrado como «Cumple»",
    );
    await expect(approval.getByRole("button", { name: "Aprobar como fórmula" })).toBeDisabled();
    await e.close();
  });
});

test.describe("E4 · semilla de documentos maestros (Prompt 0B)", () => {
  test.skip(!hasSeedUsers || !hasSeedDocs, "Requiere la semilla completa del Prompt 0B");

  test("RF-10 · RF-15 · RF-16 · el brief, los prototipos y la estabilidad de la semilla", async ({
    page,
  }) => {
    await loginOk(page, USERS.sebastian);
    await page.goto("/idi/briefs");
    await expect(page.getByText("BR-2026-0011")).toBeVisible();
    await page.goto("/idi/prototipos?brief=e4000000-0000-4000-8000-000000000101");
    const table = page.getByTestId("prototypes");
    await expect(table.locator('tr[data-code="P-0007"]')).toContainText("Reformular");
    await expect(table.locator('tr[data-code="P-0008"]')).toContainText("Descartado");
    await expect(table.locator('tr[data-code="P-0007-1"]')).toContainText("Aprobado como fórmula");
    await page.goto("/idi/prototipos/e4000000-0000-4000-8000-000000000203");
    await expect(page.getByTestId("stability")).toContainText("Cumple");
  });

  test("RF-11 · la fórmula maestra de la semilla suma 100 %", async ({ page }) => {
    await loginOk(page, USERS.sebastian);
    await page.goto("/idi/formulas/e4000000-0000-4000-8000-000000000302");
    await expect(page.getByTestId("sum")).toContainText("Suma 100,00 %");
  });

  test("RF-17 · los costos son visibles para I+D y confidenciales para Producción", async ({
    browser,
  }) => {
    const s = await as(browser, USERS.sebastian);
    await s.page.goto("/idi/costos");
    await expect(s.page.getByRole("heading", { level: 1, name: "Costos" })).toBeVisible();
    await expect(s.page.getByText("PRD-001").first()).toBeVisible();
    await s.close();
    const d = await as(browser, USERS.diego);
    await d.page.goto("/idi/costos");
    await expect(
      d.page.getByText(/No tiene acceso a I\+D|Los costos son confidenciales/),
    ).toBeVisible();
    await d.close();
  });

  test("RF-14 · la bandeja de aprobación es de quien firma", async ({ browser }) => {
    const e = await as(browser, ESTEBAN);
    await e.page.goto("/aprobaciones");
    await expect(e.page.getByRole("heading", { level: 1, name: "Aprobaciones" })).toBeVisible();
    await e.close();
    const d = await as(browser, USERS.diego);
    await d.page.goto("/aprobaciones");
    await expect(d.page.getByText("No tiene bandeja de aprobación")).toBeVisible();
    await d.close();
  });
});
