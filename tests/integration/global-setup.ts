import { loadEnv } from "vite";

import { connect, migrate, reset, seed } from "../../scripts/db/lib";

/** Rebuilds the disposable test database (local only) before the suite. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? loadEnv("test", process.cwd(), "").TEST_DATABASE_URL;
  if (!url) {
    console.warn("TEST_DATABASE_URL not set: database integration tests will be skipped.");
    return;
  }
  const sql = connect(url);
  const quiet = () => {};
  try {
    await reset(sql, url, quiet);
    await migrate(sql, quiet);
    await seed(sql, quiet);
  } finally {
    await sql.end();
  }
}
