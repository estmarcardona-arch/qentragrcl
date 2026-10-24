import { expect, test, type Browser, type Page } from "@playwright/test";
import { DEV_PASSWORD, hasSeedUsers, loginOk, USERS } from "./helpers";

// E3 · Sistema de gestión documental (PRD 2.5): ciclo completo de un documento con usuarios distintos
// (RF-93…RF-99; AC-23, AC-31, AC-32, AC-33) y listado maestro de la semilla del Prompt 0B (RF-92).
// Requisitos: RF-05, RF-92, RF-93, RF-94, RF-95, RF-96, RF-97, RF-98, RF-99, RF-100, RF-103.
const HERNAN = "hernan.salgado@grufarcol.test";
const VALENTINA = "valentina.cruz@grufarcol.test";
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

async function sign(
  page: Page,
  button: RegExp | string,
  confirm: RegExp | string,
  reason?: string,
) {
  await page.getByRole("button", { name: button }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  if (reason) await dialog.locator("#reauth-reason").fill(reason);
  await dialog.locator("#reauth-password").fill(DEV_PASSWORD);
  await dialog.getByRole("button", { name: confirm }).click();
  await expect(dialog).toBeHidden();
}

async function reasonDialog(page: Page, reason: string, confirm: string | RegExp) {
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("#admin-reason")).toBeVisible();
  await dialog.locator("#admin-reason").fill(reason);
  await dialog.getByRole("button", { name: confirm }).click();
}

const GOOD = {
  Objetivo: "Establecer el método de prueba de ubicación de materiales.",
  Alcance: "Aplica a la bodega de materias primas.",
  Responsables: "Jefe de bodega.",
  "Desarrollo del documento":
    "1. Verificar el rótulo del material.\n2. Registrar la ubicación asignada.",
  "Documentos relacionados y anexos": "N.A.",
  "Control de cambios": "Creación del documento.",
};

async function fillDraft(page: Page, desarrollo?: string) {
  for (const [label, value] of Object.entries(GOOD)) {
    const field = page.getByLabel(label, { exact: true });
    if (await field.count())
      await field.fill(label.startsWith("Desarrollo") && desarrollo ? desarrollo : value);
  }
}

test.describe("E3 · ciclo completo de un documento controlado", () => {
  test.skip(!hasSeedUsers, "Requiere los usuarios de la semilla");

  test("RF-93…99 · solicitud → estandarización → código → revisión → aprobación → vigente → capacitación → anulación", async ({
    browser,
  }, info) => {
    test.skip(info.project.name !== "escritorio", "Crea datos: se ejecuta en un solo proyecto");
    test.setTimeout(300_000);
    const title = `Procedimiento de prueba E2E ${Date.now()}`;

    // 1. Hernán Salgado solicita crear el documento y redacta el preliminar (con «generalmente»).
    const h = await as(browser, HERNAN);
    await h.page.goto("/documentos/nuevo");
    const mto = await h.page
      .locator("#req-process option", { hasText: "(MTO)" })
      .getAttribute("value");
    await h.page.locator("#req-process").selectOption(mto!);
    const pr = await h.page.locator("#req-type option", { hasText: "(PR)" }).getAttribute("value");
    await h.page.locator("#req-type").selectOption(pr!);
    await h.page.locator("#req-title").fill(title);
    await h.page.locator("#req-reason").fill("Prueba E2E del ciclo documental");
    await h.page.getByRole("checkbox", { name: /Mantenimiento/ }).check();
    await h.page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(h.page).toHaveURL(/\/documentos\/versiones\//);
    const draftUrl = h.page.url().split("?")[0];
    await fillDraft(h.page, "Se verifica generalmente el rótulo del material.");
    await h.page.getByRole("button", { name: "Enviar a estandarización" }).click();
    await expect(
      h.page.getByText("En estandarización por Aseguramiento de la calidad"),
    ).toBeVisible({ timeout: 15_000 });

    // 2. AC-33: Valentina Cruz estandariza; el revisor marca «generalmente» y devuelve al solicitante.
    const v = await as(browser, VALENTINA);
    await v.page.goto("/documentos/estandarizacion");
    await v.page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(v.page.getByTestId("observations")).toContainText("generalmente");
    await v.page.getByRole("button", { name: "Devolver al solicitante con observaciones" }).click();
    await expect(
      v.page.getByRole("alert").filter({ hasText: "no cumple la estandarización" }),
    ).toBeVisible();

    // 3. Hernán corrige y reenvía.
    await h.page.goto(draftUrl);
    await expect(
      h.page.getByRole("note").filter({ hasText: "Devuelto por Aseguramiento de la calidad" }),
    ).toBeVisible();
    await fillDraft(h.page);
    await h.page.getByRole("button", { name: "Enviar a estandarización" }).click();
    await expect(
      h.page.getByText("En estandarización por Aseguramiento de la calidad"),
    ).toBeVisible({ timeout: 15_000 });

    // 4. Valentina registra la estandarización y asigna el código (solo ella).
    await v.page.goto("/documentos/estandarizacion");
    await v.page.getByRole("link", { name: new RegExp(title) }).click();
    await v.page.getByRole("button", { name: "Registrar estandarización (cumple)" }).click();
    await v.page.getByRole("button", { name: "Crear documento (versión 01)" }).click();
    const coded = v.page
      .getByRole("status")
      .filter({ hasText: /codificado y en el listado maestro/ });
    await expect(coded).toBeVisible();
    const code = (await coded.locator("b").innerText()).trim();
    expect(code).toMatch(/^MTO-PR-\d{3}$/);
    const docUrl = (await coded.getByRole("link").getAttribute("href"))!;
    expect(docUrl).toMatch(/^\/documentos\/[0-9a-f-]{36}$/);

    // 5. El autor envía a revisión con su contraseña («Actualizado por»).
    await h.page.goto(docUrl);
    await sign(h.page, "Enviar a revisión", "Firmar y enviar");
    await h.page.reload();
    // AC-23: el autor (jefe de su propia área) no puede revisar su versión.
    await expect(h.page.getByText("No puede revisar ni aprobar esta versión")).toBeVisible();
    await expect(h.page.getByRole("button", { name: "Revisar" })).toHaveCount(0);

    // 6. Lucía Barrera revisa; 7. el Dr. Esteban Gaviria aprueba.
    const l = await as(browser, USERS.lucia);
    await l.page.goto(docUrl);
    await sign(l.page, "Revisar", "Firmar revisión");
    const e = await as(browser, ESTEBAN);
    await e.page.goto(docUrl);
    await sign(e.page, "Aprobar", "Firmar aprobación");
    await e.page.reload();
    await expect(e.page.getByTestId("signature-box")).toContainText("Dr. Esteban Gaviria");

    // 8. Valentina publica y emite la copia controlada a Mantenimiento.
    await v.page.goto(docUrl);
    await v.page.getByRole("button", { name: "Publicar como vigente y emitir copias" }).click();
    const pub = v.page.getByRole("dialog");
    await pub.getByRole("checkbox", { name: /Mantenimiento/ }).check();
    await pub.getByRole("button", { name: "Publicar y emitir copias" }).click();
    await expect(pub).toBeHidden();
    await v.page.reload();
    await expect(v.page.getByText("v01 · Vigente")).toBeVisible();
    await expect(v.page.getByTestId("signature-box")).toContainText("Lucía Barrera");
    const pdf = await v.page.request.get(`${docUrl}/pdf?v=1`);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect(pdf.headers()["content-disposition"]).toContain("controlada");

    // 9. Capacitación (AC-31): Valentina la asigna a Hernán; con 0 % no aprueba, luego aprueba y obtiene constancia.
    await v.page.goto("/documentos/capacitacion?vista=seguimiento");
    const ver = await v.page.locator("#tr-version option", { hasText: code }).getAttribute("value");
    await v.page.locator("#tr-version").selectOption(ver!);
    await v.page.locator("#tr-due").fill("2026-12-31");
    await v.page.getByRole("checkbox", { name: "Hernán Salgado" }).check();
    await v.page
      .getByRole("textbox", { name: "Pregunta 1", exact: true })
      .fill("¿Qué se registra al ubicar un material?");
    await v.page.getByLabel("Opción 1 de la pregunta 1").fill("La ubicación asignada");
    await v.page.getByLabel("Opción 2 de la pregunta 1").fill("El color del estante");
    await v.page.getByRole("button", { name: "Asignar" }).click();
    await expect(
      v.page.getByRole("status").filter({ hasText: "Capacitación asignada" }),
    ).toBeVisible();

    await h.page.goto("/documentos/capacitacion");
    await h.page.getByRole("link", { name: new RegExp(code) }).click();
    await expect(
      h.page.getByRole("heading", { name: new RegExp(`Cuestionario · ${code}`) }),
    ).toBeVisible();
    await h.page.getByRole("radio", { name: "El color del estante" }).check();
    await h.page.getByRole("button", { name: "Enviar respuestas" }).click();
    await expect(
      h.page.getByRole("status").filter({ hasText: "No aprobó. Puede intentarlo de nuevo." }),
    ).toBeVisible();
    await h.page.getByRole("radio", { name: "La ubicación asignada" }).check();
    await h.page.getByRole("button", { name: "Presentar de nuevo" }).click();
    await expect(h.page.getByRole("status").filter({ hasText: "Aprobó" })).toBeVisible();
    await h.page.reload();
    await expect(h.page.getByRole("link", { name: "Descargar constancia" })).toBeVisible();

    // 10. Anulación (AC-32): Hernán (jefe de área) la solicita, Lucía la aprueba, Valentina recoge la copia y cierra. (Proceso MTO: no choca con los códigos de la semilla.)
    await h.page.goto(`/documentos/nuevo?tipo=anulacion&documento=${docUrl.split("/").pop()}`);
    await h.page.locator("#req-reason").fill("Prueba E2E: el procedimiento se reemplaza");
    await h.page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(h.page).toHaveURL(/\/documentos\/cambios/);

    await l.page.goto("/documentos/cambios");
    await l.page
      .getByRole("row", { name: new RegExp(`Anulación.*${code}`) })
      .getByRole("link")
      .click();
    await l.page.getByRole("button", { name: "Aprobar anulación" }).click();
    const dec = l.page.getByRole("dialog");
    await dec.locator("#reauth-reason").fill("Anulación viable");
    await dec.locator("#reauth-password").fill(DEV_PASSWORD);
    await dec.getByRole("button", { name: "Aprobar anulación" }).click();
    await expect(dec).toBeHidden();

    await v.page.goto(l.page.url());
    await expect(v.page.getByText(/falta recoger la copia de Mantenimiento/)).toBeVisible();
    await v.page.getByRole("button", { name: "Cerrar anulación" }).click();
    await reasonDialog(v.page, "Cierre de prueba", "Cerrar anulación");
    await expect(v.page.getByRole("dialog").getByRole("alert")).toContainText(
      "copias distribuidas sin recoger",
    );
    await v.page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
    await v.page.getByRole("button", { name: /Registrar recolección de Mantenimiento/ }).click();
    await reasonDialog(v.page, "Copia recogida en la bodega", "Registrar recolección");
    await v.page.reload();
    await v.page.getByRole("button", { name: "Cerrar anulación" }).click();
    await reasonDialog(v.page, "Copias recogidas; archivo actualizado", "Cerrar anulación");
    await v.page.reload();
    await expect(v.page.getByText("Cerrada · anulado").first()).toBeVisible();
    const obs = await v.page.request.get(`${docUrl}/pdf?v=1`);
    expect(obs.headers()["content-disposition"]).toContain("obsoleto");

    for (const s of [h, v, l, e]) await s.close();
  });

  test("RF-93 · solo Aseguramiento de la calidad asigna códigos (AC-26, AC-28)", async ({
    page,
  }) => {
    await loginOk(page, HERNAN);
    await page.goto("/documentos/estandarizacion");
    await expect(page.getByText("Solo Aseguramiento de la calidad asigna códigos")).toBeVisible();
  });

  test("RF-92 · el administrador del sistema no tiene acceso al SGD (matriz 2.2)", async ({
    page,
  }) => {
    await loginOk(page, "tomas.herrera@grufarcol.test");
    await page.goto("/documentos");
    await expect(page.getByText("No tiene acceso a los documentos controlados")).toBeVisible();
  });
});

// Listado maestro del Prompt 0B: código · versión · emisión · revisión · trámite · vigencia.
const MASTER_0B: [string, string, string, string, string, string][] = [
  ["GCA-PR-001", "02", "17-04-2025", "17-04-2028", "Vigente", "Vigente"],
  ["GCA-PR-002", "01", "17-04-2025", "17-04-2028", "Vigente", "Vigente"],
  ["GCA-PR-001-FR-01", "01", "17-04-2025", "17-04-2028", "Vigente", "Vigente"],
  ["GCA-PR-001-FR-02", "01", "17-04-2025", "17-04-2028", "Vigente", "Vigente"],
  ["PRD-PR-003-FR-01", "03", "15-05-2023", "15-05-2026", "Vigente", "Revisión vencida"],
  ["PRD-PR-001-FR-01", "04", "20-01-2024", "20-01-2027", "Vigente", "Vigente"],
  ["PRD-PR-004-FR-01", "02", "15-02-2024", "15-02-2027", "Vigente", "Vigente"],
  ["CC-PR-002-FR-01", "02", "15-02-2024", "15-02-2027", "Vigente", "Vigente"],
  ["CC-PC-001", "01", "15-02-2026", "15-02-2029", "Vigente", "Vigente"],
  ["IDI-IN-012", "03", "25-08-2026", "30-09-2030", "Vigente", "Vigente"],
  ["IDI-EP-007", "02", "30-10-2025", "30-10-2026", "Vigente", "Por vencer"],
  ["GLG-PR-004", "01", "—", "—", "En revisión", "Sin dato"],
];

test.describe("RF-92 · listado maestro de la semilla (Prompt 0B)", () => {
  test.skip(!hasSeedDocs, "Requiere los documentos de la semilla (CI)");

  test("RF-92 · el listado maestro de la pantalla coincide con la semilla", async ({ page }) => {
    await loginOk(page, VALENTINA);
    await page.goto("/documentos");
    const table = page.getByTestId("master-list");
    for (const [code, ver, issue, review, tram, validity] of MASTER_0B) {
      const row = table.locator(`tr[data-code="${code}"]`);
      await expect(row, code).toHaveCount(1);
      const cells = (await row.locator("td").allInnerTexts()).map((t) =>
        t.replace(/\s+/g, " ").trim(),
      );
      expect(cells[4], `${code} versión`).toMatch(new RegExp(`^${ver}`));
      expect(cells[5], `${code} emisión`).toBe(issue);
      expect(cells[6], `${code} revisión`).toBe(review);
      expect(cells[7], `${code} trámite`).toBe(tram);
      expect(cells[8], `${code} vigencia`).toBe(validity);
    }
    await expect(table.locator('tr[data-code="EXT-001"]')).toContainText(
      "Norma de buenas prácticas de manufactura aplicable",
    );
    // Indicador «% de documentos vencidos por proceso» (Prompt 0B): PRD 1 de 3 = 33,3 %.
    const ind = page.getByTestId("overdue-indicator");
    await expect(ind.locator('[data-process="PRD"]')).toContainText("33,3 %");
    await expect(ind.locator('[data-process="PRD"]')).toContainText("1 de 3");
    await expect(ind.locator('[data-process="GCA"]')).toContainText("0 de 4");
    await expect(ind.locator('[data-process="CC"]')).toContainText("0 de 2");
    await expect(ind.locator('[data-process="IDI"]')).toContainText("0 de 3"); // 0B + fórmula IDI-FM-001 (E4, D-49)
    await expect(ind.locator('[data-process="GLG"]')).toContainText("0 de 1");
  });

  test("S-44b · Diego ve los vigentes y la capacitación pendiente de PRD-PR-003-FR-01 v03", async ({
    page,
  }) => {
    await loginOk(page, USERS.diego);
    await page.goto("/documentos");
    const row = page.getByTestId("master-list").locator('tr[data-code="PRD-PR-003-FR-01"]');
    await expect(row).toContainText("Pendiente de capacitación");
    await expect(page.getByRole("note")).toContainText("PRD-PR-003-FR-01 v03");
  });

  test("S-46 · cuadro de firmas e historial de PRD-PR-003-FR-01 v03 y aviso de la v04 en preliminar", async ({
    page,
  }) => {
    await loginOk(page, VALENTINA);
    await page.goto("/documentos");
    await page
      .getByTestId("master-list")
      .locator('tr[data-code="PRD-PR-003-FR-01"]')
      .getByRole("link")
      .click();
    const box = page.getByTestId("signature-box");
    await expect(box.locator('[data-meaning="actualizo"]')).toContainText("Valentina Cruz");
    await expect(box.locator('[data-meaning="reviso"]')).toContainText("Lucía Barrera");
    await expect(box.locator('[data-meaning="aprobo"]')).toContainText("Dr. Esteban Gaviria");
    await expect(page.getByRole("note").filter({ hasText: "Existe la versión 04" })).toContainText(
      "SC-2026-0005",
    );
  });

  test("S-47 · seguimiento: 12 de 14 aprobaron y Diego tiene 70 %", async ({ page }) => {
    await loginOk(page, VALENTINA);
    await page.goto("/documentos/capacitacion?vista=seguimiento");
    await page
      .getByRole("navigation", { name: "Capacitaciones" })
      .getByRole("link", { name: /PRD-PR-003-FR-01 v03/ })
      .click();
    await expect(page.getByRole("heading", { name: "12 de 14 aprobaron" })).toBeVisible();
    await expect(
      page.getByTestId("training-follow").locator('tr[data-person="Diego Cárdenas"]'),
    ).toContainText("70 %");
  });

  test("S-48 · AN-2026-0002: no se cierra sin la copia de Administrativo (AC-32)", async ({
    page,
  }) => {
    await loginOk(page, VALENTINA);
    await page.goto("/documentos/cambios?an=AN-2026-0002");
    await expect(page.getByText(/falta recoger la copia de Administrativa/)).toBeVisible();
  });

  test("S-43 · Fabricación v04 en borrador con el paso 5B y AC-20 en la v03 aprobada", async ({
    page,
  }) => {
    await loginOk(page, "gabriela.torres@grufarcol.test");
    await page.goto("/master/plantillas");
    await expect(page.getByTestId("stages").locator('[data-stage="fabricacion"]')).toContainText(
      "Borrador abierto: v04",
    );
    await page.goto("/master/plantillas/fabricacion");
    await expect(page.getByText("Está creando la versión 04 en borrador")).toBeVisible();
    await expect(page.getByTestId("template-steps")).toContainText(
      "Medir temperatura de fase oleosa cada 10 minutos",
    );
    await page.goto("/master/plantillas/fabricacion?vista=comparar");
    await expect(page.getByTestId("compare")).toContainText("1 paso(s) agregado(s)");
  });
});
