import { expect, type Page, test } from "@playwright/test";

const LISTING = "/anuncio/volvo-xc90-t8-inscription-2020-sao-paulo-sp-d36";

// These tests start with no cookie choice (the config pre-sets "recusar" for the others).
test.use({ storageState: { cookies: [], origins: [] } });

/** Records requests to Google's tag and answers them locally (no real network). */
async function watchGoogle(page: Page) {
  const requests: string[] = [];
  await page.route("https://www.googletagmanager.com/**", (route) => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: "text/javascript", body: "" });
  });
  return requests;
}

const dataLayer = (page: Page) =>
  page.evaluate(() =>
    ((window as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((args) =>
      Array.from(args),
    ),
  );

test.describe("Cookies e Google Analytics", () => {
  test("nada do Google antes do consentimento; recusar mantém assim", async ({ page }) => {
    const google = await watchGoogle(page);
    await page.goto("/", { waitUntil: "networkidle" });
    const banner = page.getByRole("region", { name: "Cookies e privacidade" });
    await expect(banner).toBeVisible();
    expect(google).toEqual([]);
    await banner.getByRole("button", { name: "Recusar" }).click();
    await expect(banner).toBeHidden();
    await page.reload({ waitUntil: "networkidle" });
    await expect(banner).toBeHidden();
    expect(google).toEqual([]);
  });

  test("aceitar carrega o Google tag e envia view_item e generate_lead", async ({ page }) => {
    const google = await watchGoogle(page);
    await page.goto(LISTING, { waitUntil: "networkidle" });
    await page
      .getByRole("region", { name: "Cookies e privacidade" })
      .getByRole("button", { name: "Aceitar todos" })
      .click();
    await expect.poll(() => google.length).toBe(1);
    expect(google[0]).toContain("gtag/js?id=G-E2ETEST000");

    const layer = await dataLayer(page);
    expect(layer).toContainEqual([
      "consent",
      "update",
      expect.objectContaining({ analytics_storage: "granted", ad_storage: "denied" }),
    ]);
    expect(layer).toContainEqual(["config", "G-E2ETEST000"]);
    // The view fired before the choice is sent once consent is given.
    expect(layer).toContainEqual([
      "event",
      "view_item",
      expect.objectContaining({
        currency: "BRL",
        items: [expect.objectContaining({ item_brand: "Volvo", item_category: "XC90" })],
      }),
    ]);

    // Contact click (navigation blocked so the dataLayer can be read).
    const leadEvent = await page.evaluate(() => {
      const link = document.querySelector<HTMLAnchorElement>('a[data-track="generate_lead"]')!;
      link.addEventListener("click", (e) => e.preventDefault());
      link.click();
      const layer = (window as unknown as { dataLayer: ArrayLike<unknown>[] }).dataLayer;
      return Array.from(layer[layer.length - 1]!);
    });
    expect(leadEvent).toEqual([
      "event",
      "generate_lead",
      expect.objectContaining({ lead_source: "whatsapp", listing_id: expect.any(String) }),
    ]);
  });

  test("o rodapé reabre as preferências", async ({ page }) => {
    await watchGoogle(page);
    await page.goto("/termos", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Recusar" }).click();
    await page.getByRole("button", { name: "Preferências de cookies" }).click();
    const banner = page.getByRole("region", { name: "Cookies e privacidade" });
    await expect(banner.getByLabel(/Medição/)).not.toBeChecked();
    await banner.getByLabel(/Medição/).check();
    await banner.getByRole("button", { name: "Salvar escolhas" }).click();
    await expect(banner).toBeHidden();
    const stored = await page.evaluate(() => localStorage.getItem("bmv-consent"));
    expect(JSON.parse(stored!)).toMatchObject({ v: "1:analytics", analytics: true, ads: false });
  });
});
