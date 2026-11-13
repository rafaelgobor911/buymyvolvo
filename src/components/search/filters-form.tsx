import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PUBLIC_FIELDS } from "@/components/public-fields";
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
import { fuelGroupOrder, withVariantsLabel } from "@/lib/taxonomy/explain";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };
type OptionGroup = { label: string; options: Option[] };

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  /** Short help under the control; the control points to it with aria-describedby. */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-dica`} className="text-xs text-pretty text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Native select (accessible, mobile-friendly). Adds an option for combined values like "xc40,ex40". */
function Select({
  id,
  name,
  value,
  options,
  groups,
  customLabel,
  describedBy,
}: {
  id: string;
  name: string;
  value: string;
  options?: Option[];
  /** Options under labelled groups (engines by fuel), instead of a flat list. */
  groups?: OptionGroup[];
  customLabel?: string;
  describedBy?: string;
}) {
  const all = options ?? groups?.flatMap((g) => g.options) ?? [];
  const known = value === "" || all.some((o) => o.value === value);
  const render = (o: Option) => (
    <NativeSelectOption key={o.value} value={o.value}>
      {o.label}
    </NativeSelectOption>
  );
  return (
    <NativeSelect
      id={id}
      name={name}
      defaultValue={value}
      className="w-full"
      aria-describedby={describedBy}
    >
      <NativeSelectOption value="">Qualquer</NativeSelectOption>
      {!known && <NativeSelectOption value={value}>{customLabel ?? value}</NativeSelectOption>}
      {options?.map(render)}
      {groups?.map((g) => (
        <NativeSelectOptGroup key={g.label} label={g.label}>
          {g.options.map(render)}
        </NativeSelectOptGroup>
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

/** "V40 (inclui Cross Country)" for the base model; the variant alone keeps its own name. */
const MODEL_OPTIONS: Option[] = modelsForSelect().map(({ model, isVariant }) => ({
  value: model.id,
  label: isVariant
    ? model.name
    : withVariantsLabel(
        model.name,
        variantsOf(model.id).map((v) => v.name),
      ),
}));
/** Engines grouped by fuel, so the codes explain themselves ("Híbrido plug-in: T8"). */
const ENGINE_GROUPS: OptionGroup[] = (() => {
  const groups = new Map<string, { order: number; options: Option[] }>();
  for (const e of enginesForSelect()) {
    const label = e.fuels
      .map((f, i) => (i === 0 ? FUEL_LABELS[f] : FUEL_LABELS[f].toLowerCase()))
      .join(" ou ");
    const group = groups.get(label) ?? { order: fuelGroupOrder(e.fuels), options: [] };
    group.options.push({ value: e.id, label: e.name });
    groups.set(label, group);
  }
  return [...groups.entries()]
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([label, g]) => ({ label, options: g.options }));
})();
const TRIM_OPTIONS: Option[] = trimsForSelect().map(({ trim, isVariant }) => ({
  value: trim.id,
  label: isVariant
    ? trim.name
    : withVariantsLabel(
        trim.name,
        trimVariantsOf(trim.id).map((t) => t.name),
      ),
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
    <form
      action="/busca"
      method="get"
      className={cn("flex flex-col gap-4", PUBLIC_FIELDS)}
      aria-label="Filtros"
    >
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
            groups={ENGINE_GROUPS}
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
      <Field
        id={id("repasse")}
        label="Repasse"
        hint="Repasse é a venda do carro no estado, em geral sem garantia."
      >
        <Select
          id={id("repasse")}
          name={PARAM.repasse}
          describedBy={`${id("repasse")}-dica`}
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
        <Button type="submit" className="h-11 flex-1 rounded-lg">
          Aplicar filtros
        </Button>
        <Link
          href="/busca"
          className="inline-flex h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          Limpar
        </Link>
      </div>
    </form>
  );
}
