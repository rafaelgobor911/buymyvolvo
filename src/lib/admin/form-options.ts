/** Select options for the admin listing form (always including the listing's current values). */
import type { ListingFormOptions } from "@/components/admin/listing-edit-form";
import { RED_FLAG_LABELS, RED_FLAGS } from "@/lib/extraction/schema";
import { UFS } from "@/lib/search/places";
import {
  enginesForSelect,
  FUEL_LABELS,
  FUELS,
  getEngine,
  getModel,
  getTrim,
  modelsForSelect,
  SELLER_TYPE_LABELS,
  TRANSMISSION_LABELS,
  TRANSMISSIONS,
  trimsForSelect,
} from "@/lib/taxonomy";

import type { ListingPatch } from "./listing-form";

const withCurrent = (
  list: { value: string; label: string }[],
  current: string | null,
  label: (id: string) => string | undefined,
) =>
  current && !list.some((o) => o.value === current)
    ? [{ value: current, label: `${label(current) ?? current} (fora do Brasil)` }, ...list]
    : list;

export function listingFormOptions(values: ListingPatch): ListingFormOptions {
  return {
    models: withCurrent(
      modelsForSelect().map(({ model, isVariant }) => ({
        value: model.id,
        label: isVariant ? `  ${model.name}` : model.name,
      })),
      values.modelId,
      (id) => getModel(id)?.name,
    ),
    engines: withCurrent(
      enginesForSelect().map((e) => ({ value: e.id, label: e.name })),
      values.engineId,
      (id) => getEngine(id)?.name,
    ),
    trims: withCurrent(
      trimsForSelect().map(({ trim, isVariant }) => ({
        value: trim.id,
        label: isVariant ? `  ${trim.name}` : trim.name,
      })),
      values.trimId,
      (id) => getTrim(id)?.name,
    ),
    ufs: Object.entries(UFS).map(([value, name]) => ({ value, label: `${value} · ${name}` })),
    fuels: FUELS.map((f) => ({ value: f, label: FUEL_LABELS[f] })),
    transmissions: TRANSMISSIONS.map((t) => ({ value: t, label: TRANSMISSION_LABELS[t] })),
    sellerTypes: (["loja", "particular"] as const).map((s) => ({
      value: s,
      label: SELLER_TYPE_LABELS[s],
    })),
    redFlags: RED_FLAGS.filter((f) => f !== "sem_contato").map((f) => ({
      value: f,
      label: RED_FLAG_LABELS[f],
    })),
  };
}

/** Only the editable fields (and the id) go to the client form. */
export function formValues(l: ListingPatch & { id: string }): ListingPatch & { id: string } {
  return {
    id: l.id,
    modelId: l.modelId,
    engineId: l.engineId,
    trimId: l.trimId,
    versionText: l.versionText,
    yearFab: l.yearFab,
    yearModel: l.yearModel,
    km: l.km,
    priceCents: l.priceCents,
    city: l.city,
    uf: l.uf,
    color: l.color,
    transmission: l.transmission,
    fuel: l.fuel,
    sellerType: l.sellerType,
    phone: l.phone,
    igUsername: l.igUsername,
    summary: l.summary,
    redFlags: l.redFlags,
    options: l.options,
  };
}
