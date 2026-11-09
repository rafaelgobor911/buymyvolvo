import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Automated accessibility check (axe, WCAG 2.1 A/AA) on the public pages, in
 * light and dark themes. It does not replace a manual review (keyboard,
 * screen reader), but catches contrast, names, labels and landmarks.
 */
const PAGES = [
  "/",
  "/busca?q=xc60",
  "/busca?q=nada+encontrado+aqui",
  "/volvo",
  "/volvo/xc60",
  "/volvo/xc60/t8/sp",
  "/anuncio/volvo-xc90-t8-inscription-2020-sao-paulo-sp-d36",
  "/anuncio/volvo-xc90-t8-inscription-2020-sao-paulo-sp-d36/remover",
  "/termos",
  "/privacidade",
  "/vendedor/entrar",
  "/admin/entrar",
];

for (const theme of ["light", "dark"] as const) {
  test.describe(`Acessibilidade (${theme === "light" ? "claro" : "escuro"})`, () => {
    test.use({ colorScheme: theme });

    for (const path of PAGES) {
      test(path, async ({ page }) => {
        await page.goto(path, { waitUntil: "networkidle" });
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        const summary = results.violations.map((v) => ({
          rule: v.id,
          impact: v.impact,
          targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
        }));
        expect(summary).toEqual([]);
      });
    }
  });
}

const violations = async (page: import("@playwright/test").Page) =>
  (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  ).violations.map((v) => ({
    rule: v.id,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
  }));

test.describe("Acessibilidade: banner e áreas logadas", () => {
  test.describe("banner de cookies aberto", () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test("home com o banner", async ({ page }) => {
      await page.route("https://www.googletagmanager.com/**", (r) => r.abort());
      await page.goto("/", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Personalizar" }).click();
      expect(await violations(page)).toEqual([]);
    });
  });

  test("admin (login de teste)", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "The admin is used on desktop.");
    await page.goto("/admin/entrar");
    await page.getByRole("button", { name: "Entrar como admin de teste" }).click();
    for (const path of ["/admin", "/admin/moderacao", "/admin/anuncios", "/admin/leads"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      expect({ path, violations: await violations(page) }).toEqual({ path, violations: [] });
    }
  });
});
