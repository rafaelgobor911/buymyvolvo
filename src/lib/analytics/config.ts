import { publicEnv } from "@/lib/env/public";
import type { GoogleTagConfig } from "@/lib/analytics/gtag";

/** Google tags from the environment; with none set, no banner and no script. */
export const googleTagConfig: GoogleTagConfig = {
  gaId: publicEnv.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  adsId: publicEnv.NEXT_PUBLIC_GOOGLE_ADS_ID,
  leadLabel: publicEnv.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL,
};

export const analyticsEnabled = !!(googleTagConfig.gaId || googleTagConfig.adsId);
