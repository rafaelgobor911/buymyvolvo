import { z } from "zod";

/** Treats empty strings (e.g. `FOO=` in a .env file) as "not set". */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(blankToUndefined, z.string().min(1).optional());
const optionalSecret = z.preprocess(blankToUndefined, z.string().min(32).optional());
const optionalUrl = z.preprocess(blankToUndefined, z.url().optional());

export const DEFAULT_SITE_NAME = "[NOME_DO_SITE]";
export const DEFAULT_SITE_URL = "http://localhost:3000";
export const DEFAULT_EXTRACTION_MODEL = "claude-haiku-5-5";
export const DEFAULT_GRAPH_VERSION = "v27.0";

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_NAME: z.preprocess(
    blankToUndefined,
    z.string().min(1).default(DEFAULT_SITE_NAME),
  ),
  NEXT_PUBLIC_SITE_URL: z.preprocess(
    blankToUndefined,
    z
      .url()
      .default(DEFAULT_SITE_URL)
      .transform((url) => url.replace(/\/+$/, "")),
  ),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  /** Shows the "fictitious data" banner and disables real contact buttons. */
  NEXT_PUBLIC_DEMO_MODE: z.preprocess(
    blankToUndefined,
    z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((v) => v === "true" || v === "1"),
  ),
});

export const serverEnvSchema = z.object({
  /** Postgres connection string. On Supabase, use the pooler URL (transaction mode). */
  DATABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL_EXTRACTION: z.preprocess(
    blankToUndefined,
    z.string().min(1).default(DEFAULT_EXTRACTION_MODEL),
  ),
  META_APP_ID: optionalString,
  META_APP_SECRET: optionalString,
  META_GRAPH_VERSION: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^v\d+\.\d+$/, "Use the format vNN.N, e.g. v27.0")
      .default(DEFAULT_GRAPH_VERSION),
  ),
  IG_BUSINESS_USER_ID: optionalString,
  IG_LONG_LIVED_TOKEN: optionalString,
  CRON_SECRET: optionalSecret,
  ADMIN_EMAILS: z.preprocess(
    blankToUndefined,
    z
      .string()
      .optional()
      .transform((raw) =>
        (raw ?? "")
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      )
      .pipe(z.array(z.email())),
  ),
  HASH_SALT: optionalSecret,
  /**
   * Test-only admin login (e2e, screenshots): signs in as this e-mail without
   * Google. Works only with NEXT_PUBLIC_DEMO_MODE on and outside Vercel
   * production; never set it in a deployed environment.
   */
  ADMIN_TEST_LOGIN_EMAIL: z.preprocess(blankToUndefined, z.email().toLowerCase().optional()),
  /** Set by Vercel: "production", "preview" or "development". */
  VERCEL_ENV: z.preprocess(blankToUndefined, z.string().optional()),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
}

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvError(`Invalid public environment variables:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvError(`Invalid server environment variables:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

type RequiredKeys<T> = { [K in keyof T]-?: Exclude<T[K], undefined> };

/**
 * Narrows an env object, throwing a clear error listing every missing key.
 * Use at the entry point of a feature (e.g. `requireKeys(serverEnv(), ["ANTHROPIC_API_KEY"])`).
 */
export function requireKeys<T extends object, K extends keyof T>(
  env: T,
  keys: readonly K[],
): T & RequiredKeys<Pick<T, K>> {
  const missing = keys.filter((key) => {
    const value = env[key];
    return value === undefined || (Array.isArray(value) && value.length === 0);
  });
  if (missing.length > 0) {
    throw new EnvError(
      `Missing required environment variables: ${missing.map(String).join(", ")}. See .env.example.`,
    );
  }
  return env as T & RequiredKeys<Pick<T, K>>;
}
