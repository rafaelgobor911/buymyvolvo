import { expect, test } from "@playwright/test";

test.describe("Home", () => {
  test("renders the search, safety tips and mandatory disclaimers", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Volvo seminovos e usados/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Encontre seu próximo Volvo.");

    const search = page.getByRole("searchbox", { name: "Buscar anúncios" });
    await expect(search).toBeVisible();

    await expect(page.getByRole("heading", { name: "Compre com segurança" })).toBeVisible();
    await expect(page.getByText("Não afiliado à Volvo Car Corporation.")).toBeVisible();
    await expect(page.getByText(/intermedeia a venda de Volvo seminovos/)).toBeVisible();
  });

  test("submits the search as a GET to /busca", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Buscar anúncios" }).fill("s60 t5");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/\/busca\?q=s60\+t5$/);
  });

  test("toggles between light and dark themes", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/);

    await page.getByRole("button", { name: "Ativar tema escuro" }).click();
    await expect(html).toHaveClass(/dark/);
  });
});
