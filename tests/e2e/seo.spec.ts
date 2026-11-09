import { expect, test } from "@playwright/test";

const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const LISTING = "/anuncio/volvo-xc90-t8-inscription-2020-sao-paulo-sp-d36";

/** The <head> a crawler gets in the first HTML (metadata is blocking for bots). */
async function crawlerHead(request: import("@playwright/test").APIRequestContext, path: string) {
  const response = await request.get(path, { headers: { "User-Agent": GOOGLEBOT } });
  const html = await response.text();
  return { status: response.status(), head: html.slice(0, html.indexOf("</head>")), html };
}

test.describe("SEO", () => {
  test("página de modelo: dados, faixa de preço e links internos", async ({ page }) => {
    await page.goto("/volvo/xc60");
    await expect(page.getByRole("heading", { level: 1, name: "Volvo XC60 à venda" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Faixa de preços pedidos" })).toBeVisible();
    await expect(page.getByText(/não uma tabela de referência \(como a FIPE\)/)).toBeVisible();
    await page.getByRole("link", { name: /^T8 \d+$/ }).click();
    await expect(page).toHaveURL(/\/volvo\/xc60\/t8$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Volvo XC60 T8 à venda" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegação estrutural" })).toContainText(
      "Volvo à venda/XC60/T8",
    );
  });

  test("caminhos inválidos dão 404 e maiúsculas, 308", async ({ request }) => {
    expect((await request.get("/volvo/xc60/zz")).status()).toBe(404);
    expect((await request.get("/volvo/xc61")).status()).toBe(404);
    const redirect = await request.get("/volvo/XC60/T8", { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toMatch(/\/volvo\/xc60\/t8$/);
  });

  test("robôs recebem canonical, descrição e noindex no <head>", async ({ request }) => {
    const model = await crawlerHead(request, "/volvo/xc60/t8/sp?utm_source=x");
    expect(model.head).toMatch(/<link rel="canonical" href="[^"]+\/volvo\/xc60\/t8\/sp"/);
    expect(model.head).toMatch(/<meta name="description" content="\d+ anúncios de Volvo XC60 T8/);
    expect(model.head).not.toContain('name="robots"');
    // Never sold here, no listings: rendered, but out of the index.
    const empty = await crawlerHead(request, "/volvo/v90");
    expect(empty.status).toBe(200);
    expect(empty.head).toContain('<meta name="robots" content="noindex, follow"/>');
    const search = await crawlerHead(request, "/busca?q=xc60");
    expect(search.head).toContain('<meta name="robots" content="noindex, follow"/>');
  });

  test("anúncio ativo tem Car + Offer em JSON-LD", async ({ request }) => {
    const { html } = await crawlerHead(request, LISTING);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(
      (m) => JSON.parse(m[1]!) as unknown,
    );
    const car = blocks.flat().find((b) => (b as { "@type"?: string })["@type"] === "Car");
    expect(car).toMatchObject({
      brand: { name: "Volvo" },
      model: "XC90",
      offers: { "@type": "Offer", priceCurrency: "BRL" },
    });
  });

  test("sitemap e robots.txt", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/volvo/xc60</loc>");
    expect(sitemap).toContain(`${LISTING}</loc>`);
    expect(sitemap).not.toContain("/busca");
    expect(sitemap).not.toContain("/volvo/v90<");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
    expect(robots).toContain("Disallow: /r/");
  });
});
