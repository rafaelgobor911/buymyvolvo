import { expect, type Page, test } from "@playwright/test";

const CLAIM_SLUG = "volvo-ec40-twin-motor-ultimate-2025-florianopolis-sc-d29";
const REMOVE_SLUG = "volvo-v40-t4-momentum-2015-niteroi-rj-d32";

async function adminSignIn(page: Page) {
  await page.goto("/admin/entrar");
  await page.getByRole("button", { name: "Entrar como admin de teste" }).click();
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
}

test.describe("Vendedor", () => {
  test("remoção sem login tira o anúncio do ar e pede a declaração", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Writes run once, on desktop.");
    await page.goto(`/anuncio/${REMOVE_SLUG}`);
    await page.getByRole("link", { name: "Remover" }).click();
    await expect(page.getByRole("heading", { name: "Remover anúncio" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Já vendi o carro").check();
    await page.getByRole("button", { name: "Remover anúncio" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /Confirme que o anúncio é seu/ }),
    ).toBeVisible();
    await page.getByLabel(/Declaro que o anúncio é meu/).check();
    await page.getByRole("button", { name: "Remover anúncio" }).click();
    await expect(page).toHaveURL(/enviado=1/);
    await expect(page.getByRole("status")).toContainText("o anúncio saiu do ar");

    await page.goto(`/anuncio/${REMOVE_SLUG}`);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });

  test("reivindicar → admin aprova → painel → marcar como vendido", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "Writes run once, on desktop.");
    const sellerContext = await browser.newContext();
    const seller = await sellerContext.newPage();
    await seller.goto(`/anuncio/${CLAIM_SLUG}/reivindicar`);
    await seller.getByRole("link", { name: "Entrar para reivindicar" }).click();
    await seller.getByRole("button", { name: "Entrar como vendedor de teste" }).click();
    await expect(seller).toHaveURL(new RegExp(`/anuncio/${CLAIM_SLUG}/reivindicar$`));
    await seller.waitForLoadState("networkidle");
    await seller.getByLabel("Nome (seu ou da loja)").fill("Vendedor Teste");
    await seller.getByRole("button", { name: "Reivindicar anúncio" }).click();
    await expect(seller.getByText("Aceite os Termos do Anunciante para continuar.")).toBeVisible();
    await seller.getByLabel(/Li e aceito/).check();
    await seller.getByRole("button", { name: "Reivindicar anúncio" }).click();
    await expect(seller.getByText("Seu código de confirmação:")).toBeVisible();
    const code = (await seller.locator("p.font-mono").innerText()).trim();
    expect(code).toMatch(/^RV-[2-9A-Z]{6}$/);

    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await adminSignIn(admin);
    await admin.goto("/admin/reivindicacoes", { waitUntil: "networkidle" });
    const item = admin.getByRole("listitem").filter({ hasText: code });
    await item.getByRole("button", { name: "Aprovar" }).click();
    await expect(admin.getByRole("listitem").filter({ hasText: code })).toContainText("Aprovada");

    await seller.goto("/vendedor", { waitUntil: "networkidle" });
    await expect(seller.getByText(/@example\.com · vendedor verificado/)).toBeVisible();
    const card = seller.getByRole("article").filter({ hasText: "EC40 Twin Motor Ultimate 2025" });
    await card.getByLabel("Não, vendi por outro caminho").check();
    await card.getByRole("button", { name: "Marcar como vendido" }).click();
    await expect(seller.getByRole("status")).toHaveText(
      "Anúncio marcado como vendido. Parabéns pela venda!",
    );
    await expect(seller.getByText("Vendido por outro caminho.")).toBeVisible();

    await seller.goto(`/anuncio/${CLAIM_SLUG}`);
    await expect(seller.getByText("Vendedor verificado").first()).toBeVisible();
    await sellerContext.close();
    await adminContext.close();
  });

  test("sem login, o painel leva à entrada; os termos são um rascunho", async ({ page }) => {
    await page.goto("/vendedor");
    await expect(page).toHaveURL(/\/vendedor\/entrar\?next=%2Fvendedor$/);
    await expect(page.getByRole("button", { name: "Entrar com Google" })).toBeDisabled();
    await expect(page.getByLabel("E-mail")).toBeDisabled();
    await page.goto("/termos-do-anunciante");
    await expect(page.getByRole("heading", { name: "Termos do Anunciante" })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Rascunho para revisão jurídica");
  });

  test("a página de reivindicar explica o que o vendedor ganha", async ({ page }) => {
    await page.goto(`/anuncio/volvo-xc90-t8-inscription-2020-sao-paulo-sp-d36/reivindicar`);
    await expect(page.getByText("Selo de vendedor verificado no anúncio.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Remover sem cadastro" })).toBeVisible();
  });
});
