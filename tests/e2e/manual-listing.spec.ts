import { expect, test } from "@playwright/test";

test.describe("Novo anúncio a partir de texto (admin)", () => {
  test("a tela fica em Anúncios e valida o texto colado", async ({ page }) => {
    await page.goto("/admin/entrar");
    await page.getByRole("button", { name: "Entrar como admin de teste" }).click();
    await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();

    await page.goto("/admin/anuncios", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Novo anúncio a partir de texto" }).click();
    await expect(
      page.getByRole("heading", { name: "Novo anúncio a partir de texto" }),
    ).toBeVisible();
    await expect(page.getByText(/O texto não é publicado/)).toBeVisible();

    // Too short to be an ad: the server says so (no extraction call).
    await page.getByLabel("Texto do anúncio").fill("XC60 à venda");
    await page.getByLabel("De onde veio").selectOption("olx");
    await page.getByLabel("Link do anúncio original (opcional)").fill("https://www.olx.com.br/x");
    await page.getByRole("button", { name: "Ler o anúncio e criar" }).click();
    await expect(page.getByText("Cole o texto do anúncio (pelo menos uma frase).")).toBeVisible();
    // The form keeps what was typed.
    await expect(page.getByLabel("Texto do anúncio")).toHaveValue("XC60 à venda");
  });
});
