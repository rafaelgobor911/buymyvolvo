/**
 * GA4 ecommerce-style item for a listing (view_item, generate_lead). Ready for
 * Google Ads remarketing later. Only public car data: no seller contact.
 */
export interface ListingForAnalytics {
  shortId: string;
  title: string;
  modelName: string;
  engineName: string | null;
  trimName: string | null;
  uf: string | null;
  yearModel: number | null;
  priceCents: number | null;
}

export function listingItem(l: ListingForAnalytics) {
  return {
    item_id: l.shortId,
    item_name: l.title,
    item_brand: "Volvo",
    item_category: l.modelName,
    ...(l.engineName ? { item_category2: l.engineName } : {}),
    ...(l.yearModel ? { item_category3: String(l.yearModel) } : {}),
    ...(l.uf ? { item_category4: l.uf } : {}),
    ...(l.trimName ? { item_variant: l.trimName } : {}),
    ...(l.priceCents !== null ? { price: l.priceCents / 100 } : {}),
  };
}

export function viewItemParams(l: ListingForAnalytics) {
  return {
    currency: "BRL",
    ...(l.priceCents !== null ? { value: l.priceCents / 100 } : {}),
    items: [listingItem(l)],
  };
}

/** generate_lead: one contact click, by channel. No value: a lead is not the car's price. */
export function leadParams(l: ListingForAnalytics, channel: "whatsapp" | "instagram") {
  return { lead_source: channel, listing_id: l.shortId, items: [listingItem(l)] };
}
