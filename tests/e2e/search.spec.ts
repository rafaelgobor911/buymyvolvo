import { expect, test } from "@playwright/test";

test.describe("Busca e anúncio", () => {
  test("s60 t5: entende a busca, mostra só S60 T5 e abre o anúncio", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Buscar anúncios" }).fill("s60 t5");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/\/busca\?q=s60\+t5/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("5 anúncios");
    await expect(page.getByRole("link", { name: "Remover filtro: T5" })).toBeVisible();

    const cards = page.locator("main article");
    await expect(cards).toHaveCount(5);
    for (const title of await cards.getByRole("link").allTextContents()) {
      expect(title).toMatch(/^Volvo S60 T5/);
    }

    await cards.first().getByRole("link").click();
    await expect(page).toHaveURL(/\/anuncio\/volvo-s60-t5-/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Volvo S60 T5");
    await expect(
      page.getByText(/Anúncio intermediado pelo .+ não recebe pagamento pelo carro\./),
    ).toBeVisible();
    await expect(page.getByText("Ver no Instagram")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Remover" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reivindicar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Compre com segurança" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Tenho interesse: falar no WhatsApp" }),
    ).toHaveAttribute("href", /^\/r\/[a-z0-9]+$/);
  });

  test("repasse: selo na busca e quadro de cuidados no anúncio", async ({ page }) => {
    await page.goto("/busca?q=repasse");
    await expect(page.getByRole("link", { name: "Remover filtro: Só repasse" })).toBeVisible();
    const cards = page.locator("main article");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    await expect(cards.filter({ hasText: "Repasse" })).toHaveCount(count);

    await cards.first().getByRole("link").click();
    await expect(page.getByRole("heading", { name: "Anúncio de repasse" })).toBeVisible();
    await expect(
      page.getByText("Não pague sinal nem reserva antes de ver o carro e o documento."),
    ).toBeVisible();
  });

  test("carroceria: suv vira filtro, o resto vai para o texto", async ({ page }) => {
    await page.goto("/busca?q=suv+teto+solar");
    await expect(page.getByRole("link", { name: "Remover filtro: SUV" })).toBeVisible();
    await expect(page.getByText("Também buscamos o texto:")).toBeVisible();
    await expect(page.getByRole("link", { name: "Remover filtro: “teto solar”" })).toBeVisible();

    // A model that never had the body says what it is.
    await page.goto("/busca?q=s60+perua");
    await expect(page.getByText("S60 é sedã, não perua.")).toBeVisible();

    // The home groups the models by body type and links to the whole type.
    await page.goto("/");
    await page.getByRole("link", { name: /Todos os SUVs/ }).click();
    await expect(page).toHaveURL(/\/busca\?carroceria=suv/);
    await expect(page.getByRole("link", { name: "Remover filtro: SUV" })).toBeVisible();
  });

  test("remover um filtro amplia a busca", async ({ page }) => {
    await page.goto("/busca?q=s60+t5");
    await page.getByRole("link", { name: "Remover filtro: T5" }).click();
    await expect(page).toHaveURL(/motor=/);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("5 anúncios");
    await expect(page.getByRole("link", { name: "Remover filtro: T5" })).toHaveCount(0);
  });

  test("são paulo busca no estado e oferece só a cidade", async ({ page }) => {
    await page.goto("/busca?q=xc60+são+paulo");
    await page.getByRole("link", { name: "Ver só a cidade de São Paulo" }).click();
    await expect(page.getByRole("link", { name: "Remover filtro: São Paulo, SP" })).toBeVisible();
  });

  test("estado vazio sugere como afrouxar a busca", async ({ page }) => {
    await page.goto("/busca?q=ex90+manual");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nenhum anúncio encontrado");
    await page.getByRole("link", { name: "Sem “Manual”" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("1 anúncio");
  });

  test("ordenação por menor preço", async ({ page }) => {
    await page.goto("/busca?q=xc60");
    await page.getByRole("link", { name: "Menor preço" }).click();
    await expect(page).toHaveURL(/ordem=menor-preco/);
    await expect(page.getByRole("link", { name: "Menor preço" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("anúncio inexistente mostra página de não encontrado", async ({ page }) => {
    await page.goto("/anuncio/volvo-nao-existe-123");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });
});

test.describe("Filtros", () => {
  test("no celular, filtros abrem num painel inferior", async ({ page, isMobile }) => {
    test.skip(!isMobile, "só no celular");
    await page.goto("/busca?q=xc90");
    await page.getByRole("button", { name: /Filtros/ }).click();
    const dialog = page.getByRole("dialog", { name: "Filtros" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Motor").selectOption("t8");
    await dialog.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page).toHaveURL(/motor=t8/);
    await expect(page.getByRole("link", { name: "Remover filtro: T8" })).toBeVisible();
  });

  test("no desktop, filtros ficam na lateral", async ({ page, isMobile }) => {
    test.skip(isMobile, "só no desktop");
    await page.goto("/busca?q=xc90");
    const aside = page.getByRole("complementary", { name: "Filtros" });
    await aside.getByLabel("Motor").selectOption("t8");
    await aside.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page.getByRole("link", { name: "Remover filtro: T8" })).toBeVisible();
  });
});
