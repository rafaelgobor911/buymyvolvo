import { expect, type Page, test } from "@playwright/test";

// Fictitious seed listing waiting for its seller's authorization (scripts/db/fixtures.ts).
const V60 = "00000000-0000-4000-8000-000000000066";
const CODE = "d66";

async function signIn(page: Page) {
  await page.goto("/admin/entrar");
  await page.getByRole("button", { name: "Entrar como admin de teste" }).click();
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
}

test.describe("Autorização do vendedor", () => {
  test("convite, autorização do vendedor, aprovação e contato pelo WhatsApp do site", async ({
    page,
    browser,
  }, info) => {
    test.skip(info.project.name !== "desktop", "Writes run once, on desktop.");
    test.slow(); // several pages and two browser contexts
    // Not public before the seller authorizes.
    const hidden = await page.request.get(`/a/${CODE}`, { maxRedirects: 0 });
    expect(hidden.headers()["location"]).toBe("/busca");

    await signIn(page);
    // The seller must see the commission: set it first (the seed leaves it undefined).
    await page.goto("/admin/configuracoes", { waitUntil: "networkidle" });
    await page.getByLabel("Comissão fixa do vendedor (R$)").fill("1500");
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByRole("status").filter({ hasText: /salva|Nada mudou/ })).toBeVisible();

    await page.goto(`/admin/moderacao/${V60}`, { waitUntil: "networkidle" });
    await expect(
      page.getByText("Aprovar fica disponível depois da autorização do vendedor."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Gerar novo link" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Novo link gerado/ })).toBeVisible();
    const message = (await page.getByTestId("invite-message").textContent())!;
    expect(message).toContain("Volvo V60 T5 Momentum 2018");
    const invite = new URL(/https?:\/\/\S+\/autorizar\/\S+/.exec(message)![0]).pathname;

    // The seller opens the link (no session of any kind).
    const sellerContext = await browser.newContext();
    const seller = await sellerContext.newPage();
    await seller.goto(invite);
    await expect(
      seller.getByRole("heading", { name: "Autorize a divulgação do seu Volvo" }),
    ).toBeVisible();
    await expect(seller.getByText(/Comissão fixa de R\$\s1\.500/)).toBeVisible();
    await expect(seller.getByText("Sem exclusividade:")).toBeVisible();
    await seller.getByLabel("Seu nome ou o nome da loja").fill("Loja Teste E2E");
    await seller.getByLabel("Seu WhatsApp").fill("(48) 90000-0966");
    await seller.getByLabel("Seu CPF").fill("192.837.465-46");
    await seller.getByRole("button", { name: "Autorizar a divulgação" }).click();
    await expect(seller.getByText("Para autorizar, aceite os Termos do Anunciante.")).toBeVisible();
    await seller.getByRole("checkbox", { name: /Li e aceito os Termos do Anunciante/ }).check();
    await seller.getByRole("button", { name: "Autorizar a divulgação" }).click();
    await expect(seller.getByRole("heading", { name: "Anúncio autorizado" })).toBeVisible();
    await sellerContext.close();

    // Back in the admin: authorized, with the accepted commission; approve with A.
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(/^Autorizado em/)).toBeVisible();
    await expect(page.getByText("Loja Teste E2E (loja)")).toBeVisible();
    await page.keyboard.press("a");
    await expect(page).toHaveURL(/ok=aprovado/);

    // Public now: intermediated page, contact through the site's WhatsApp.
    await page.goto(`/a/${CODE}`);
    await expect(page).toHaveURL(/\/anuncio\/volvo-v60-t5-momentum-2018-florianopolis-sc-d66$/);
    await expect(page.getByText(/Anúncio intermediado pelo/)).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain("Loja Teste E2E");
    expect(html).not.toContain("instagram.com/p/");
    await page.getByRole("link", { name: "Tenho interesse: falar no WhatsApp" }).click();
    await expect(page).toHaveURL(/\/r\/previa\/VX-[2-9A-Z]{5}$/);
  });

  test("link inválido ou adulterado não abre a autorização", async ({ page }) => {
    await page.goto("/autorizar/d66.AAAAAAAAAAAAAAAAAAAAAA");
    await expect(page.getByRole("heading", { name: "Link indisponível" })).toBeVisible();
    await expect(page.getByText(/não é válido/)).toBeVisible();
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toContain("noindex");
  });
});
