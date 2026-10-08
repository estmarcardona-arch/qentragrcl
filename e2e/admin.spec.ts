import { readFileSync } from "node:fs";
import { expect, test, type Browser } from "@playwright/test";
import { Client } from "pg";
import { parsePrdMatrix } from "../src/lib/admin/prd-matrix";
import { DEV_PASSWORD, hasSeedUsers, login, loginOk, USERS } from "./helpers";

// RF-03 · usuarios y roles; RF-04 · catálogos, perfiles y matriz de permisos; RF-06 · áreas; AC-11.
const ADMIN = "tomas.herrera@grufarcol.test";
const adminApi = process.env.E2E_ADMIN_API === "1";
const dbUrl = process.env.E2E_DB_URL;

async function freshPage(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

async function confirmWithReason(
  page: import("@playwright/test").Page,
  reason: string,
  button: string | RegExp,
) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Motivo/).fill(reason);
  await dialog.getByRole("button", { name: button }).click();
  await expect(dialog).toBeHidden();
}

test.describe("RF-03 · Administración: acceso", () => {
  test.skip(!hasSeedUsers, "Requiere los usuarios de la semilla");

  test("RF-03 · un usuario sin rol admin no entra a Administración", async ({ page }) => {
    await loginOk(page, USERS.diego);
    await page.goto("/admin/usuarios");
    await expect(page.getByText("No tiene acceso a Administración")).toBeVisible();
    await expect(page.getByRole("table", { name: "Usuarios" })).toHaveCount(0);
  });

  test("RF-03 · el administrador ve los usuarios y filtra por rol", async ({ page }) => {
    await loginOk(page, ADMIN);
    await page.goto("/admin/usuarios");
    const table = page.getByRole("table", { name: "Usuarios" });
    await expect(table).toContainText("Diego Cárdenas");
    await page.getByLabel("Rol").selectOption("auditor");
    await expect(table).toContainText("Inés Valencia");
    await expect(table).not.toContainText("Diego Cárdenas");
  });
});

test.describe("RF-03 · alta y baja de usuario", () => {
  test.skip(!hasSeedUsers, "Requiere los usuarios de la semilla");

  test("RF-03 · alta por invitación con enlace de un solo uso y política de contraseña", async ({
    page,
    browser,
  }, info) => {
    test.skip(!adminApi, "Requiere la clave administrativa en el servidor");
    const email = `e2e.${info.project.name}.${Date.now()}@grufarcol.test`;
    await loginOk(page, ADMIN);
    await page.goto("/admin/usuarios/nuevo");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Nombre completo").fill("Persona De Prueba");
    await page.getByLabel("Cargo").fill("Químico formulador (I+D)");
    await page.getByRole("checkbox", { name: /Químico formulador/ }).check();
    await page.getByRole("button", { name: "Crear invitación" }).click();
    const formError = page.locator("form [role=alert]");
    await page.getByTestId("invite-link").or(formError).first().waitFor();
    if (await formError.isVisible()) {
      throw new Error(`La invitación falló: ${await formError.innerText()}`);
    }
    const link = (await page.getByTestId("invite-link").innerText()).trim();
    expect(link).toContain("/auth/confirmar?token_hash=");

    // La persona invitada abre el enlace y crea su contraseña.
    const guest = await freshPage(browser);
    await guest.page.goto(link);
    await expect(
      guest.page.getByRole("heading", { name: /cree su contraseña/ }),
      `después del enlace quedó en ${guest.page.url()}`,
    ).toBeVisible();
    await guest.page.getByLabel("Nueva contraseña").fill("corta");
    await guest.page.getByLabel("Confirme la contraseña").fill("corta");
    await guest.page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(guest.page.getByRole("alert")).toContainText("al menos 12 caracteres");
    await guest.page.getByLabel("Nueva contraseña").fill("Invitacion.Segura.2026");
    await guest.page.getByLabel("Confirme la contraseña").fill("Invitacion.Segura.2026");
    await guest.page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(guest.page).toHaveURL(/\/inicio$/);
    await expect(guest.page.getByRole("heading", { level: 1 })).toContainText("Persona");

    // El enlace es de un solo uso.
    const again = await freshPage(browser);
    await again.page.goto(link);
    await expect(again.page).toHaveURL(/\/login\?motivo=enlace/);
    await guest.ctx.close();
    await again.ctx.close();
  });

  test("RF-03 · baja: un usuario desactivado no entra y se puede reactivar", async ({
    page,
    browser,
  }, info) => {
    const target =
      info.project.name === "tablet"
        ? "valentina.cruz@grufarcol.test"
        : "camila.ortega@grufarcol.test";
    const name = info.project.name === "tablet" ? "Valentina Cruz" : "Camila Ortega";
    await loginOk(page, ADMIN);
    await page.goto("/admin/usuarios");
    await page.getByRole("link", { name }).click();
    await page.getByRole("button", { name: "Desactivar usuario" }).click();
    await confirmWithReason(page, "Prueba E2E de desactivación", "Desactivar");
    await expect(page.getByText("Inactivo").first()).toBeVisible();

    const other = await freshPage(browser);
    await login(other.page, target);
    await expect(other.page).toHaveURL(/\/login/);
    await expect(
      other.page.getByRole("alert").or(other.page.getByRole("status")).first(),
    ).toBeVisible();
    await other.ctx.close();

    await page.getByRole("button", { name: "Reactivar usuario" }).click();
    await confirmWithReason(page, "Fin de la prueba E2E", "Reactivar");
    await expect(page.getByText("Activo").first()).toBeVisible();
  });
});

test.describe("AC-11 · auditor vencido", () => {
  test.skip(!hasSeedUsers || !dbUrl, "Requiere la semilla y acceso directo a la base de pruebas");

  test("AC-11 · un auditor vencido no inicia sesión y ve la fecha de vencimiento", async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "escritorio",
      "Modifica un dato compartido: solo en un proyecto",
    );
    const db = new Client({ connectionString: dbUrl });
    await db.connect();
    const restore = "2026-11-30T23:59:59-05:00";
    try {
      await db.query(
        `update public.user_roles set granted_at = now() - interval '60 days', expires_at = now() - interval '1 day'
         where role = 'auditor' and user_id = (select id from public.profiles where email = $1)`,
        ["ines.valencia@grufarcol.test"],
      );
      await login(page, "ines.valencia@grufarcol.test", DEV_PASSWORD);
      await expect(page.getByText("Cuenta de auditor vencida")).toBeVisible();
      await expect(page.getByText(/Su acceso venció el \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await db.query(
        `update public.user_roles set expires_at = greatest($2::timestamptz, now() + interval '1 day')
         where role = 'auditor' and user_id = (select id from public.profiles where email = $1)`,
        ["ines.valencia@grufarcol.test", restore],
      );
      await db.end();
    }
  });
});

test.describe("RF-04 / RF-06 · catálogos y matriz", () => {
  test.skip(!hasSeedUsers, "Requiere los usuarios de la semilla");

  test("RF-04 · la matriz de permisos de S-04 coincide celda a celda con el PRD 2.2", async ({
    page,
  }) => {
    const prd = parsePrdMatrix(readFileSync("docs/PRD_GRUFARCOL.md", "utf8"));
    await loginOk(page, ADMIN);
    await page.goto("/admin/catalogos?tab=matriz");
    const table = page.getByTestId("permission-matrix");
    const header = await table.locator("thead th").allInnerTexts();
    expect(header.map((h) => h.trim())).toEqual(["Módulo", ...prd.roles]);
    const rows = await table
      .locator("tbody tr")
      .evaluateAll((trs) =>
        trs.map((tr) =>
          Array.from(tr.querySelectorAll("th, td")).map((c) =>
            (c.textContent ?? "").replace(/\s+/g, " ").trim(),
          ),
        ),
      );
    expect(rows).toEqual(prd.rows.map((r) => [r.module, ...r.cells.map((c) => c.text)]));
  });

  test("RF-04 · el administrador agrega y modifica una unidad (versión y motivo)", async ({
    page,
  }, info) => {
    const code = `e2e-${info.project.name}-${Date.now()}`;
    await loginOk(page, ADMIN);
    await page.goto("/admin/catalogos?tab=catalogos&c=unidades");
    await page.getByRole("button", { name: "Agregar" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Código").fill(code);
    await dialog.getByLabel("Nombre").fill("Unidad de prueba");
    await confirmWithReason(page, "Prueba E2E de catálogo", "Agregar");
    const row = page.getByRole("row", { name: new RegExp(code) });
    await expect(row).toContainText("v1");
    await row.getByRole("button", { name: /Editar/ }).click();
    await page.getByRole("dialog").getByLabel("Nombre").fill("Unidad de prueba (editada)");
    await page.getByRole("dialog").getByLabel("Activo").uncheck();
    await confirmWithReason(page, "Prueba E2E: corrección del nombre", "Guardar");
    await expect(row).toContainText("v2");
    await expect(row).toContainText("Inactivo");
  });

  test("RF-06 · Aseguramiento de la calidad es el área dueña del SGD (GCA)", async ({ page }) => {
    await loginOk(page, ADMIN);
    await page.goto("/admin/catalogos?tab=areas");
    const row = page.getByRole("row", { name: /Aseguramiento de la calidad/ });
    await expect(row).toContainText("GCA");
    await expect(row).toContainText("Dueña del SGD");
  });

  test("RF-04 · perfiles regulatorios lado a lado", async ({ page }) => {
    await loginOk(page, ADMIN);
    await page.goto("/admin/catalogos?tab=perfiles");
    await expect(
      page.getByText("Un cambio de perfil no altera los lotes ya creados.", { exact: false }),
    ).toBeVisible();
    const row = page.getByRole("row", { name: /Verificación independiente en dispensación/ });
    await expect(row.getByRole("cell")).toHaveCount(2);
  });
});
