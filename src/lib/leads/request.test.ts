import { describe, expect, it } from "vitest";

import { clickOrigin, clientIp, isBot, isPrefetch, saltedHash } from "./request";

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 355.0.0.0 (iPhone15,2; iOS 18_1; pt_BR; pt; scale=3.00)";
const CUBOT =
  "Mozilla/5.0 (Linux; Android 10; CUBOT X30 Build/QP1A) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";

describe("isBot", () => {
  it.each([
    ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
    ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"],
    ["WhatsApp/2.24.1.1 A"],
    ["TelegramBot (like TwitterBot)"],
    ["Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"],
    ["AdsBot-Google (+http://www.google.com/adsbot.html)"],
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/130.0 Safari/537.36"],
    ["curl/8.5.0"],
    ["python-requests/2.32"],
    [""],
  ])("bot: %s", (ua) => expect(isBot(ua)).toBe(true));

  it.each([[CHROME_ANDROID], [IPHONE_INSTAGRAM], [CUBOT]])("person: %s", (ua) =>
    expect(isBot(ua)).toBe(false),
  );

  it("treats a missing user agent as a bot", () => expect(isBot(null)).toBe(true));
});

describe("request details", () => {
  it("reads the first forwarded address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "200.1.2.3, 10.0.0.1" }))).toBe("200.1.2.3");
    expect(clientIp(new Headers({ "x-real-ip": "200.1.2.4" }))).toBe("200.1.2.4");
    expect(clientIp(new Headers())).toBeNull();
  });

  it("hashes with the salt and never returns the raw value", () => {
    const a = saltedHash("salt-a".repeat(6), "200.1.2.3");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("200.1.2.3");
    expect(saltedHash("salt-a".repeat(6), "200.1.2.3")).toBe(a);
    expect(saltedHash("salt-b".repeat(6), "200.1.2.3")).not.toBe(a);
    expect(saltedHash("salt-a".repeat(6), null)).toBeNull();
  });

  it("detects prefetches", () => {
    expect(isPrefetch(new Headers({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(isPrefetch(new Headers({ purpose: "prefetch" }))).toBe(true);
    expect(isPrefetch(new Headers({ "next-router-prefetch": "1" }))).toBe(true);
    expect(isPrefetch(new Headers({ accept: "text/html" }))).toBe(false);
  });
});

describe("clickOrigin", () => {
  it("keeps only the path of our own page and its UTM tags", () => {
    expect(
      clickOrigin(
        "https://site.com.br/r/4245s2",
        "https://site.com.br/anuncio/volvo-xc60-4245s2?utm_source=instagram&utm_medium=bio&fbclid=abc",
      ),
    ).toEqual({
      referrer: "/anuncio/volvo-xc60-4245s2",
      utmSource: "instagram",
      utmMedium: "bio",
      utmCampaign: null,
    });
  });

  it("keeps only the origin of an external referrer; the click URL's UTM wins", () => {
    expect(
      clickOrigin(
        "https://site.com.br/r/4245s2?utm_source=newsletter",
        "https://www.google.com/search?q=volvo+xc60&utm_source=x",
      ),
    ).toEqual({
      referrer: "https://www.google.com",
      utmSource: "newsletter",
      utmMedium: null,
      utmCampaign: null,
    });
    expect(clickOrigin("https://site.com.br/r/4245s2", "not a url").referrer).toBeNull();
  });
});
