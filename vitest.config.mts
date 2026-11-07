import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Integration tests run against TEST_DATABASE_URL (a disposable local database).
const env = loadEnv("test", process.cwd(), "");
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? env.TEST_DATABASE_URL;

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws when imported outside a React Server Component bundle;
      // in unit tests we are on the server anyway, so replace it with an empty module.
      "server-only": fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    clearMocks: true,
    globalSetup: ["./tests/integration/global-setup.ts"],
    env: testDatabaseUrl
      ? { TEST_DATABASE_URL: testDatabaseUrl, DATABASE_URL: testDatabaseUrl }
      : { DATABASE_URL: "" },
    // Integration tests share one database: run files sequentially.
    fileParallelism: false,
  },
});
