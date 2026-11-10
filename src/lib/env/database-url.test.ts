import { describe, expect, it } from "vitest";

import { databaseUrlProblem } from "./database-url";
import { productionProblems } from "./production";
import { parseServerEnv } from "./schema";

const GOOD =
  "postgresql://postgres.abcdefgh:SenhaForte123@aws-0-us-east-1.pooler.supabase.com:5432/postgres";

describe("databaseUrlProblem", () => {
  it("accepts a Supabase or local connection string", () => {
    expect(databaseUrlProblem(GOOD)).toBeNull();
    expect(databaseUrlProblem(`${GOOD}\n`)).toBeNull();
    expect(databaseUrlProblem("postgresql://postgres@127.0.0.1:5432/buymyvolvo")).toBeNull();
  });

  it("explains the usual paste mistakes, never echoing the value", () => {
    const cases: Array<[string, RegExp]> = [
      [`"${GOOD}"`, /aspas/],
      [`DATABASE_URL=${GOOD}`, /sem o nome da variável/],
      ["psql -h aws-0-us-east-1.pooler.supabase.com -p 5432 -U postgres", /comando do psql/],
      ["mysql://u:p@h/db", /começar com "postgresql:\/\/"/],
      [GOOD.replace("SenhaForte123", "[YOUR-PASSWORD]"), /\[YOUR-PASSWORD\]/],
      [GOOD.replace("SenhaForte123", "abc#123"), /caracteres especiais/],
      [GOOD.replace("SenhaForte123", "abc/123"), /caracteres especiais/],
      [GOOD.replace("SenhaForte123", "abc 123"), /espaços/],
    ];
    for (const [value, message] of cases) {
      const problem = databaseUrlProblem(value);
      expect(problem, value).toMatch(message);
      expect(problem).not.toContain("SenhaForte123");
    }
  });
});

describe("pasted values with spaces or line breaks", () => {
  it("are trimmed by the env schema", () => {
    const env = parseServerEnv({
      CRON_SECRET: `${"c".repeat(48)}\n`,
      HASH_SALT: `  ${"h".repeat(48)}  `,
      DATABASE_URL: `${GOOD}\r\n`,
    });
    expect(env.CRON_SECRET).toBe("c".repeat(48));
    expect(env.HASH_SALT).toBe("h".repeat(48));
    expect(env.DATABASE_URL).toBe(GOOD);
  });

  it("a malformed DATABASE_URL fails with the explanation", () => {
    expect(() => parseServerEnv({ DATABASE_URL: GOOD.replace("SenhaForte123", "a#b") })).toThrow(
      /DATABASE_URL: a senha parece ter caracteres especiais/,
    );
    expect(
      productionProblems({
        NEXT_PUBLIC_SITE_URL: "https://buymyvolvo.com.br",
        DATABASE_URL: `"${GOOD}"`,
        HASH_SALT: "a".repeat(48),
        CRON_SECRET: `${"b".repeat(48)}\n`,
        ADMIN_EMAILS: "dono@example.com",
        ANTHROPIC_API_KEY: "sk-ant-test",
      }),
    ).toEqual(["DATABASE_URL: remova as aspas do começo e do fim do valor."]);
  });
});
