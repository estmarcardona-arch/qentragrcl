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

/** Espera a que la acción sea interactiva (hidratada) antes de llenar su formulario o pulsarla. */
async function ready(trigger: Locator) {
  await expect(trigger).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
}

/** Abre la acción firmada, escribe la contraseña y firma; espera que el diálogo se cierre. */
async function sign(page: Page, trigger: Locator) {
  await ready(trigger);
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Contraseña").fill(DEV_PASSWORD);
  await dialog.getByRole("button", { name: /^Firmar/ }).click();
  try {
    await expect(dialog).toBeHidden({ timeout: 20_000 });
  } catch {
    // Diagnóstico: el texto del diálogo dice la regla que impidió firmar.
    throw new Error(
      `La firma no se cerró: ${(await dialog.innerText()).replace(/\s+/g, " ").slice(0, 600)}`,
    );
  }
}

/** Firma todas las verificaciones pendientes; tras cada una espera que la página quite la verificada. */
async function signAll(page: Page, buttons: Locator) {
  // La página llega por partes (streaming): espera el primer botón antes de contar.
  await expect(buttons.first()).toBeVisible({ timeout: 20_000 });
  for (let n = await buttons.count(); n > 0; n--) {
    await sign(page, buttons.first());
    await expect(buttons).toHaveCount(n - 1, { timeout: 20_000 });
  }
}

/** Firma y espera el rechazo con su regla (el diálogo sigue abierto); luego lo cierra. */
async function signRejected(page: Page, trigger: Locator, text: RegExp) {
  await ready(trigger);
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
  await ready(diego.getByTestId("sign-clearance"));
  for (const box of await diego.getByTestId("clearance-items").getByRole("checkbox").all())
    await box.check();
  await sign(diego, diego.getByTestId("sign-clearance"));
  await expect(diego.getByText("Usted ejecutó el despeje")).toBeVisible();
  await diego.goto(`${base}/limpieza?etapa=${stage}`);
  await ready(diego.getByTestId("sign-cleaning"));
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
  await signAll(paola, paola.getByTestId("verify-cleaning"));
  await diego.goto(`${base}/${stage}`);
  await ready(diego.getByTestId("start-stage"));
  await diego.getByTestId("start-stage").click();
  await expect(diego.getByTestId("stage-shell")).toContainText("En curso");
}

/** Completa los pasos del registro en orden: el valor de cada parámetro es el centro de su rango. */
async function runSteps(page: Page, values: Record<string, string> = {}) {
  await expect(page.getByTestId("current-step")).toBeVisible({ timeout: 20_000 });
  for (let i = 0; i < 20; i++) {
    const card = page.getByTestId("current-step");
    if (!(await card.count())) return;
    await ready(card.getByTestId("complete-step"));
    for (const row of await card.locator("tr[data-param]").all()) {
      const name = (await row.getAttribute("data-param")) ?? "";
      const min = await row.getAttribute("data-min");
      const max = await row.getAttribute("data-max");
      await row
        .locator("input")
        .fill(values[name] ?? (min && max ? String((Number(min) + Number(max)) / 2) : "0"));
    }
    const title = await card.locator("h3").textContent();
    await sign(page, card.getByTestId("complete-step"));
    // Espera a que la página muestre el paso siguiente (o ninguno) antes de seguir.
    await expect
      .poll(async () => ((await card.count()) ? await card.locator("h3").textContent() : null), {
        timeout: 20_000,
      })
      .not.toBe(title);
  }
}

test.describe.serial("E7 · lote completo de producción (0B)", () => {
  test.skip(
    !hasSeedUsers || !hasSeedDocs || !dbUrl,
    "Requiere la semilla completa y la base de la CI",
  );
  test.setTimeout(1_500_000);
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
      -- Lotes propios de la prueba (vencen antes: FEFO los elige primero) para no tocar los saldos de la semilla.
      with v(code, mat, qty, days) as (values ('MP-2026-0901', 'MP-001', 1884, 20), ('MP-2026-0902', 'MP-014', 40, 20),
             ('MP-2026-0903', 'MP-014', 30, 21), ('MP-2026-0904', 'MP-022', 30, 20), ('MP-2026-0905', 'MP-031', 16, 20),
             ('MP-2026-0906', 'MP-040', 6, 20), ('MP-2026-0907', 'MP-032', 2, 20), ('MP-2026-0908', 'MP-055', 1, 20),
             ('MP-2026-0909', 'MP-060', 1, 20)),
      l as (insert into public.material_lots (material_id, internal_code, supplier_lot, expiry_date, qty_received, unit, status)
            select m.id, v.code, 'E2E-' || v.code, current_date + v.days, v.qty, 'kg', 'aprobado'
            from v join public.materials m on m.code = v.mat
            on conflict (internal_code) do nothing returning id, qty_received)
      insert into public.inventory_movements (lot_id, type, qty, to_location_id, reason)
      select l.id, 'recepcion', l.qty_received, (select id from public.storage_locations where code = 'MP-E03-P1-01'), 'Recepción E2E'
      from l;`);
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
    await expect(P.getByTestId("frozen-docs")).toContainText("PRD-PR-003-FR-01");
    await expect(P.getByLabel("Tamaño del lote (kg) *")).toHaveValue("2.000,0");
    await expect(P.getByTestId("units-200 mL")).toHaveText("5.000");
    await expect(P.getByTestId("units-400 mL")).toHaveText("2.500");
    await expect(P.getByRole("button", { name: "Crear orden y lote" })).toHaveAttribute(
      "data-ready",
      "true",
    );
    await P.getByRole("button", { name: "Crear orden y lote" }).click();
    // S-15b · orden creada: consecutivos de la orden y del lote, y «Lo que sigue».
    await expect(P.getByTestId("order-created")).toContainText("Se creó OP-2026-", {
      timeout: 20_000,
    });
    await P.getByRole("link", { name: /^Ver orden OP-2026-/ }).click();
    await expect(P).toHaveURL(/\/produccion\/ordenes\/[0-9a-f-]{36}\/documentos/, {
      timeout: 20_000,
    });
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
    await esteban.page.getByRole("link", { name: "Solicitud de dispensación" }).click();
    await expect(
      esteban.page.getByTestId("dispensing-request").locator('tr[data-code="MP-014"]'),
    ).toContainText("60,00 kg");
    await esteban.page.goto(orderUrl);
    const pdf = await esteban.page.request.get(
      String(
        await esteban.page
          .getByTestId("generated-docs")
          .getByRole("link", { name: "Descargar PDF" })
          .first()
          .getAttribute("href"),
      ),
    );
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    await esteban.close();

    await P.goto(orderUrl);
    await P.locator('a[href^="/produccion/lotes/"]')
      .filter({ hasText: /^L-\d{4}-\d{3}$/ })
      .first()
      .click();
    await expect(P).toHaveURL(/\/produccion\/lotes\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    const base = new URL(P.url()).pathname;

    // S-17 · AC-04: sin despeje la etapa no inicia.
    await D.goto(`${base}/dispensacion`);
    await ready(D.getByTestId("start-stage"));
    await D.getByTestId("start-stage").click();
    await expect(D.getByRole("alert").filter({ hasText: "despeje" }).first()).toBeVisible();
    await prepare(D, P, base, "dispensacion", []);

    // S-18 · RF-33 · AC-03 · AC-05: solo lotes aprobados; BAL-014 no apta; glicerina en dos lotes.
    await expect(D.getByTestId("training-notice")).toBeHidden();
    const fen = D.locator('details[data-code="MP-031"]');
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
      const line = D.locator(`details[data-code="${code}"]`);
      await ready(line.getByTestId(`dispense-${code}`));
      await line.getByLabel("Balanza").selectOption({ label: "BAL-015" });
      const before = await line.locator("tr[data-lot]").count();
      await sign(D, line.getByTestId(`dispense-${code}`));
      await expect(line.locator("tr[data-lot]")).toHaveCount(before + 1, { timeout: 20_000 });
    }
    const gli = D.locator('details[data-code="MP-014"]');
    await expect(gli.getByTestId("sum-indicator")).toContainText("60,00 / 60,00 kg");
    await expect(gli.locator("tr[data-lot]")).toHaveCount(2);
    // SOD-4: Diego no verifica su propia pesada.
    await signRejected(
      D,
      D.getByRole("button", { name: "Verificar" }).first(),
      /segregación|dispensó/i,
    );
    await P.goto(`${base}/dispensacion`);
    await signAll(P, P.getByRole("button", { name: "Verificar", exact: true }));
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
    await signAll(P, P.getByRole("button", { name: "Verificar paso" }));
    await D.goto(`${base}/fabricacion`);
    await ready(D.getByTestId("record-output-fabricacion"));
    await D.getByLabel("Granel obtenido (kg)").fill("2004");
    await D.getByLabel("Granel remanente (kg)").fill("4");
    await expect(D.getByTestId("yield-preview")).toContainText("100,2 %");
    await sign(D, D.getByTestId("record-output-fabricacion"));
    await expect(D.getByTestId("yield-result")).toContainText("100,2 %", { timeout: 20_000 });
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
        await ready(D.getByTestId("record-weight"));
        await D.getByLabel("Peso neto (g) *").fill(w);
        if (w === "203.6") {
          await expect(D.getByTestId("weight-controls").getByRole("alert")).toContainText(
            "fuera del rango 197,0–203,0 g",
          );
          await D.getByLabel("Acción tomada * (fuera de rango)").fill("Ajuste de la boquilla 2");
        }
        const rows = await D.getByTestId("weight-controls").locator("tr[data-in-range]").count();
        await sign(D, D.getByTestId("record-weight"));
        await expect(D.getByTestId("weight-controls").locator("tr[data-in-range]")).toHaveCount(
          rows + 1,
          { timeout: 20_000 },
        );
      }
      await expect(
        D.getByTestId("weight-controls").locator('tr[data-in-range="false"]'),
      ).toHaveCount(name === "200 mL" ? 1 : 0);
      await ready(D.getByTestId("record-output-envase"));
      await D.getByLabel("Unidades envasadas").fill(filled);
      await expect(D.getByTestId("yield-preview")).toContainText(pct);
      await sign(D, D.getByTestId("record-output-envase"));
      await expect(D.getByTestId("yield-result")).toContainText(pct, { timeout: 20_000 });
    }
    await P.goto(`${base}/envase`);
    for (const name of ["200 mL", "400 mL"]) {
      await P.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
      await signAll(P, P.getByRole("button", { name: "Verificar paso" }));
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
      await ready(P.getByTestId("sign-inspection"));
      const form = P.getByTestId("inspection-form");
      for (const group of await form.getByRole("radiogroup").all())
        await group.getByLabel("Conforme", { exact: true }).check({ force: true });
      await sign(P, P.getByTestId("sign-inspection"));
      await expect(P.getByTestId("inspection-done")).toBeVisible({ timeout: 20_000 });
      await D.goto(`${base}/acondicionamiento`);
      await D.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
      await ready(D.getByTestId("record-output-acondicionamiento"));
      await D.getByLabel("Rechazadas en inspección").fill(rej);
      await D.getByLabel("Muestras de retención").fill(ret);
      await expect(D.getByTestId("yield-preview")).toContainText(pct);
      await expect(D.getByTestId("yield-preview")).toContainText("dentro del límite");
      await sign(D, D.getByTestId("record-output-acondicionamiento"));
      await expect(D.getByTestId("yield-result")).toContainText(pct, { timeout: 20_000 });
      for (const [mat, [used, dam, back]] of Object.entries(returns)) {
        const r = D.getByTestId(`return-${mat}`);
        await ready(r.getByTestId(`record-return-${mat}`));
        await r.getByLabel("Usadas").fill(used);
        await r.getByLabel("Dañadas").fill(dam);
        await r.getByLabel("Devueltas").fill(back);
        await expect(r).toContainText("Cuadra");
        await sign(D, r.getByTestId(`record-return-${mat}`));
        await expect(D.getByTestId(`return-done-${mat}`)).toBeVisible({ timeout: 20_000 });
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
