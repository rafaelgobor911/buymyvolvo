/**
 * npm run sources -- list
 * npm run sources -- add @loja1 @loja2 [--interval=180]
 * npm run sources -- add-hashtag volvoavenda [--interval=60]
 * npm run sources -- pause @loja1 | resume @loja1
 * npm run sources -- add-fixtures        (the fictitious shops and hashtags)
 *
 * Manages the monitored Instagram accounts and hashtags until the admin
 * screen exists (Phase 5).
 */
import { normalizeUsername } from "@/lib/instagram/api";
import { createFixtureWorld } from "@/lib/instagram/fixtures";

import { connect, loadLocalEnv } from "./db/lib";

const HASHTAG = /^[a-z0-9_]{2,100}$/;

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(hit.indexOf("=") + 1);
}

function normalizeHashtag(raw: string): string | null {
  const tag = raw.trim().replace(/^#/, "").toLowerCase();
  return HASHTAG.test(tag) ? tag : null;
}

async function main() {
  loadLocalEnv();
  const [command, ...rest] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const sql = connect(process.env.DATABASE_URL);
  try {
    const add = async (
      type: "ig_business_account" | "ig_hashtag",
      handles: string[],
      interval: number,
    ) => {
      for (const handle of handles) {
        const [row] = await sql<{ inserted: boolean }[]>`
          insert into public.sources (type, handle, poll_interval_minutes, active)
          values (${type}, ${handle}, ${interval}, true)
          on conflict (type, handle) do update set active = true
          returning (xmax = 0) as inserted`;
        console.log(`${row!.inserted ? "+" : "="} ${type === "ig_hashtag" ? "#" : "@"}${handle}`);
      }
    };
    const parse = (items: string[], fn: (s: string) => string | null) =>
      items.map((raw) => {
        const value = fn(raw);
        if (!value) throw new Error(`Valor inválido: ${raw}`);
        return value;
      });

    switch (command) {
      case "add":
        await add(
          "ig_business_account",
          parse(rest, normalizeUsername),
          Number(flag("interval") ?? 180),
        );
        break;
      case "add-hashtag":
        await add("ig_hashtag", parse(rest, normalizeHashtag), Number(flag("interval") ?? 60));
        break;
      case "add-fixtures": {
        const world = createFixtureWorld();
        await add(
          "ig_business_account",
          [...Object.keys(world.accounts), ...world.unavailable],
          180,
        );
        await add("ig_hashtag", Object.keys(world.hashtags), 60);
        break;
      }
      case "pause":
      case "resume": {
        for (const raw of rest) {
          const handle = raw.replace(/^[@#]/, "").toLowerCase();
          const rows = await sql`
            update public.sources set active = ${command === "resume"} where handle = ${handle} returning id`;
          console.log(
            rows.length
              ? `${command === "pause" ? "⏸" : "▶"} ${handle}`
              : `? ${handle} não encontrado`,
          );
        }
        break;
      }
      case "list":
      case undefined: {
        const rows = await sql<
          {
            type: string;
            handle: string;
            active: boolean;
            poll_interval_minutes: number;
            last_polled_at: Date | null;
            last_error: string | null;
            posts: number;
          }[]
        >`
          select s.type, s.handle, s.active, s.poll_interval_minutes, s.last_polled_at, s.last_error,
            (select count(*)::int from public.raw_posts rp where rp.source_id = s.id) as posts
          from public.sources s order by s.type, s.handle`;
        if (!rows.length)
          console.log("Nenhuma fonte cadastrada. Use: npm run sources -- add @loja");
        for (const r of rows) {
          const name = `${r.type === "ig_hashtag" ? "#" : "@"}${r.handle}`;
          const polled = r.last_polled_at
            ? r.last_polled_at.toISOString().slice(0, 16).replace("T", " ")
            : "nunca";
          console.log(
            `${r.active ? "▶" : "⏸"} ${name.padEnd(32)} a cada ${String(r.poll_interval_minutes).padStart(3)} min · última: ${polled} · ${r.posts} posts${r.last_error ? ` · erro: ${r.last_error}` : ""}`,
          );
        }
        break;
      }
      default:
        console.error("Comandos: list, add, add-hashtag, add-fixtures, pause, resume");
        process.exitCode = 2;
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
