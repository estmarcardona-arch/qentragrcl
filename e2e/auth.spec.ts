import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DEV_PASSWORD, hasSeedUsers, login, loginOk, USERS } from "./helpers";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const GENERIC = "No pudimos iniciar su sesión";

// RF-01 · inicio de sesión, cierre por inactividad y bloqueo; RF-02 · panel por rol.
test.describe("RF-01 · S-01 inicio de sesión", () => {
  test("S-01 en español y sin violaciones AA", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "es-CO");
    await expect(page.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeVisible();
    await expect(
      page.getByText("Los registros de esta plataforma tienen validez de evidencia."),
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test("sin sesión, una ruta privada lleva al inicio de sesión", async ({ page }) => {
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/login\?next=%2Finicio/);
  });

  test("RF-01 · correo inexistente: mensaje genérico", async ({ page }) => {
    await login(page, "nadie@grufarcol.test", "Cualquier.Clave.1");
    await expect(page.getByRole("alert").filter({ hasText: GENERIC })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("RF-01 · contraseña incorrecta: el mismo mensaje (no revela si el usuario existe)", async ({
    page,
  }) => {
    test.skip(!hasSeedUsers, "Requiere los usuarios de la semilla");
    await login(page, USERS.natalia, "Clave.Equivocada.1");
    await expect(page.getByRole("alert").filter({ hasText: GENERIC })).toBeVisible();
  });
});

test.describe("RF-01 / RF-02 · sesión iniciada", () => {
  test.skip(!hasSeedUsers, "Requiere los usuarios de la semilla");

  test("RF-02 · login correcto muestra el panel del rol (S-02)", async ({ page }, info) => {
    const user = info.project.name === "tablet" ? USERS.marta : USERS.diego;
    await loginOk(page, user);
    const name = info.project.name === "tablet" ? "Marta" : "Diego";
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
    await expect(page.getByTestId("dashboard-card")).toHaveCount(4);
    await expect(page.getByTestId("dashboard-card").first()).toContainText("Sin datos");
    const nav = page.getByRole("navigation", { name: "Menú principal" });
    await expect(nav.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
    await expect(nav).not.toContainText("Administración");
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test("RF-01 · cierre de sesión voluntario", async ({ page }, info) => {
    await loginOk(page, info.project.name === "tablet" ? USERS.lucia : USERS.sebastian);
    await page.getByRole("button", { name: /Menú de usuario/ }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login\?motivo=salida/);
    await expect(page.getByText("Sesión cerrada")).toBeVisible();
  });

  test("RF-01 · la sesión expira por inactividad", async ({ page }, info) => {
    await page.clock.install();
    await loginOk(page, info.project.name === "tablet" ? USERS.hernan : USERS.ricardo);
    await page.clock.fastForward("14:30");
    await expect(page.getByRole("alertdialog", { name: /inactividad/ })).toBeVisible();
    await page.clock.fastForward("01:00");
    await expect(page).toHaveURL(/\/login\?motivo=inactividad/, { timeout: 15_000 });
    await expect(page.getByText("Su sesión se cerró por inactividad")).toBeVisible();
  });

  test("RF-01 · bloqueo tras 5 intentos fallidos", async ({ page }, info) => {
    test.skip(process.env.E2E_AUTH_HOOK !== "1", "Requiere el hook de bloqueo de Supabase Auth");
    const user = info.project.name === "tablet" ? USERS.gabriela : USERS.marcela;
    for (let i = 0; i < 5; i++) {
      await login(page, user, `Clave.Equivocada.${i}`);
      await expect(page.getByRole("alert").filter({ hasText: GENERIC })).toBeVisible();
    }
    await login(page, user, DEV_PASSWORD);
    await expect(page.getByRole("alert").filter({ hasText: GENERIC })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("DI-2 · firma con reautenticación", () => {
  test.skip(!hasSeedUsers, "Requiere los usuarios de la semilla");

  test("firma con contraseña errónea: se rechaza e informa los intentos", async ({
    page,
  }, info) => {
    await loginOk(page, info.project.name === "tablet" ? USERS.ricardo : USERS.paola);
    await page.goto("/_design");
    await page.getByRole("button", { name: "Probar firma (en vivo)" }).click();
    const dialog = page.getByRole("dialog", { name: "Firmar registro" });
    await expect(dialog.getByTestId("server-time")).not.toHaveText("—");
    await dialog.getByLabel("Confirme su identidad").fill("Clave.Equivocada");
    await dialog.getByRole("button", { name: "Firmar" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Contraseña incorrecta. Le quedan 2 intentos.",
    );
    // Con la contraseña correcta pasa la reautenticación; el registro de prueba no existe.
    await dialog.getByLabel("Confirme su identidad").fill(DEV_PASSWORD);
    await dialog.getByRole("button", { name: "Firmar" }).click();
    await expect(dialog.getByRole("alert")).toContainText("El registro no existe");
  });
});
