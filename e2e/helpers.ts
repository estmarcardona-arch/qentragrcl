import { expect, type Page } from "@playwright/test";
import { Client } from "pg";

// Usuarios ficticios de supabase/seed.sql (Prompt 0B). Solo existen en la base local/CI.
export const DEV_PASSWORD = "Grufarcol.Dev.2026";
export const USERS = {
  camila: "camila.ortega@grufarcol.test",
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

/**
 * Crea en la base de pruebas (E2E_DB_URL, solo CI) un usuario ficticio desechable, igual que la semilla.
 * Sirve para pruebas que lo dejan inutilizable (bloqueo por intentos) sin afectar a los usuarios compartidos.
 */
export async function createThrowawayUser(dbUrl: string, label: string): Promise<string> {
  const email = `${label}.${Date.now()}@grufarcol.test`;
  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  try {
    await db.query(
      `with u as (
         insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
           raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
           email_change_token_new, email_change, email_change_token_current, reauthentication_token,
           phone_change, phone_change_token)
         values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
           extensions.crypt($2, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
           jsonb_build_object('full_name', 'Usuario de prueba E2E'), now(), now(), '', '', '', '', '', '', '', '')
         returning id, email)
       insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
       from u`,
      [email, DEV_PASSWORD],
    );
  } finally {
    await db.end();
  }
  return email;
}
