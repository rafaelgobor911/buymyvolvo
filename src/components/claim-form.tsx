"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";

import { claimListingAction } from "@/app/anuncio/[slug]/reivindicar/actions";
import { Field, FormMessage, textareaClass } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { IDLE } from "@/lib/form-state";

export function ClaimForm({
  slug,
  defaults,
}: {
  slug: string;
  defaults: { name: string; type: string; phone: string };
}) {
  const [state, formAction, pending] = useActionState(claimListingAction, IDLE);
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };
  const error = (key: string) => state.errors?.[key];
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="cl-nome" label="Nome (seu ou da loja)" error={error("displayName")}>
          <Input id="cl-nome" name="nome" defaultValue={defaults.name} maxLength={80} required />
        </Field>
        <Field id="cl-tipo" label="Você é" error={error("type")}>
          <NativeSelect id="cl-tipo" name="tipo" defaultValue={defaults.type} className="w-full">
            <NativeSelectOption value="particular">Particular</NativeSelectOption>
            <NativeSelectOption value="loja">Loja</NativeSelectOption>
          </NativeSelect>
        </Field>
      </div>
      <Field
        id="cl-telefone"
        label="Telefone (opcional)"
        error={error("phone")}
        hint="Só para a nossa equipe falar com você sobre o anúncio."
      >
        <Input id="cl-telefone" name="telefone" inputMode="tel" defaultValue={defaults.phone} />
      </Field>
      <Field
        id="cl-prova"
        label="Algo que ajude a confirmar que o anúncio é seu (opcional)"
        hint="Por exemplo: o @ do Instagram que publicou, ou o final do telefone do anúncio."
      >
        <textarea id="cl-prova" name="prova" rows={3} maxLength={1000} className={textareaClass} />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="termos" className="mt-0.5 size-4 accent-primary" />
        <span>
          Li e aceito os{" "}
          <Link
            href="/termos-do-anunciante"
            target="_blank"
            className="font-medium text-primary hover:underline"
          >
            Termos do Anunciante
          </Link>
          .
        </span>
      </label>
      <FormMessage state={state} />
      <Button
        type="submit"
        disabled={pending}
        className="h-11 self-start rounded-xl px-5 text-base"
      >
        Reivindicar anúncio
      </Button>
    </form>
  );
}
