import { expect, test } from "@playwright/test";

test.describe("observabilidad", () => {
  test("GET /api/health responde ok con la base conectada", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", database: "ok" });
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("página 404 en español", async ({ page }) => {
    const res = await page.goto("/no-existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("No encontramos esta página")).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al inicio" })).toBeVisible();
  });
});
