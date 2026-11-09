import type { NextConfig } from "next";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";

import { productionProblems } from "./src/lib/env/production";

// A Vercel production build with a dangerous or missing setting fails here
// instead of going live (demo mode, test logins, test salts, no site URL).
if (process.env.VERCEL_ENV === "production") {
  const problems = productionProblems(process.env);
  if (problems.length) {
    throw new Error(`Production settings:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Next streams metadata to Googlebot (it runs JavaScript). We want title,
  // canonical and noindex in the first <head> for every crawler, so Googlebot
  // joins Next's default list of bots that get blocking metadata.
  htmlLimitedBots: new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|Googlebot`, "i"),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
