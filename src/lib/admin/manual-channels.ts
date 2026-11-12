/** Where a pasted ad came from (Phase 9a). Pure: the admin form uses it in the browser. */
export const MANUAL_CHANNELS = [
  "whatsapp",
  "olx",
  "webmotors",
  "marketplace",
  "instagram",
  "other",
] as const;
export type ManualChannel = (typeof MANUAL_CHANNELS)[number];

export const MANUAL_CHANNEL_LABELS: Record<ManualChannel, string> = {
  whatsapp: "WhatsApp (o vendedor mandou)",
  olx: "OLX",
  webmotors: "Webmotors",
  marketplace: "Facebook Marketplace",
  instagram: "Instagram",
  other: "Outro",
};

export const MANUAL_TEXT_MIN = 20;
export const MANUAL_TEXT_MAX = 5000;
