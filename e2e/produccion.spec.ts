import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";
import { DEV_PASSWORD, hasSeedUsers, loginOk, USERS } from "./helpers";

// E7 · Producción (PRD F6, RF-30…39): lote completo de ClariPlus (2.000,0 kg; 200 mL y 400 mL) de la orden al cierre del
// acondicionamiento, con los números del Prompt 0B: glicerina 60,00 kg en dos lotes, granel 100,2 %, envase 98,2 % y
// 98,6 %, producto terminado 97,5 % y 98,0 %. Incluye bloqueos (AC-04, AC-05, AC-07), segregación de funciones y aviso de
// capacitación (AC-25, D-19). Requiere la semilla completa (CI).
// Requisitos: RF-30, RF-31, RF-32, RF-33, RF-34, RF-35, RF-36, RF-37, RF-38, RF-39, AC-03, AC-04, AC-05, AC-07, AC-14,
// AC-25.
const hasSeedDocs = process.env.E2E_SEED_DOCS === "1";
const dbUrl = process.env.E2E_DB_URL;

async function as(
  browser: Browser,
  email: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginOk(page, email);
  return { page, close: () => ctx.close() };
}

/** Abre la acción firmada, escribe la contraseña y firma; espera que el diálogo se cierre. */
async function sign(page: Page, trigger: Locator) {
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Contraseña").fill(DEV_PASSWORD);
  await dialog.getByRole("button", { name: /^Firmar/ }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}

/** Firma y espera el rechazo con su regla (el diálogo sigue abierto); luego lo cierra. */
async function signRejected(page: Page, trigger: Locator, text: RegExp) {
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Contraseña").fill(DEV_PASSWORD);
  await dialog.getByRole("button", { name: /^Firmar/ }).click();
  await expect(dialog.getByRole("alert")).toContainText(text);
  await dialog.getByRole("button", { name: "Cancelar" }).click();
}

/** Despeje y limpieza de una etapa: Diego ejecuta; Paola verifica. */
async function prepare(diego: Page, paola: Page, base: string, stage: string, equipment: string[]) {
  await diego.goto(`${base}/despeje?etapa=${stage}`);
  for (const box of await diego.getByTestId("clearance-items").getByRole("checkbox").all())
    await box.check();
  await sign(diego, diego.getByTestId("sign-clearance"));
  await expect(diego.getByText("Usted ejecutó el despeje")).toBeVisible();
  await diego.goto(`${base}/limpieza?etapa=${stage}`);
  const tomorrow = new Date(Date.now() + 36 * 3600_000).toISOString().slice(0, 16);
  for (const code of equipment.length ? equipment : [""]) {
    if (code) {
      const option = diego.getByLabel("Equipo").locator("option", { hasText: `${code} ·` });
      await diego.getByLabel("Equipo").selectOption(String(await option.getAttribute("value")));
    }
    await diego.getByLabel("Utensilios").fill("Palas de acero, recipientes de acero");
    await diego.getByLabel("Vigente hasta *").fill(tomorrow);
    await diego.getByLabel("Rótulo de limpieza colocado y verificado").check();
    await sign(diego, diego.getByTestId("sign-cleaning"));
  }
  await paola.goto(`${base}/despeje?etapa=${stage}`);
  await sign(paola, paola.getByTestId("verify-clearance"));
  await paola.goto(`${base}/limpieza?etapa=${stage}`);
  while (await paola.getByTestId("verify-cleaning").count())
    await sign(paola, paola.getByTestId("verify-cleaning").first());
  await diego.goto(`${base}/${stage}`);
  await diego.getByTestId("start-stage").click();
  await expect(diego.getByTestId("stage-shell")).toContainText("En curso");
}

/** Completa los pasos del registro en orden: el valor de cada parámetro es el centro de su rango. */
async function runSteps(page: Page, values: Record<string, string> = {}) {
  for (let i = 0; i < 20; i++) {
    const card = page.getByTestId("current-step");
    if (!(await card.count())) return;
    for (const input of await card.locator('input[inputmode="decimal"]').all()) {
      const field = input.locator("xpath=..");
      const label = ((await field.locator("label").textContent()) ?? "")
        .replace(/\s*\(.*$|\s*\*$/g, "")
        .trim();
      const hint =
        (await field
          .locator("> span")
          .last()
          .textContent()
          .catch(() => "")) ?? "";
      const m = /Rango ([\d.]+)–([\d.]+)/.exec(hint);
      await input.fill(values[label] ?? (m ? String((Number(m[1]) + Number(m[2])) / 2) : "0"));
    }
    await sign(page, card.getByTestId("complete-step"));
  }
}

test.describe.serial("E7 · lote completo de producción (0B)", () => {
  test.skip(
    !hasSeedUsers || !hasSeedDocs || !dbUrl,
    "Requiere la semilla completa y la base de la CI",
  );
  test.setTimeout(900_000);
  // Un solo intento: el lote cambia datos y un reintento empezaría a mitad de camino.
  test.describe.configure({ retries: 0 });

  test("RF-30…RF-39 · de la orden al cierre del acondicionamiento con los números del 0B", async ({
    browser,
  }, info) => {
    test.skip(info.project.name !== "escritorio", "Crea un lote: se ejecuta en un solo proyecto");

    // Datos de apoyo (ilustrativos): una balanza apta y un segundo lote de glicerina aprobado (dos lotes en una línea).
    const db = new Client({ connectionString: dbUrl });
    await db.connect();
    await db.query(`
      with e as (insert into public.equipment (code, name, equipment_type, plant_area, critical, requires_qualification, requires_cleaning)
                 values ('BAL-015', 'Balanza 300 kg de respaldo', 'balanza', 'dispensacion', true, false, false)
                 on conflict (code) do nothing returning id)
      insert into public.equipment_events (equipment_id, type, performed_on, result, due_on, locked_at)
      select e.id, t, current_date - 10, 'conforme', current_date + 365, now()
      from e, unnest(array['calibracion', 'mantenimiento']) t;
      with l as (insert into public.material_lots (material_id, internal_code, supplier_lot, expiry_date, qty_received, unit, status)
                 select id, 'MP-2026-0900', 'GLI-2512-E', current_date + 240, 40, 'kg', 'aprobado' from public.materials where code = 'MP-014'
                 on conflict (internal_code) do nothing returning id)
      insert into public.inventory_movements (lot_id, type, qty, to_location_id, reason)
      select l.id, 'recepcion', 40, (select id from public.storage_locations where code = 'MP-E03-P1-01'), 'Recepción E2E' from l;`);
    await db.end();

    const paola = await as(browser, USERS.paola);
    const diego = await as(browser, USERS.diego);
    const P = paola.page;
    const D = diego.page;

    // S-15 · AC-07: sin fórmula aprobada no hay orden (PRD-014).
    await P.goto("/produccion/lotes");
    await P.getByRole("link", { name: "Crear orden de producción" }).click();
    await P.getByLabel("Producto *").selectOption({
      label: "PRD-014 · Suspensión oral Ibuprofeno 100 mg/5 mL",
    });
    await expect(P.getByTestId("order-blocked")).toContainText("fórmula");
    await expect(P.getByRole("button", { name: "Crear orden y lote" })).toBeDisabled();
    await P.getByLabel("Producto *").selectOption({ label: "PRD-001 · Loción micelar ClariPlus" });
    await expect(P.getByTestId("frozen-docs")).toContainText("IDI-FM-001");
    await expect(P.getByTestId("frozen-docs")).toContainText("PRD-PR-003-FR-01 v03");
    await expect(P.getByLabel("Tamaño del lote (kg) *")).toHaveValue("2000");
    await expect(P.getByLabel("Unidades teóricas · 200 mL")).toHaveValue("5000");
    await expect(P.getByLabel("Unidades teóricas · 400 mL")).toHaveValue("2500");
    await P.getByRole("button", { name: "Crear orden y lote" }).click();
    await expect(P).toHaveURL(/\/produccion\/ordenes\/[0-9a-f-]{36}\/documentos/, {
      timeout: 20_000,
    });
    await expect(P.getByRole("status").filter({ hasText: "Se creó OP-2026-" })).toBeVisible();
    const orderUrl = P.url().split("?")[0];
    await expect(P.getByText("La aprueba el Director técnico")).toBeVisible();

    // S-38 · RF-38 · AC-14: el Director técnico aprueba y se generan los documentos.
    const esteban = await as(browser, "esteban.gaviria@grufarcol.test");
    await esteban.page.goto(orderUrl);
    await sign(esteban.page, esteban.page.getByTestId("approve-order"));
    const docs = esteban.page.getByTestId("generated-docs");
    for (const t of [
      "SD-2026-",
      "SE-2026-",
      "SA-2026-",
      "CO-2026-",
      "Rótulos",
      "OF-2026-",
      "OE-2026-",
      "OA-2026-",
    ])
      await expect(docs).toContainText(t);
    await expect(
      esteban.page.getByTestId("dispensing-request").locator('tr[data-code="MP-014"]'),
    ).toContainText("60,00 kg");
    const pdf = await esteban.page.request.get(
      String(await docs.getByRole("link", { name: "Descargar PDF" }).first().getAttribute("href")),
    );
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    await esteban.close();

    await P.goto(orderUrl);
    await P.getByRole("link", { name: /^Ir al lote L-/ }).click();
    await expect(P).toHaveURL(/\/produccion\/lotes\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    const base = new URL(P.url()).pathname;

    // S-17 · AC-04: sin despeje la etapa no inicia.
    await D.goto(`${base}/dispensacion`);
    await D.getByTestId("start-stage").click();
    await expect(D.getByRole("alert").filter({ hasText: "despeje" })).toBeVisible();
    await prepare(D, P, base, "dispensacion", []);

    // S-18 · RF-33 · AC-03 · AC-05: solo lotes aprobados; BAL-014 no apta; glicerina en dos lotes.
    await expect(D.getByTestId("training-notice")).toBeHidden();
    const fen = D.locator('article[data-code="MP-031"]');
    await expect(
      fen.getByLabel("Lote").locator("option", { hasText: "MP-2026-0198" }),
    ).toBeDisabled();
    await expect(
      fen.getByLabel("Balanza").locator("option", { hasText: "BAL-014" }),
    ).toBeDisabled();
    await expect(fen).toContainText("BAL-014 no puede usarse");
    for (const code of [
      "MP-001",
      "MP-014",
      "MP-014",
      "MP-022",
      "MP-031",
      "MP-040",
      "MP-032",
      "MP-055",
      "MP-060",
    ]) {
      const line = D.locator(`article[data-code="${code}"]`);
      await line.getByLabel("Balanza").selectOption({ label: "BAL-015" });
      await sign(D, line.getByTestId(`dispense-${code}`));
    }
    const gli = D.locator('article[data-code="MP-014"]');
    await expect(gli.getByTestId("sum-indicator")).toContainText("60,00 / 60,00 kg");
    await expect(gli.locator("tr[data-lot]")).toHaveCount(2);
    // SOD-4: Diego no verifica su propia pesada.
    await signRejected(
      D,
      D.getByRole("button", { name: "Verificar" }).first(),
      /segregación|dispensó/i,
    );
    await P.goto(`${base}/dispensacion`);
    while (await P.getByRole("button", { name: "Verificar", exact: true }).count())
      await sign(P, P.getByRole("button", { name: "Verificar", exact: true }).first());
    await D.goto(`${base}/dispensacion`);
    await sign(D, D.getByTestId("complete-stage"));

    // S-19 · RF-34 · RF-37: fabricación con TQ-101 y HM-02 limpios; aviso de capacitación de PRD-PR-003-FR-01 v03.
    await prepare(D, P, base, "fabricacion", ["TQ-101", "HM-02"]);
    await expect(D.getByTestId("training-notice")).toContainText("PRD-PR-003-FR-01 v03");
    await expect(D.getByTestId("controlled-stamp")).toContainText(
      "PRD-PR-003-FR-01 · v03 · Vigente",
    );
    await runSteps(D, { Granel: "2004" });
    await P.goto(`${base}/fabricacion`);
    while (await P.getByRole("button", { name: "Verificar paso" }).count())
      await sign(P, P.getByRole("button", { name: "Verificar paso" }).first());
    await D.goto(`${base}/fabricacion`);
    await D.getByLabel("Granel obtenido (kg)").fill("2004");
    await D.getByLabel("Granel remanente (kg)").fill("4");
    await expect(D.getByTestId("yield-preview")).toContainText("100,2 %");
    await sign(D, D.getByTestId("record-output-fabricacion"));
    await sign(D, D.getByTestId("complete-stage"));

    // S-20 · RF-35: envase por presentación con control de peso (09:30 fuera de rango con acción) y rendimiento.
    await prepare(D, P, base, "envase", ["LL-03"]);
    for (const [name, weights, filled, pct] of [
      ["200 mL", ["199.8", "200.3", "198.9", "203.6", "200.1"], "4910", "98,2 %"],
      ["400 mL", ["400.2", "399.6"], "2465", "98,6 %"],
    ] as const) {
      await D.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
      await runSteps(D);
      for (const w of weights) {
        await D.getByLabel("Peso neto (g) *").fill(w);
        if (w === "203.6") {
          await expect(D.getByTestId("weight-controls").getByRole("alert")).toContainText(
            "fuera del rango 197,0–203,0 g",
          );
          await D.getByLabel("Acción tomada * (fuera de rango)").fill("Ajuste de la boquilla 2");
        }
        await sign(D, D.getByTestId("record-weight"));
      }
      await expect(
        D.getByTestId("weight-controls").locator('tr[data-in-range="false"]'),
      ).toHaveCount(name === "200 mL" ? 1 : 0);
      await D.getByLabel("Unidades envasadas").fill(filled);
      await expect(D.getByTestId("yield-preview")).toContainText(pct);
      await sign(D, D.getByTestId("record-output-envase"));
    }
    await P.goto(`${base}/envase`);
    for (const name of ["200 mL", "400 mL"]) {
      await P.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
      while (await P.getByRole("button", { name: "Verificar paso" }).count())
        await sign(P, P.getByRole("button", { name: "Verificar paso" }).first());
    }
    await D.goto(`${base}/envase`);
    await sign(D, D.getByTestId("complete-stage"));

    // S-21 · RF-36: codificado, inspección de 9 puntos (Paola), rendimiento PT y devolución que cuadra.
    await prepare(D, P, base, "acondicionamiento", []);
    await sign(D, D.getByTestId("verify-coding"));
    for (const [name, rej, ret, pct, returns] of [
      [
        "200 mL",
        "25",
        "10",
        "97,5 %",
        { "EM-ETQ-200": ["4935", "15", "50"], "EM-CAJA-200": ["4875", "0", "125"] },
      ],
      [
        "400 mL",
        "10",
        "5",
        "98,0 %",
        { "EM-ETQ-400": ["2465", "10", "25"], "EM-CAJA-400": ["2450", "0", "50"] },
      ],
    ] as const) {
      await P.goto(`${base}/acondicionamiento`);
      await P.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
      const form = P.getByTestId("inspection-form");
      for (const group of await form.getByRole("radiogroup").all())
        await group.getByLabel("Conforme", { exact: true }).check();
      await sign(P, P.getByTestId("sign-inspection"));
      await D.goto(`${base}/acondicionamiento`);
      await D.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
      await D.getByLabel("Rechazadas en inspección").fill(rej);
      await D.getByLabel("Muestras de retención").fill(ret);
      await expect(D.getByTestId("yield-preview")).toContainText(pct);
      await expect(D.getByTestId("yield-preview")).toContainText("dentro del límite");
      await sign(D, D.getByTestId("record-output-acondicionamiento"));
      for (const [mat, [used, dam, back]] of Object.entries(returns)) {
        const r = D.getByTestId(`return-${mat}`);
        await r.getByLabel("Usadas").fill(used);
        await r.getByLabel("Dañadas").fill(dam);
        await r.getByLabel("Devueltas").fill(back);
        await expect(r).toContainText("Cuadra");
        await sign(D, r.getByTestId(`record-return-${mat}`));
      }
    }
    await sign(D, D.getByTestId("complete-stage"));

    // El lote queda en cuarentena (revisión) y el tablero lo muestra; la orden se cierra.
    await P.goto("/produccion/lotes?estado=en_revision");
    const batchCode = (await P.locator("tr[data-code]").first().getAttribute("data-code")) ?? "";
    expect(batchCode).toMatch(/^L-\d{4}-\d{3}$/);
    await P.goto(base);
    for (const [stage, pct] of [
      ["fabricacion", "100,2 %"],
      ["envase", "98,2 %"],
      ["envase", "98,6 %"],
      ["acondicionamiento", "97,5 %"],
      ["acondicionamiento", "98,0 %"],
    ])
      await expect(P.locator(`[data-stage="${stage}"]`)).toContainText(pct);
    await paola.close();
    await diego.close();
  });
});
