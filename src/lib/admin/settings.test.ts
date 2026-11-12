import { describe, expect, it } from "vitest";

import { DEFAULT_INVITE_TEMPLATE } from "@/lib/authorization/messages";
import { DEFAULT_MESSAGE_TEMPLATE } from "@/lib/leads/message";

import { parseSettingsForm } from "./settings";

const valid = {
  bmv_whatsapp_numbers: "",
  seller_commission_brl: "0",
  authorization_invite_template: DEFAULT_INVITE_TEMPLATE,
  whatsapp_message_template: DEFAULT_MESSAGE_TEMPLATE,
  publish_confidence_threshold: "0,85",
  lead_dedupe_hours: "24",
  hashtag_stale_after_days: "14",
  hashtag_expire_after_days: "30",
  hashtag_budget_max: "25",
  business_discovery_pages: "2",
  token_alert_days: "10",
};

describe("parseSettingsForm", () => {
  it("accepts the defaults (decimal comma included)", () => {
    const result = parseSettingsForm(valid);
    expect(result.ok && result.values.publish_confidence_threshold).toBe(0.85);
  });

  it("requires {ref} and known placeholders in the message", () => {
    const noRef = parseSettingsForm({
      ...valid,
      whatsapp_message_template: "Olá, vi seu {modelo}",
    });
    expect(!noRef.ok && noRef.errors.whatsapp_message_template).toMatch(/\{ref\}/);
    const unknown = parseSettingsForm({
      ...valid,
      whatsapp_message_template: "Olá {nome}! (ref. {ref})",
    });
    expect(!unknown.ok && unknown.errors.whatsapp_message_template).toBe(
      "Variável desconhecida: {nome}.",
    );
  });

  it("checks ranges, integers and that expiry comes after the warning", () => {
    const result = parseSettingsForm({
      ...valid,
      publish_confidence_threshold: "1.5",
      hashtag_budget_max: "31",
      lead_dedupe_hours: "2.5",
      hashtag_stale_after_days: "20",
      hashtag_expire_after_days: "10",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(
      [
        "hashtag_budget_max",
        "hashtag_expire_after_days",
        "lead_dedupe_hours",
        "publish_confidence_threshold",
      ].sort(),
    );
  });

  it("normalizes the Buy My Volvo numbers and keeps a saved value as is", () => {
    const typed = parseSettingsForm({
      ...valid,
      bmv_whatsapp_numbers: "(11) 98765-4321 e 11 91234-5678",
    });
    expect(typed.ok && typed.values.bmv_whatsapp_numbers).toBe("+5511987654321, +5511912345678");
    const bad = parseSettingsForm({ ...valid, bmv_whatsapp_numbers: "+55 20 90000-0000" });
    expect(!bad.ok && bad.errors.bmv_whatsapp_numbers).toMatch(/Número inválido/);
    const saved = parseSettingsForm(
      { ...valid, bmv_whatsapp_numbers: "+5520900000000" },
      { bmv_whatsapp_numbers: "+5520900000000" },
    );
    expect(saved.ok && saved.values.bmv_whatsapp_numbers).toBe("+5520900000000");
  });

  it("requires {link} in the invite and a whole commission", () => {
    const result = parseSettingsForm({
      ...valid,
      authorization_invite_template: "Olá! Autorize seu {modelo}",
      seller_commission_brl: "99,5",
    });
    expect(!result.ok && result.errors).toMatchObject({
      authorization_invite_template: expect.stringMatching(/\{link\}/),
      seller_commission_brl: "Use um número inteiro.",
    });
  });
});
