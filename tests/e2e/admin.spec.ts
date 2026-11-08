import { expect, type Page, test } from "@playwright/test";

// Fictitious seed listings waiting in moderation (scripts/db/fixtures.ts).
const seedId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const XC60_POLESTAR = seedId(60);
const XC40_TWIN = seedId(64);
const REPASSE_WITH_DEPOSIT = seedId(65);

async function signIn(page: Page) {
  await page.goto("/admin/entrar");
  await page.getByRole("button", { name: "Entrar como admin de teste" }).click();
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
}

test.describe("Admin", () => {
  test("sem login, o admin leva à tela de entrada", async ({ page }) => {
    await page.goto("/admin/moderacao");
    await expect(page).toHaveURL(/\/admin\/entrar$/);
    await expect(page.getByRole("heading", { name: "Entrar no admin" })).toBeVisible();
    // No Supabase project yet: Google login is shown but disabled.
    await expect(page.getByRole("button", { name: "Entrar com Google" })).toBeDisabled();
  });

  test("início mostra a fila e os alertas; a navegação leva à moderação", async ({ page }) => {
    await signIn(page);
    await expect(page.getByText(/anúncio\(s\) esperando moderação/)).toBeVisible();
    await page.getByRole("link", { name: "Moderação", exact: true }).click();
    await expect(page.getByRole("heading", { name: /^Moderação \(\d+\)$/ })).toBeVisible();
  });

  test("moderação mostra o post e o motivo; rejeitar pede o motivo", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Writes run once, on desktop.");
    await signIn(page);
    await page.goto(`/admin/moderacao/${REPASSE_WITH_DEPOSIT}`, { waitUntil: "networkidle" });
    await expect(page.getByText(/Repasse ou ágio com pedido de sinal/).first()).toBeVisible();
    await expect(page.getByText(/Somente pix de sinal pra reservar/)).toBeVisible();

    await page.keyboard.press("r");
    const reason = page.getByLabel("Motivo da rejeição");
    await expect(reason).toBeFocused();
    await reason.selectOption("Suspeita de golpe");
    await page.getByRole("button", { name: "Rejeitar" }).click();
    await expect(page.getByRole("status").filter({ hasText: /rejeitado/ })).toBeVisible();

    // Rejected listings are not public.
    const short = await page.request.get("/a/d65", { maxRedirects: 0 });
    expect(short.headers()["location"]).toBe("/busca");
  });

  test("aprovar pelo atalho publica o anúncio corrigido e registra o histórico", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "Writes run once, on desktop.");
    await signIn(page);
    await page.goto(`/admin/moderacao/${XC40_TWIN}`, { waitUntil: "networkidle" });
    const price = page.getByLabel("Preço (R$)");
    await price.fill("172.000");
    await price.press("Control+Enter");
    await expect(page).toHaveURL(/ok=aprovado/);

    const short = await page.request.get("/a/d64", { maxRedirects: 0 });
    const location = short.headers()["location"]!;
    expect(location).toBe("/anuncio/volvo-xc40-twin-motor-2021-porto-alegre-rs-d64");
    await page.goto(location);
    await expect(page.getByText("R$ 172.000").first()).toBeVisible();

    await page.goto(`/admin/anuncios/${XC40_TWIN}`);
    // The audit trail is append-only, so earlier runs may have left entries too.
    await expect(page.getByText("Aprovou").first()).toBeVisible();
    await expect(page.getByText("Preço: R$ 175.000 → R$ 172.000").first()).toBeVisible();
  });

  test("configurações validam a mensagem e mostram a prévia", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/configuracoes", { waitUntil: "networkidle" });
    const template = page.getByLabel("Mensagem do WhatsApp");
    await expect(
      page.getByText(/Olá! Vi seu Volvo XC60 T8 Polestar Engineered 2024/),
    ).toBeVisible();
    await template.fill("Oi {nome}, vi seu {modelo}");
    await expect(page.getByText("Oi {nome}, vi seu XC60")).toBeVisible();
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /Corrija os campos marcados/ }),
    ).toBeVisible();
    await expect(page.getByText(/Inclua \{ref\}/)).toBeVisible();
  });

  test("no celular, a moderação mostra o post e o formulário", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "Mobile layout check.");
    await signIn(page);
    await page.goto(`/admin/moderacao/${XC60_POLESTAR}`);
    await expect(page.getByRole("heading", { name: "Post original" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Aprovar e publicar/ })).toBeVisible();
    await expect(page.getByLabel("Modelo", { exact: true })).toHaveValue("xc60");
  });
});
