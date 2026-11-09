import { describe, expect, it } from "vitest";

import { consentSignals, consentVersionKey, parseConsent, serializeConsent } from "./consent";
import { leadParams, viewItemParams } from "./items";

describe("consent", () => {
  const version = consentVersionKey({ ads: false });

  it("round-trips a choice for the same version", () => {
    const raw = serializeConsent({ analytics: true, ads: false }, version);
    expect(parseConsent(raw, version)).toEqual({ analytics: true, ads: false });
  });

  it("asks again when the categories change (Google Ads turned on) or data is broken", () => {
    const raw = serializeConsent({ analytics: true, ads: false }, version);
    expect(parseConsent(raw, consentVersionKey({ ads: true }))).toBeNull();
    expect(parseConsent("{", version)).toBeNull();
    expect(parseConsent(JSON.stringify({ v: version, analytics: "yes" }), version)).toBeNull();
    expect(parseConsent(null, version)).toBeNull();
  });

  it("maps to the four Consent Mode v2 signals, denied by default", () => {
    expect(consentSignals(null)).toEqual({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    expect(consentSignals({ analytics: true, ads: false })).toMatchObject({
      analytics_storage: "granted",
      ad_storage: "denied",
    });
    expect(consentSignals({ analytics: false, ads: true })).toMatchObject({
      analytics_storage: "denied",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
  });
});

describe("analytics items", () => {
  const listing = {
    shortId: "ab12c",
    title: "Volvo XC60 T8 Inscription",
    modelName: "XC60",
    engineName: "T8",
    trimName: "Inscription",
    uf: "SP",
    yearModel: 2020,
    priceCents: 25_000_000,
  };

  it("describes the car without seller data", () => {
    expect(viewItemParams(listing)).toEqual({
      currency: "BRL",
      value: 250000,
      items: [
        {
          item_id: "ab12c",
          item_name: "Volvo XC60 T8 Inscription",
          item_brand: "Volvo",
          item_category: "XC60",
          item_category2: "T8",
          item_category3: "2020",
          item_category4: "SP",
          item_variant: "Inscription",
          price: 250000,
        },
      ],
    });
  });

  it("a lead carries the channel and no value", () => {
    const params = leadParams({ ...listing, priceCents: null, engineName: null }, "instagram");
    expect(params).toMatchObject({ lead_source: "instagram", listing_id: "ab12c" });
    expect(params).not.toHaveProperty("value");
    expect(params.items[0]).not.toHaveProperty("price");
    expect(params.items[0]).not.toHaveProperty("item_category2");
  });
});
