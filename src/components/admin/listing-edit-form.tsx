"use client";

import { startTransition, useActionState } from "react";

import { saveListingAction } from "@/app/admin/(painel)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { IDLE } from "@/lib/admin/form-state";
import type { ListingPatch } from "@/lib/admin/listing-form";

import { Field, FormMessage, type Option, textareaClass } from "./form-bits";

export interface ListingFormOptions {
  models: Option[];
  engines: Option[];
  trims: Option[];
  ufs: Option[];
  fuels: Option[];
  transmissions: Option[];
  sellerTypes: Option[];
  redFlags: Option[];
}

const thousands = (n: number | null) =>
  n === null ? "" : new Intl.NumberFormat("pt-BR").format(n);

/**
 * Submits through a transition instead of a plain form action, so React does
 * not reset the fields when the server answers with validation errors.
 */
export function ListingEditForm({
  values,
  options,
  from,
  canApprove,
  approveHint,
}: {
  values: ListingPatch & { id: string };
  options: ListingFormOptions;
  from: "moderacao" | "anuncios";
  canApprove: boolean;
  /** Why the listing cannot be approved yet (shown instead of the button). */
  approveHint?: string;
}) {
  const [state, formAction, pending] = useActionState(saveListingAction, IDLE);
  const error = (key: keyof ListingPatch) => state.errors?.[key];
  const invalid = (key: keyof ListingPatch) => (error(key) ? true : undefined);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(data));
  };

  const select = (
    name: string,
    key: keyof ListingPatch,
    list: Option[],
    value: string | null,
    empty = "—",
  ) => (
    <NativeSelect
      id={`f-${name}`}
      name={name}
      defaultValue={value ?? ""}
      className="w-full"
      aria-invalid={invalid(key)}
    >
      <NativeSelectOption value="">{empty}</NativeSelectOption>
      {list.map((o) => (
        <NativeSelectOption key={o.value} value={o.value}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" aria-busy={pending}>
      <input type="hidden" name="id" value={values.id} />
      <input type="hidden" name="from" value={from} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field
          id="f-modelo"
          label="Modelo"
          error={error("modelId")}
          className="col-span-2 sm:col-span-1"
        >
          {select("modelo", "modelId", options.models, values.modelId, "Escolha o modelo")}
        </Field>
        <Field id="f-motor" label="Motor" error={error("engineId")}>
          {select("motor", "engineId", options.engines, values.engineId)}
        </Field>
        <Field id="f-versao" label="Versão" error={error("trimId")}>
          {select("versao", "trimId", options.trims, values.trimId)}
        </Field>
        <Field id="f-versao_texto" label="Versão escrita" className="col-span-2 sm:col-span-3">
          <Input
            id="f-versao_texto"
            name="versao_texto"
            defaultValue={values.versionText ?? ""}
            maxLength={80}
          />
        </Field>
        <Field id="f-ano_fab" label="Ano de fabricação" error={error("yearFab")}>
          <Input
            id="f-ano_fab"
            name="ano_fab"
            inputMode="numeric"
            defaultValue={values.yearFab ?? ""}
            aria-invalid={invalid("yearFab")}
          />
        </Field>
        <Field id="f-ano_modelo" label="Ano-modelo" error={error("yearModel")}>
          <Input
            id="f-ano_modelo"
            name="ano_modelo"
            inputMode="numeric"
            defaultValue={values.yearModel ?? ""}
            aria-invalid={invalid("yearModel")}
          />
        </Field>
        <Field id="f-km" label="Km" error={error("km")}>
          <Input
            id="f-km"
            name="km"
            inputMode="numeric"
            defaultValue={thousands(values.km)}
            aria-invalid={invalid("km")}
          />
        </Field>
        <Field id="f-preco" label="Preço (R$)" error={error("priceCents")}>
          <Input
            id="f-preco"
            name="preco"
            inputMode="decimal"
            defaultValue={values.priceCents === null ? "" : thousands(values.priceCents / 100)}
            aria-invalid={invalid("priceCents")}
          />
        </Field>
        <Field id="f-cidade" label="Cidade" error={error("city")}>
          <Input id="f-cidade" name="cidade" defaultValue={values.city ?? ""} maxLength={80} />
        </Field>
        <Field id="f-uf" label="UF" error={error("uf")}>
          {select("uf", "uf", options.ufs, values.uf)}
        </Field>
        <Field id="f-cor" label="Cor">
          <Input id="f-cor" name="cor" defaultValue={values.color ?? ""} maxLength={40} />
        </Field>
        <Field id="f-cambio" label="Câmbio" error={error("transmission")}>
          {select("cambio", "transmission", options.transmissions, values.transmission)}
        </Field>
        <Field id="f-combustivel" label="Combustível" error={error("fuel")}>
          {select("combustivel", "fuel", options.fuels, values.fuel)}
        </Field>
        <Field id="f-vendedor" label="Vendedor" error={error("sellerType")}>
          {select(
            "vendedor",
            "sellerType",
            options.sellerTypes,
            values.sellerType,
            "Não informado",
          )}
        </Field>
        <Field
          id="f-telefone"
          label="Telefone (WhatsApp)"
          error={error("phone")}
          hint="Com DDD. Fica no servidor; nunca aparece na página."
        >
          <Input
            id="f-telefone"
            name="telefone"
            inputMode="tel"
            defaultValue={values.phone ?? ""}
            aria-invalid={invalid("phone")}
          />
        </Field>
        <Field id="f-instagram" label="Instagram (@)" error={error("igUsername")}>
          <Input
            id="f-instagram"
            name="instagram"
            defaultValue={values.igUsername ?? ""}
            aria-invalid={invalid("igUsername")}
          />
        </Field>
      </div>

      <Field
        id="f-resumo"
        label="Resumo (público)"
        error={error("summary")}
        hint="Só sobre o carro, em palavras próprias: sem preço, contato, loja ou condições de venda."
      >
        <textarea
          id="f-resumo"
          name="resumo"
          rows={4}
          maxLength={600}
          defaultValue={values.summary ?? ""}
          className={textareaClass}
          aria-invalid={invalid("summary")}
        />
      </Field>

      <Field id="f-itens" label="Itens (separados por vírgula)">
        <Input id="f-itens" name="itens" defaultValue={values.options.join(", ")} />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Alertas que o próprio post declara</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.redFlags.map((flag) => (
            <label key={flag.value} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="alertas"
                value={flag.value}
                defaultChecked={values.redFlags.includes(flag.value as never)}
                className="mt-0.5 size-4 accent-primary"
              />
              {flag.label}
            </label>
          ))}
        </div>
      </fieldset>

      <FormMessage state={state} />

      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <Button
            type="submit"
            name="intent"
            value="approve"
            data-shortcut="a"
            disabled={pending}
            className="h-10 rounded-xl px-4"
          >
            Aprovar e publicar
            <kbd className="ml-1 rounded border border-primary-foreground/30 px-1 text-xs">A</kbd>
          </Button>
        )}
        <Button
          type="submit"
          name="intent"
          value="save"
          variant={canApprove ? "outline" : "default"}
          data-shortcut="s"
          disabled={pending}
          className="h-10 rounded-xl px-4"
        >
          Salvar
          <kbd className="ml-1 rounded border border-current/30 px-1 text-xs">S</kbd>
        </Button>
        {!canApprove && approveHint && (
          <p className="self-center text-sm text-muted-foreground">{approveHint}</p>
        )}
      </div>
    </form>
  );
}
