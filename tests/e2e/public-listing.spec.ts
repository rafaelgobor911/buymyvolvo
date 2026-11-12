import { expect, test } from "@playwright/test";
import sharp from "sharp";

// The seller of this test (cleaned by global-setup before each run).
const PHONE = "(48) 90000-0988";

test.describe("Anuncie seu Volvo", () => {
  test("o vendedor envia o anúncio com foto; o admin revisa, exclui a foto e aprova", async ({
    page,
    browser,
  }, info) => {
    test.skip(info.project.name !== "desktop", "Writes run once, on desktop.");
    test.slow();
    // The form needs the commission (the seed leaves it undefined).
    await page.goto("/admin/entrar");
    await page.getByRole("button", { name: "Entrar como admin de teste" }).click();
    await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
    await page.goto("/admin/configuracoes", { waitUntil: "networkidle" });
    await page.getByLabel("Comissão fixa do vendedor (R$)").fill("1500");
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByRole("status").filter({ hasText: /salva|Nada mudou/ })).toBeVisible();

    const sellerContext = await browser.newContext();
    const seller = await sellerContext.newPage();
    await seller.goto("/");
    await seller.getByRole("link", { name: "Anuncie seu Volvo" }).first().click();
    await expect(
      seller.getByRole("heading", { name: "Anuncie seu Volvo", level: 1 }),
    ).toBeVisible();
    await expect(seller.getByText(/Comissão fixa de R\$\s1\.500/)).toBeVisible();

    await seller.getByLabel("Modelo", { exact: true }).selectOption("xc90");
    await seller.getByLabel("Motor (opcional)").selectOption("t8");
    await seller.getByLabel("Versão (opcional)").selectOption("inscription");
    await seller.getByLabel("Ano de fabricação").fill("2020");
    await seller.getByLabel("Ano-modelo").fill("2021");
    await seller.getByLabel("Km").fill("51.000");
    await seller.getByLabel("Preço (R$)").fill("319.900");
    await seller
      .getByLabel("Descrição (opcional)")
      .fill("Revisões na concessionária. Ligue (48) 90000-0988");
    await seller.getByLabel("Cidade").fill("Florianópolis");
    await seller.getByLabel("UF").selectOption("SC");
    const photo = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 40, g: 70, b: 110 } },
    })
      .jpeg()
      .toBuffer();
    await seller
      .getByLabel(/Escolher fotos/)
      .setInputFiles({ name: "carro.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(seller.getByRole("img", { name: "Foto 1 (capa)" })).toBeVisible();
    await seller.getByLabel("Particular").check();
    await seller.getByLabel("Seu nome ou o nome da loja").fill("Vendedor Teste Formulário");
    await seller.getByLabel("Seu WhatsApp").fill(PHONE);
    // The CPF is checked as soon as the field is left (and again on the server).
    await seller.getByLabel("Seu CPF").fill("564.738.291-65");
    await seller.getByLabel("Seu CPF").blur();
    await expect(seller.getByText("CPF inválido: confira os números.")).toBeVisible();
    await seller.getByLabel("Seu CPF").fill("564.738.291-64");
    await seller.getByLabel("Seu CPF").blur();
    await expect(seller.getByText("CPF inválido: confira os números.")).toHaveCount(0);
    await seller.getByRole("checkbox", { name: /Li e aceito os Termos do Anunciante/ }).check();
    await seller.getByRole("button", { name: "Enviar anúncio" }).click();
    // A phone in the public description is refused (buyers talk to the site).
    await expect(seller.getByText(/Tire telefone, e-mail, @ ou links da descrição/)).toBeVisible();
    await seller
      .getByLabel("Descrição (opcional)")
      .fill("Revisões na concessionária, pneus novos.");
    await seller.getByRole("button", { name: "Enviar anúncio" }).click();
    await expect(seller).toHaveURL(/\/anunciar\/enviado\?fotos=1$/, { timeout: 30_000 });
    await expect(seller.getByText(/Recebemos o seu anúncio com 1 foto/)).toBeVisible();
    await sellerContext.close();

    // Admin: authorized already, with the photo to review.
    await page.goto("/admin/moderacao?etapa=autorizados", { waitUntil: "networkidle" });
    await page
      .getByRole("link", { name: /Volvo XC90 T8 Inscription 2021/ })
      .first()
      .click();
    await expect(page.getByText(/Enviado pelo vendedor no formulário do site/)).toBeVisible();
    await expect(page.getByText("Vendedor Teste Formulário (particular)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fotos (1)" })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Excluir a foto 1" }).click();
    await expect(page.getByRole("heading", { name: /^Fotos/ })).toHaveCount(0);
    await page.keyboard.press("a");
    await expect(page).toHaveURL(/ok=aprovado/);
  });

  test("a página explica as condições e o cabeçalho leva até ela", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Anuncie seu Volvo" }).first()).toBeVisible();
    await page.goto("/anunciar");
    await expect(page.getByRole("heading", { name: "Anuncie seu Volvo", level: 1 })).toBeVisible();
  });
});
