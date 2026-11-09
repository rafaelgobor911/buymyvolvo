"use client";

import { startTransition, useActionState } from "react";

import { updateSellerListingAction } from "@/app/vendedor/actions";
import { Field, FormMessage, type Option, textareaClass } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { IDLE } from "@/lib/form-state";
import type { SellerEdit } from "@/lib/sellers/edit-form";

const thousands = (n: number | null) =>
  n === null ? "" : new Intl.NumberFormat("pt-BR").format(n);

export function SellerEditForm({
  id,
  values,
  options,
}: {
  id: string;
  values: SellerEdit;
  options: { transmissions: Option[]; fuels: Option[]; ufs: Option[] };
}) {
  const [state, formAction, pending] = useActionState(updateSellerListingAction, IDLE);
  const error = (key: keyof SellerEdit) => state.errors?.[key];
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };
  const select = (name: string, list: Option[], value: string | null, label: string) => (
    <NativeSelect
      id={`v-${name}`}
      name={name}
      defaultValue={value ?? ""}
      className="w-full"
      aria-label={label}
    >
      <NativeSelectOption value="">—</NativeSelectOption>
      {list.map((o) => (
        <NativeSelectOption key={o.value} value={o.value}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field id="v-preco" label="Preço (R$)" error={error("priceCents")}>
          <Input
            id="v-preco"
            name="preco"
            inputMode="decimal"
            defaultValue={values.priceCents === null ? "" : thousands(values.priceCents / 100)}
          />
        </Field>
        <Field id="v-km" label="Km" error={error("km")}>
          <Input id="v-km" name="km" inputMode="numeric" defaultValue={thousands(values.km)} />
        </Field>
        <Field id="v-cor" label="Cor">
          <Input id="v-cor" name="cor" defaultValue={values.color ?? ""} maxLength={40} />
        </Field>
        <Field id="v-cambio" label="Câmbio" error={error("transmission")}>
          {select("cambio", options.transmissions, values.transmission, "Câmbio")}
        </Field>
        <Field id="v-combustivel" label="Combustível" error={error("fuel")}>
          {select("combustivel", options.fuels, values.fuel, "Combustível")}
        </Field>
        <Field id="v-cidade" label="Cidade">
          <Input id="v-cidade" name="cidade" defaultValue={values.city ?? ""} maxLength={80} />
        </Field>
        <Field id="v-uf" label="UF" error={error("uf")}>
          {select("uf", options.ufs, values.uf, "UF")}
        </Field>
        <Field id="v-telefone" label="WhatsApp do anúncio" error={error("phone")}>
          <Input
            id="v-telefone"
            name="telefone"
            inputMode="tel"
            defaultValue={values.phone ?? ""}
          />
        </Field>
        <Field id="v-instagram" label="Instagram (@)" error={error("igUsername")}>
          <Input id="v-instagram" name="instagram" defaultValue={values.igUsername ?? ""} />
        </Field>
      </div>
      <Field
        id="v-descricao"
        label="Descrição"
        error={error("description")}
        hint="Aparece no anúncio no lugar do resumo automático. Conte o estado, o histórico e os itens do carro."
      >
        <textarea
          id="v-descricao"
          name="descricao"
          rows={6}
          maxLength={2000}
          defaultValue={values.description ?? ""}
          className={textareaClass}
        />
      </Field>
      <Field id="v-itens" label="Itens (separados por vírgula)">
        <Input id="v-itens" name="itens" defaultValue={values.options.join(", ")} />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="h-10 self-start rounded-xl px-4">
        Salvar dados
      </Button>
    </form>
  );
}
