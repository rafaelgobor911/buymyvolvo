import { expect, test } from "@playwright/test";

// A fictitious seed listing (DDD 20) and Buy My Volvo's fictitious number in the
// seed: the click shows the preview page instead of opening WhatsApp.
const SLUG = "volvo-xc60-t5-dynamic-2014-goiania-go-d17";
const CODE = "d17";

test.describe("Contato pelo WhatsApp", () => {
  test("o clique registra o contato e mostra a mensagem com o código", async ({ page }) => {
    await page.goto(`/anuncio/${SLUG}`);
    const html = await page.content();
    expect(html).not.toContain("+5520");
    expect(html).not.toContain("wa.me");

    const button = page.getByRole("link", { name: "Tenho interesse: falar no WhatsApp" });
    await expect(button).toHaveAttribute("href", `/r/${CODE}`);
    await expect(
      page.getByText(/Você fala com a equipe do .+\. Não guardamos dados seus neste clique\./),
    ).toBeVisible();
    await button.click();

    await expect(page).toHaveURL(/\/r\/previa\/VX-[2-9A-Z]{5}$/);
    const ref = page.url().split("/").pop()!;
    await expect(page.getByRole("heading", { name: "Prévia do contato" })).toBeVisible();
    await expect(page.getByRole("blockquote")).toHaveText(
      new RegExp(
        `^Olá! Tenho interesse no Volvo XC60 T5 Dynamic 2014 anunciado no .+ \\(https?://[^)]+/a/${CODE}\\)\\. Ainda está disponível\\? \\(ref\\. ${ref}\\)$`,
      ),
    );

    await page.getByRole("link", { name: "Voltar ao anúncio" }).click();
    await expect(page).toHaveURL(new RegExp(`/anuncio/${SLUG}$`));
  });

  test("robôs, pré-carregamento e HEAD não registram contato nem veem o telefone", async ({
    request,
  }) => {
    const bot = await request.get(`/r/${CODE}`, {
      maxRedirects: 0,
      headers: { "user-agent": "facebookexternalhit/1.1" },
    });
    expect(bot.status()).toBe(302);
    expect(bot.headers()["location"]).toBe(`/anuncio/${SLUG}`);
    expect(bot.headers()["x-robots-tag"]).toContain("noindex");

    const prefetch = await request.get(`/r/${CODE}`, {
      maxRedirects: 0,
      headers: { "sec-purpose": "prefetch" },
    });
    expect(prefetch.status()).toBe(204);
    expect((await request.head(`/r/${CODE}`)).status()).toBe(204);

    const unknown = await request.get("/r/zz9999", { maxRedirects: 0 });
    expect(unknown.headers()["location"]).toBe("/busca");
  });

  test("o link curto da mensagem leva ao anúncio; robots.txt bloqueia /r/", async ({ request }) => {
    const short = await request.get(`/a/${CODE}`, { maxRedirects: 0 });
    expect(short.status()).toBe(302);
    expect(short.headers()["location"]).toBe(`/anuncio/${SLUG}`);

    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /r/");
  });
});
