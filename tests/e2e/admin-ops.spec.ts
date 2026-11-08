import { expect, type Page, test } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/admin/entrar");
  await page.getByRole("button", { name: "Entrar como admin de teste" }).click();
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
}

test.describe("Admin: operação", () => {
  test("fontes: listas, orçamento e cadastro", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Writes run once, on desktop.");
    await signIn(page);
    await page.goto("/admin/fontes", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: /Orçamento de hashtags: \d+ de \d+/ }),
    ).toBeVisible();
    // A ".demo" account is only read with --fixtures: safe to add in tests.
    await page.getByRole("textbox", { name: "Contas" }).fill("@loja_e2e.demo");
    await page.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText(/(Adicionadas|Já existiam): @loja_e2e\.demo/)).toBeVisible();
    await expect(page.getByText("@loja_e2e.demo", { exact: true })).toBeVisible();
  });

  test("jobs: ensaio pelo admin aparece no histórico", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Writes run once, on desktop.");
    await signIn(page);
    await page.goto("/admin/jobs", { waitUntil: "networkidle" });
    await page.getByLabel("Job", { exact: true }).selectOption("expire-listings");
    await page.getByRole("button", { name: "Rodar agora" }).click();
    await expect(page.getByText(/expire-listings \(ensaio\): concluído/)).toBeVisible();
    await page.getByRole("link", { name: "expire-listings", exact: true }).click();
    await expect(page.getByText("ensaio").first()).toBeVisible();
  });

  test("remoção confirmada vai para a blocklist; o bloqueio manual valida o valor", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "Writes run once, on desktop.");
    await signIn(page);
    await page.goto("/admin/remocoes", { waitUntil: "networkidle" });
    await expect(page.getByText("Já vendi o carro, podem tirar o anúncio.")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar remoção" }).click();
    await expect(page.getByText("Confirmado")).toBeVisible();

    await page.goto("/admin/blocklist", { waitUntil: "networkidle" });
    await expect(page.getByRole("cell", { name: "+5520910000061" })).toBeVisible();

    await page.getByLabel("Tipo").selectOption("phone");
    await page.getByLabel("Valor").fill("123");
    await page.getByRole("button", { name: "Bloquear", exact: true }).click();
    await expect(page.getByText("Telefone inválido.")).toBeVisible();

    await page.getByLabel("Tipo").selectOption("ig_username");
    await page.getByLabel("Valor").fill("@perfil_e2e");
    await page.getByRole("button", { name: "Bloquear", exact: true }).click();
    await expect(page.getByText(/^(Bloqueado|Já estava na blocklist)\.$/)).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "perfil_e2e" });
    await row.getByRole("button", { name: "Desbloquear" }).click();
    await expect(page.getByRole("row").filter({ hasText: "perfil_e2e" })).toHaveCount(0);
  });

  test("leads: visitas contam e o CSV baixa", async ({ page }) => {
    await page.goto("/anuncio/volvo-xc60-t5-dynamic-2014-goiania-go-d17", {
      waitUntil: "networkidle",
    });
    await signIn(page);
    await page.goto("/admin/leads?dias=7", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Por anúncio" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Volvo XC60 T5 Dynamic 2014/ }).first(),
    ).toBeVisible();
    const csv = await page.request.get("/admin/leads/csv?dias=7");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("data_hora;codigo;canal;cliques");
  });

  test("CSV e telas exigem login", async ({ request }) => {
    const csv = await request.get("/admin/leads/csv");
    expect(csv.status()).toBe(401);
  });

  test("vendedores lista as lojas", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/vendedores", { waitUntil: "networkidle" });
    await expect(page.getByText("Loja Demo Curitiba")).toBeVisible();
  });
});
