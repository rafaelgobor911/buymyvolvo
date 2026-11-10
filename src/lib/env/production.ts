import { databaseUrlProblem } from "./database-url";

/**
 * Settings a Vercel production deployment must (and must not) have. Checked by
 * next.config.ts when VERCEL_ENV=production: a wrong setting fails the build
 * instead of going live. Pure; reads only the object it gets.
 */
export function productionProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  const set = (key: string) => !!env[key]?.trim();
  const siteUrl = env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  if (!/^https:\/\/[^/]+$/.test(siteUrl.replace(/\/+$/, ""))) {
    problems.push("NEXT_PUBLIC_SITE_URL must be the https address of the site (no path).");
  }
  if (["true", "1"].includes(env.NEXT_PUBLIC_DEMO_MODE?.trim() ?? "")) {
    problems.push("NEXT_PUBLIC_DEMO_MODE must be off in production.");
  }
  for (const key of ["ADMIN_TEST_LOGIN_EMAIL", "SELLER_TEST_LOGIN_EMAIL"]) {
    if (set(key)) problems.push(`${key} must not be set in production.`);
  }
  for (const key of ["DATABASE_URL", "HASH_SALT", "CRON_SECRET", "ADMIN_EMAILS"]) {
    if (!set(key)) problems.push(`${key} is required in production.`);
  }
  const dbProblem = set("DATABASE_URL") ? databaseUrlProblem(env.DATABASE_URL!) : null;
  if (dbProblem) problems.push(`DATABASE_URL: ${dbProblem}`);
  for (const key of ["HASH_SALT", "CRON_SECRET"]) {
    const value = env[key]?.trim() ?? "";
    if (value && (value.length < 32 || /not-a-secret|e2e|ci-only/i.test(value))) {
      problems.push(`${key} must be a long random value of its own (not a test value).`);
    }
  }
  return problems;
}
