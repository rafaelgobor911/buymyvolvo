/**
 * A FICTITIOUS Instagram for development and tests: shops, posts, hashtags and
 * token answers served through the same Transport as the real Graph API, with
 * the response and error shapes observed on the real API (nov/2026).
 *
 * Phones use DDD 20 (does not exist), usernames end in ".demo", media IDs start
 * with "fx" and permalinks use codes Instagram never generates, so nothing here
 * points to a real person or post. Each call to createFixtureWorld() returns a
 * fresh copy that tests may mutate (edit a caption, delete a post).
 */
import type { GraphRequest, GraphResponse, Transport } from "./graph";

export interface FixturePost {
  id: string;
  caption: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  /** ISO timestamp. */
  timestamp: string;
}

export interface FixtureAccount {
  igId: string;
  username: string;
  name: string;
  biography: string;
  website?: string;
  /** Newest first. */
  posts: FixturePost[];
}

export interface FixtureFailure {
  /** Substring matched against "path?param=value&…". */
  match: string;
  status: number;
  error: { message: string; code: number; error_subcode?: number; is_transient?: boolean };
  times: number;
}

export interface FixtureWorld {
  now: Date;
  igUserId: string;
  accounts: Record<string, FixtureAccount>;
  /** Usernames that exist but are personal or age-gated (the API answers 110). */
  unavailable: string[];
  hashtags: Record<string, { id: string; posts: FixturePost[] }>;
  /** Hashtag IDs queried in the current window (recently_searched_hashtags). */
  searched: string[];
  token: { valid: boolean; expiresInDays: number | null; scopes: string[] };
  failures: FixtureFailure[];
  /** Simulates a hashtag cursor that never changes. */
  repeatHashtagCursor: boolean;
  calls: number;
}

export const FIXTURE_IG_USER_ID = "fx_ig_buymyvolvo";

export const fixturePermalink = (id: string) => `https://www.instagram.com/p/FIXTURE_${id}/`;

const HOUR = 3_600_000;

// --- Data -------------------------------------------------------------------

/** [model, version, year_fab, year_model, km, price] */
type Car = [string, string, number, number, number, number];

const NORDICA_CARS: Car[] = [
  ["XC60", "T8 Inscription", 2020, 2021, 41_000, 239_900],
  ["XC40", "T5 R-Design", 2019, 2020, 52_000, 159_900],
  ["XC90", "T6 Momentum", 2017, 2017, 78_000, 215_000],
  ["S60", "T5 Momentum", 2018, 2019, 48_000, 165_000],
  ["V60", "T5 Momentum", 2017, 2017, 64_000, 115_000],
  ["XC40", "Recharge Pure Electric P8", 2022, 2022, 28_000, 189_000],
  ["EX30", "Ultra Twin Motor Performance", 2025, 2025, 5_000, 239_000],
  ["C40", "Recharge Twin", 2023, 2023, 21_000, 205_000],
  ["XC60", "D5 Inscription", 2017, 2018, 96_000, 149_900],
  ["XC90", "T8 R-Design", 2020, 2021, 38_000, 365_000],
  ["V40", "T4 R-Design", 2016, 2016, 68_000, 92_000],
  ["S90", "T8 Inscription", 2019, 2019, 48_000, 260_000],
  ["XC60", "T5 Dynamic", 2013, 2013, 102_000, 85_000],
  ["XC40", "T4 Momentum", 2019, 2020, 46_000, 135_000],
  ["XC90", "D5 Inscription", 2018, 2019, 95_000, 265_000],
  ["XC60", "T8 Polestar Engineered", 2021, 2022, 18_000, 329_000],
  ["EX40", "Plus Single Motor", 2025, 2025, 9_000, 219_000],
  ["V40 Cross Country", "T5", 2018, 2018, 39_000, 129_000],
  ["S60", "T8 Polestar Engineered", 2020, 2020, 33_000, 259_000],
  ["XC90", "T8 Ultimate Dark", 2024, 2024, 15_000, 420_000],
  ["XC60", "T8 Ultra", 2025, 2025, 7_000, 389_000],
  ["C30", "T5", 2010, 2010, 92_000, 55_000],
  ["S40", "T5", 2009, 2009, 110_000, 42_000],
  ["XC40", "T5 Inscription", 2020, 2020, 35_000, 172_000],
];

const brl = (n: number) => n.toLocaleString("pt-BR");
const two = (n: number) => String(n).padStart(2, "0");

function shopCaption(car: Car, i: number, place: string, phone: string): string {
  const [model, version, fab, year, km, price] = car;
  switch (i % 3) {
    case 0:
      return `🚘 VOLVO ${model.toUpperCase()} ${version.toUpperCase()} ${fab}/${year}\n✅ ${brl(km)} km\n✅ Revisões em dia\n💰 R$ ${brl(price)}\nAceito troca e financio.\n📲 Chama no direct ou WhatsApp ${phone}\n📍 ${place}\n#volvo #seminovos`;
    case 1:
      return `${model} ${version} ${year} — ${Math.round(km / 1000)} mil km — R$ ${brl(price)} — ${place}. Financiamos em até 60x. ${phone}`;
    default:
      return `Oportunidade! ${model} ${version} modelo ${year}, ${brl(km)} km, impecável. Valor: ${Math.round(price / 1000)} mil. ${place}. Consulte condições no direct.`;
  }
}

function shopPosts(
  prefix: string,
  cars: Car[],
  place: string,
  phone: string,
  now: Date,
  extra: Array<{ at: number; caption: string }> = [],
): FixturePost[] {
  const posts = cars.map((car, i) => ({
    id: `fxm_${prefix}_${two(i + 1)}`,
    caption: shopCaption(car, i, place, phone),
    media_type: (i % 4 === 1
      ? "VIDEO"
      : i % 4 === 2
        ? "CAROUSEL_ALBUM"
        : "IMAGE") as FixturePost["media_type"],
    timestamp: new Date(now.getTime() - (i + 1) * 9 * HOUR).toISOString(),
  }));
  extra.forEach((e, i) =>
    posts.push({
      id: `fxm_${prefix}_x${i + 1}`,
      caption: e.caption,
      media_type: "IMAGE",
      timestamp: new Date(now.getTime() - e.at * HOUR).toISOString(),
    }),
  );
  return posts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function createFixtureWorld(now = new Date()): FixtureWorld {
  const hoursAgo = (h: number) => new Date(now.getTime() - h * HOUR).toISOString();
  return {
    now,
    igUserId: FIXTURE_IG_USER_ID,
    accounts: {
      "nordica.veiculos.demo": {
        igId: "fxa_nordica",
        username: "nordica.veiculos.demo",
        name: "Nórdica Veículos (demo)",
        biography:
          "Seminovos Volvo em Curitiba-PR 🇸🇪 Financiamos e aceitamos troca. WhatsApp (20) 3000-0100",
        website: "https://example.com/nordica",
        posts: shopPosts("nordica", NORDICA_CARS, "Curitiba/PR", "(20) 3000-0100", now, [
          {
            at: 4,
            caption: "Bom dia! Hoje a loja abre às 9h. Venha tomar um café com a gente ☕ #volvo",
          },
          {
            at: 30,
            caption: "Mais um XC60 entregue ✅ VENDIDO! Obrigado pela confiança, Paulo! #vendido",
          },
        ]),
      },
      "fiorde.motors.demo": {
        igId: "fxa_fiorde",
        username: "fiorde.motors.demo",
        name: "Fiorde Motors (demo)",
        biography: "Volvo seminovos | São Paulo - SP | Financiamos",
        posts: shopPosts(
          "fiorde",
          [
            ["XC60", "T5 Momentum", 2018, 2019, 61_000, 159_900],
            ["XC90", "T8 Inscription", 2021, 2022, 29_000, 389_000],
            ["XC40", "T5 R-Design", 2020, 2021, 33_000, 169_900],
            ["S60", "T5 R-Design", 2019, 2020, 40_000, 179_900],
            ["EX30", "Core Single Motor", 2024, 2025, 12_000, 199_000],
          ],
          "São Paulo/SP",
          "(20) 3000-0200",
          now,
        ),
      },
      "skandi.garage.demo": {
        igId: "fxa_skandi",
        username: "skandi.garage.demo",
        name: "Skandi Garage (demo)",
        biography: "Volvo clássicos e seminovos. Belo Horizonte/MG",
        posts: shopPosts(
          "skandi",
          [
            ["850", "T-5R", 1995, 1995, 180_000, 89_900],
            ["V70", "T5", 2004, 2004, 160_000, 39_900],
          ],
          "Belo Horizonte/MG",
          "(20) 3000-0300",
          now,
        ),
      },
    },
    unavailable: ["perfil.pessoal.demo"],
    hashtags: {
      volvoavenda_demo: {
        id: "fxh_volvoavenda",
        posts: [
          {
            id: "fxm_tag_01",
            caption:
              "Vendo meu XC60 T5 Momentum 2018, 72 mil km, revisado. R$ 139.000. Particular, Porto Alegre-RS. Zap (20) 90000-0201 #volvoavenda",
            media_type: "IMAGE",
            timestamp: hoursAgo(2),
          },
          {
            id: "fxm_tag_02",
            caption:
              "XC40 T4 Momentum 2020, 41 mil km, R$ 149.900. Campinas SP. Chama (20) 90000-0202 #volvoavenda #volvoseminovo",
            media_type: "CAROUSEL_ALBUM",
            timestamp: hoursAgo(5),
          },
          {
            id: "fxm_tag_03",
            caption: "2019 Volvo XC60 T8 for sale! 30k miles, $38,000. DM for details #volvoavenda",
            media_type: "IMAGE",
            timestamp: hoursAgo(7),
          },
          {
            id: "fxm_tag_04",
            caption: "Encontro de Volvos domingo no parque! Tragam seus suecos 🇸🇪 #volvoavenda",
            media_type: "IMAGE",
            timestamp: hoursAgo(9),
          },
        ],
      },
      volvoseminovo_demo: {
        id: "fxh_volvoseminovo",
        posts: [
          {
            id: "fxm_tag_05",
            caption:
              "S60 T5 Momentum 2019, 48 mil km, R$ 159.900. Florianópolis SC. (20) 90000-0203 #volvoseminovo",
            media_type: "IMAGE",
            timestamp: hoursAgo(3),
          },
          {
            id: "fxm_tag_06",
            caption: "V40 T4 2015, 98 mil km, R$ 69.900 (20) 90000-0204 #volvoseminovo",
            media_type: "IMAGE",
            // Older than 24h: recent_media must not return it.
            timestamp: hoursAgo(40),
          },
        ],
      },
    },
    searched: [],
    token: {
      valid: true,
      expiresInDays: 50,
      scopes: [
        "pages_show_list",
        "pages_read_engagement",
        "instagram_basic",
        "instagram_manage_insights",
        "business_management",
        "ads_read",
        "public_profile",
      ],
    },
    failures: [],
    repeatHashtagCursor: false,
    calls: 0,
  };
}

// --- Transport --------------------------------------------------------------

const headers = (world: FixtureWorld) =>
  new Headers({
    "x-app-usage": JSON.stringify({
      call_count: Math.min(100, world.calls),
      total_cputime: 0,
      total_time: Math.min(100, world.calls),
    }),
  });

const ok = (world: FixtureWorld, body: unknown): GraphResponse => ({
  status: 200,
  body,
  headers: headers(world),
});

const fail = (
  world: FixtureWorld,
  status: number,
  error: FixtureFailure["error"],
): GraphResponse => ({
  status,
  body: { error: { type: "OAuthException", fbtrace_id: "FIXTURE", ...error } },
  headers: headers(world),
});

const media = (p: FixturePost) => ({ ...p, permalink: fixturePermalink(p.id) });

function businessDiscovery(world: FixtureWorld, fields: string): GraphResponse {
  const username = /business_discovery\.username\(([^)]+)\)/.exec(fields)?.[1] ?? "";
  const account = world.accounts[username];
  if (!account) {
    return fail(world, 400, {
      message: "Invalid user id",
      code: 110,
      error_subcode: 2207013,
      is_transient: false,
    });
  }
  const after = /media\.after\(([^)]+)\)/.exec(fields)?.[1];
  const limit = Number(/\.limit\((\d+)\)/.exec(fields)?.[1] ?? 25);
  const offset = after ? Number(after.replace("fxc_", "")) || 0 : 0;
  const page = account.posts.slice(offset, offset + limit);
  const more = offset + limit < account.posts.length;
  const cursors: Record<string, string> = {};
  if (offset > 0) cursors.before = `fxc_${offset}`;
  if (more) cursors.after = `fxc_${offset + limit}`;
  const bd: Record<string, unknown> = {
    id: account.igId,
    media: { data: page.map(media), paging: { cursors } },
  };
  if (fields.includes("biography")) {
    Object.assign(bd, {
      username: account.username,
      name: account.name,
      biography: account.biography,
      website: account.website,
      media_count: account.posts.length,
    });
  }
  return ok(world, { business_discovery: bd, id: world.igUserId });
}

function hashtagByName(world: FixtureWorld, q: string) {
  return world.hashtags[q.toLowerCase().replace(/^#/, "")];
}

function markSearched(world: FixtureWorld, id: string) {
  if (!world.searched.includes(id)) world.searched.push(id);
}

function recentMedia(world: FixtureWorld, tagId: string, after?: string): GraphResponse {
  const tag = Object.values(world.hashtags).find((h) => h.id === tagId);
  if (!tag)
    return fail(world, 400, { message: "Unsupported get request.", code: 100, error_subcode: 33 });
  markSearched(world, tag.id);
  const since = world.now.getTime() - 24 * HOUR;
  const recent = tag.posts.filter((p) => new Date(p.timestamp).getTime() >= since);
  const offset = after && !world.repeatHashtagCursor ? Number(after.replace("fxt_", "")) || 0 : 0;
  const page = recent.slice(offset, offset + 50);
  const cursor = world.repeatHashtagCursor ? "fxt_same" : `fxt_${offset + 50}`;
  return ok(world, { data: page.map(media), paging: { cursors: { after: cursor } } });
}

function debugToken(world: FixtureWorld): GraphResponse {
  const nowS = Math.floor(world.now.getTime() / 1000);
  const t = world.token;
  return ok(world, {
    data: {
      app_id: "fx_app",
      type: "USER",
      application: "Buy My Volvo (fixtures)",
      is_valid: t.valid,
      expires_at: t.expiresInDays == null ? 0 : nowS + t.expiresInDays * 86_400,
      data_access_expires_at: nowS + 90 * 86_400,
      scopes: t.scopes,
      ...(t.valid ? {} : { error: { code: 190, message: "Error validating access token." } }),
    },
  });
}

function route(world: FixtureWorld, { path, params }: GraphRequest): GraphResponse {
  if (path === world.igUserId && params.fields?.startsWith("business_discovery.")) {
    return businessDiscovery(world, params.fields);
  }
  if (path === "ig_hashtag_search") {
    const tag = hashtagByName(world, params.q ?? "");
    if (tag) markSearched(world, tag.id);
    return ok(world, { data: tag ? [{ id: tag.id }] : [] });
  }
  const recent = /^([^/]+)\/recent_media$/.exec(path);
  if (recent) return recentMedia(world, recent[1]!, params.after);
  if (path === `${world.igUserId}/recently_searched_hashtags`) {
    return ok(world, { data: world.searched.map((id) => ({ id })) });
  }
  if (path === "debug_token") return debugToken(world);
  if (path === "me/accounts") {
    return ok(world, {
      data: [
        {
          name: "Buy My Volvo",
          instagram_business_account: { id: world.igUserId, username: "buymyvolvo" },
        },
      ],
    });
  }
  return fail(world, 400, {
    message: `Unsupported get request: ${path}`,
    code: 100,
    error_subcode: 33,
  });
}

/** Transport that answers from the fixture world (and records calls). */
export function fixtureTransport(world: FixtureWorld): Transport {
  return async (request) => {
    world.calls++;
    const key = `${request.path}?${new URLSearchParams(request.params).toString()}`;
    const decoded = decodeURIComponent(key);
    const failure = world.failures.find(
      (f) => f.times > 0 && (key.includes(f.match) || decoded.includes(f.match)),
    );
    if (failure) {
      failure.times--;
      return fail(world, failure.status, failure.error);
    }
    return route(world, request);
  };
}
