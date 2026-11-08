import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

// Optional: point to a preinstalled Chromium (e.g. in sandboxes where
// `npx playwright install` is not available).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
const E2E_ADMIN = "admin.teste@example.com";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // CI runs against the production build; locally we reuse/start the dev server.
    command: process.env.CI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Throwaway test values: HASH_SALT for contact clicks; the admin test login
    // (works only with NEXT_PUBLIC_DEMO_MODE on, never in production).
    env: {
      HASH_SALT: process.env.HASH_SALT || "e2e-only-salt-not-a-secret-0000000000",
      ADMIN_EMAILS: [process.env.ADMIN_EMAILS, E2E_ADMIN].filter(Boolean).join(","),
      ADMIN_TEST_LOGIN_EMAIL: E2E_ADMIN,
      SELLER_TEST_LOGIN_EMAIL: "vendedor.teste@example.com",
      // Tests never talk to the real Supabase project (Google login shows as unavailable).
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    },
  },
});
