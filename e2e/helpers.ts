import { expect, type Page } from "@playwright/test";

// Usuarios ficticios de supabase/seed.sql (Prompt 0B). Solo existen en la base local/CI.
export const DEV_PASSWORD = "Grufarcol.Dev.2026";
export const USERS = {
  diego: "diego.cardenas@grufarcol.test",
  marta: "marta.quintero@grufarcol.test",
  paola: "paola.mejia@grufarcol.test",
  ricardo: "ricardo.pena@grufarcol.test",
  hernan: "hernan.salgado@grufarcol.test",
  natalia: "natalia.ruiz@grufarcol.test",
  marcela: "marcela.duarte@grufarcol.test",
  gabriela: "gabriela.torres@grufarcol.test",
  lucia: "lucia.barrera@grufarcol.test",
  sebastian: "sebastian.rojas@grufarcol.test",
} as const;

/** Las pruebas con usuarios requieren la semilla (CI la carga con `supabase start`). */
export const hasSeedUsers = process.env.E2E_SEED_USERS === "1";

export async function login(page: Page, email: string, password = DEV_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

export async function loginOk(page: Page, email: string) {
  await login(page, email);
  try {
    await expect(page).toHaveURL(/\/inicio$/, { timeout: 10_000 });
  } catch {
    // Diagnóstico: el texto visible explica por qué no entró (mensaje de error o pantalla).
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 600);
    throw new Error(`No llegó a /inicio (URL ${page.url()}). Pantalla: ${text}`);
  }
}
