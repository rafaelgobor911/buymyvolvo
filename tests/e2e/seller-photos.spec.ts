import { expect, test } from "@playwright/test";
import sharp from "sharp";

const SLUG = "volvo-c40-twin-motor-2023-sao-paulo-sp-d28";

test("vendedor edita o anúncio e envia fotos; a página mostra a galeria", async ({
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop", "Writes run once, on desktop.");
  test.setTimeout(90_000);

  // Claim the listing and have the admin approve it.
  const sellerContext = await browser.newContext();
  const seller = await sellerContext.newPage();
  await seller.goto(`/vendedor/entrar?next=${encodeURIComponent(`/anuncio/${SLUG}/reivindicar`)}`);
  await seller.getByRole("button", { name: "Entrar como vendedor de teste" }).click();
  await expect(seller).toHaveURL(/reivindicar$/);
  await seller.waitForLoadState("networkidle");
  await seller.getByLabel("Nome (seu ou da loja)").fill("Loja Teste Fotos");
  await seller.getByLabel(/Li e aceito/).check();
  await seller.getByRole("button", { name: "Reivindicar anúncio" }).click();
  const code = (await seller.locator("p.font-mono").innerText()).trim();

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto("/admin/entrar");
  await admin.getByRole("button", { name: "Entrar como admin de teste" }).click();
  await expect(admin.getByRole("heading", { name: "Início" })).toBeVisible();
  await admin.goto("/admin/reivindicacoes", { waitUntil: "networkidle" });
  await admin
    .getByRole("listitem")
    .filter({ hasText: code })
    .getByRole("button", { name: "Aprovar" })
    .click();
  await expect(admin.getByRole("listitem").filter({ hasText: code })).toContainText("Aprovada");

  // Edit page: data and photos.
  await seller.goto("/vendedor", { waitUntil: "networkidle" });
  await expect(seller.getByRole("heading", { name: /Seu plano: Gratuito/ })).toBeVisible();
  await seller
    .getByRole("article")
    .filter({ hasText: "C40 Twin Motor 2023" })
    .getByRole("link", { name: "Editar dados e fotos" })
    .click();
  await seller.waitForLoadState("networkidle");
  await seller
    .getByLabel("Descrição")
    .fill("Revisões em dia na concessionária.\nBateria com garantia.");
  await seller.getByLabel("Preço (R$)").fill("199.900");
  await seller.getByRole("button", { name: "Salvar dados" }).click();
  await expect(seller.getByText("Alterações salvas.")).toBeVisible();

  const photo = await sharp({
    create: { width: 1600, height: 1200, channels: 3, background: "#2f4a6d" },
  })
    .jpeg()
    .toBuffer();
  const input = seller.locator('input[type="file"]');
  await expect(input).toBeDisabled();
  await seller.getByLabel(/Declaro que as fotos são minhas/).check();
  await input.setInputFiles({ name: "c40.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect(seller.getByText("c40.jpg: enviada")).toBeVisible({ timeout: 20_000 });
  await expect(seller.getByRole("heading", { name: "Fotos (1 de 15)" })).toBeVisible();

  // Public page and search card.
  await seller.goto(`/anuncio/${SLUG}`);
  await expect(seller.getByRole("img", { name: /foto 1 de 1/ })).toBeVisible();
  await expect(seller.getByText("Revisões em dia na concessionária.")).toBeVisible();
  await expect(seller.getByText("Descrição escrita pelo vendedor.")).toBeVisible();
  await expect(seller.getByText("R$ 199.900").first()).toBeVisible();
  await seller.goto("/busca?q=c40");
  const card = seller.locator(`main article:has(a[href="/anuncio/${SLUG}"])`);
  await expect(card.locator("img")).toHaveCount(1);

  await sellerContext.close();
  await adminContext.close();
});
