import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { modelGroupLabel, PARAM, type SearchFilters } from "@/lib/search/filters";
import { UF_CODES, UFS } from "@/lib/search/places";
import {
  enginesForSelect,
  FUEL_LABELS,
  FUELS,
  type Fuel,
  modelsForSelect,
  TRANSMISSION_LABELS,
  TRANSMISSIONS,
  TRIMS,
  trimsForSelect,
  trimVariantsOf,
  variantsOf,
} from "@/lib/taxonomy";

type Option = { value: string; label: string };

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Native select (accessible, mobile-friendly). Adds an option for combined values like "xc40,ex40". */
function Select({
  id,
  name,
  value,
  options,
  customLabel,
}: {
  id: string;
  name: string;
  value: string;
  options: Option[];
  customLabel?: string;
}) {
  const known = value === "" || options.some((o) => o.value === value);
  return (
    <NativeSelect id={id} name={name} defaultValue={value} className="w-full">
      <NativeSelectOption value="">Qualquer</NativeSelectOption>
      {!known && <NativeSelectOption value={value}>{customLabel ?? value}</NativeSelectOption>}
      {options.map((o) => (
        <NativeSelectOption key={o.value} value={o.value}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/** Collapses [base, ...its variants] back to the base id so the select shows "V40". */
function modelSelectValue(ids: string[]): string {
  const [base] = ids;
  if (
    base &&
    ids.length === 1 + variantsOf(base).length &&
    variantsOf(base).every((v) => ids.includes(v.id))
  ) {
    return base;
  }
  return ids.join(",");
}

const MODEL_OPTIONS: Option[] = modelsForSelect().map(({ model, isVariant }) => ({
  value: model.id,
  label: isVariant
    ? `${model.name} (só)`
    : variantsOf(model.id).length
      ? `${model.name} (todas)`
      : model.name,
}));
const ENGINE_OPTIONS: Option[] = enginesForSelect().map((e) => ({ value: e.id, label: e.name }));
const TRIM_OPTIONS: Option[] = trimsForSelect().map(({ trim, isVariant }) => ({
  value: trim.id,
  label: isVariant
    ? `${trim.name} (só)`
    : trimVariantsOf(trim.id).length
      ? `${trim.name} (todas)`
      : trim.name,
}));

/** Collapses [base, ...its variants] back to the base id so the select shows "Ultimate". */
function trimSelectValue(ids: string[]): string {
  const [base] = ids;
  const variants = base ? trimVariantsOf(base) : [];
  if (
    base &&
    variants.length &&
    ids.length === 1 + variants.length &&
    variants.every((v) => ids.includes(v.id))
  ) {
    return base;
  }
  return ids.join(",");
}
const FUEL_OPTIONS: Option[] = FUELS.map((f) => ({ value: f, label: FUEL_LABELS[f] }));
const TRANSMISSION_OPTIONS: Option[] = TRANSMISSIONS.map((t) => ({
  value: t,
  label: TRANSMISSION_LABELS[t],
}));
const UF_OPTIONS: Option[] = UF_CODES.map((uf) => ({ value: uf, label: `${UFS[uf]} (${uf})` }));

export function FiltersForm({ filters, idPrefix }: { filters: SearchFilters; idPrefix: string }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <form action="/busca" method="get" className="flex flex-col gap-4" aria-label="Filtros">
      <input type="hidden" name={PARAM.q} value={filters.q} />
      {filters.sort !== "recentes" && (
        <input type="hidden" name={PARAM.sort} value={filters.sort} />
      )}

      <Field id={id("modelo")} label="Modelo">
        <Select
          id={id("modelo")}
          name={PARAM.model}
          value={modelSelectValue(filters.modelIds)}
          options={MODEL_OPTIONS}
          customLabel={modelGroupLabel(filters.modelIds)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={id("motor")} label="Motor">
          <Select
            id={id("motor")}
            name={PARAM.engine}
            value={filters.engineIds.join(",")}
            options={ENGINE_OPTIONS}
          />
        </Field>
        <Field id={id("versao")} label="Versão">
          <Select
            id={id("versao")}
            name={PARAM.trim}
            value={trimSelectValue(filters.trimIds)}
            options={TRIM_OPTIONS}
            customLabel={filters.trimIds
              .map((t) => TRIMS.find((x) => x.id === t)?.name)
              .join(" ou ")}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id={id("ano-min")} label="Ano de">
          <Input
            id={id("ano-min")}
            name={PARAM.yearMin}
            type="number"
            inputMode="numeric"
            min={1970}
            max={2100}
            placeholder="1990"
            defaultValue={filters.yearMin ?? ""}
          />
        </Field>
        <Field id={id("ano-max")} label="Ano até">
          <Input
            id={id("ano-max")}
            name={PARAM.yearMax}
            type="number"
            inputMode="numeric"
            min={1970}
            max={2100}
            placeholder="2026"
            defaultValue={filters.yearMax ?? ""}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id={id("preco-max")} label="Preço até (R$)">
          <Input
            id={id("preco-max")}
            name={PARAM.priceMax}
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            placeholder="250000"
            defaultValue={filters.priceMax ?? ""}
          />
        </Field>
        <Field id={id("km-max")} label="Km até">
          <Input
            id={id("km-max")}
            name={PARAM.kmMax}
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            placeholder="80000"
            defaultValue={filters.kmMax ?? ""}
          />
        </Field>
      </div>
      <input type="hidden" name={PARAM.priceMin} value={filters.priceMin ?? ""} />
      <Field id={id("uf")} label="Estado">
        <Select id={id("uf")} name={PARAM.uf} value={filters.uf ?? ""} options={UF_OPTIONS} />
      </Field>
      <Field id={id("cidade")} label="Cidade">
        <Input
          id={id("cidade")}
          name={PARAM.city}
          placeholder="Ex.: Curitiba"
          defaultValue={filters.city ?? ""}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={id("combustivel")} label="Combustível">
          <Select
            id={id("combustivel")}
            name={PARAM.fuel}
            value={filters.fuels.join(",")}
            options={FUEL_OPTIONS}
            customLabel={filters.fuels.map((f: Fuel) => FUEL_LABELS[f]).join(" ou ")}
          />
        </Field>
        <Field id={id("cambio")} label="Câmbio">
          <Select
            id={id("cambio")}
            name={PARAM.transmission}
            value={filters.transmission ?? ""}
            options={TRANSMISSION_OPTIONS}
          />
        </Field>
      </div>
      <Field id={id("vendedor")} label="Vendedor">
        <Select
          id={id("vendedor")}
          name={PARAM.seller}
          value={filters.sellerType ?? ""}
          options={[
            { value: "loja", label: "Loja" },
            { value: "particular", label: "Particular" },
          ]}
        />
      </Field>
      <Field id={id("repasse")} label="Repasse">
        <Select
          id={id("repasse")}
          name={PARAM.repasse}
          value={filters.repasse === "only" ? "so" : filters.repasse === "exclude" ? "sem" : ""}
          options={[
            { value: "sem", label: "Sem repasse" },
            { value: "so", label: "Só repasse" },
          ]}
        />
      </Field>
      <Field id={id("texto")} label="Palavras-chave">
        <Input
          id={id("texto")}
          name={PARAM.text}
          placeholder="Ex.: teto solar"
          defaultValue={filters.text}
        />
      </Field>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" className="h-10 flex-1 rounded-lg">
          Aplicar filtros
        </Button>
        <Link
          href="/busca"
          className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Limpar
        </Link>
      </div>
    </form>
  );
}
