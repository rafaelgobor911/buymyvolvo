"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";

import {
  createManualListingAction,
  type ManualFormState,
} from "@/app/admin/(painel)/anuncios/novo/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  MANUAL_CHANNEL_LABELS,
  MANUAL_CHANNELS,
  MANUAL_TEXT_MAX,
} from "@/lib/admin/manual-channels";

import { Field, FormMessage, textareaClass } from "./form-bits";

const IDLE: ManualFormState = { status: "idle" };

/** Pasted ad text → a listing in moderation (the server reads it with the extraction). */
export function ManualListingForm() {
  const [state, formAction, pending] = useActionState(createManualListingAction, IDLE);
  const [length, setLength] = useState(0);
  const error = (key: string) => state.errors?.[key];

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" aria-busy={pending}>
      <Field
        id="m-texto"
        label="Texto do anúncio"
        hint="Cole o anúncio inteiro: modelo, versão, ano, km, preço, cidade e contato. O texto não é publicado; a página mostra os dados e um resumo com palavras nossas."
        error={error("text")}
      >
        <textarea
          id="m-texto"
          name="texto"
          rows={10}
          maxLength={MANUAL_TEXT_MAX}
          required
          onChange={(e) => setLength(e.target.value.length)}
          className={textareaClass}
          aria-invalid={error("text") ? true : undefined}
        />
      </Field>
      <p className="-mt-3 text-right text-xs text-muted-foreground">
        {length.toLocaleString("pt-BR")} / {MANUAL_TEXT_MAX.toLocaleString("pt-BR")}
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="m-origem" label="De onde veio" error={error("channel")}>
          <NativeSelect id="m-origem" name="origem" defaultValue="" required className="w-full">
            <NativeSelectOption value="" disabled>
              Escolha
            </NativeSelectOption>
            {MANUAL_CHANNELS.map((c) => (
              <NativeSelectOption key={c} value={c}>
                {MANUAL_CHANNEL_LABELS[c]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field
          id="m-telefone"
          label="WhatsApp do vendedor (opcional)"
          hint="Se não estiver no texto. Vale mais que o telefone do texto."
          error={error("phone")}
        >
          <Input
            id="m-telefone"
            name="telefone"
            type="tel"
            inputMode="tel"
            placeholder="(11) 99999-0000"
            aria-invalid={error("phone") ? true : undefined}
          />
        </Field>
      </div>

      <Field
        id="m-link"
        label="Link do anúncio original (opcional)"
        hint="Só para a sua consulta: não aparece no site."
        error={error("sourceUrl")}
      >
        <Input
          id="m-link"
          name="link"
          type="url"
          inputMode="url"
          placeholder="https://"
          aria-invalid={error("sourceUrl") ? true : undefined}
        />
      </Field>

      {state.duplicate && (
        <div className="flex flex-col gap-2 rounded-xl border border-warning/50 bg-warning-soft p-4 text-sm">
          <p className="text-warning-foreground">
            Parece o mesmo carro de um anúncio que já existe.{" "}
            <Link href={`/admin/anuncios/${state.duplicate.id}`} className="font-medium underline">
              Abrir o anúncio existente
            </Link>
          </p>
          {state.duplicate.status !== "removed" && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="criar_mesmo_assim" className="size-4 accent-primary" />É
              outro carro: criar mesmo assim
            </label>
          )}
        </div>
      )}

      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="h-10 self-start rounded-xl px-4">
        {pending ? "Lendo o anúncio…" : "Ler o anúncio e criar"}
      </Button>
      <p className="text-xs text-muted-foreground">
        O anúncio entra em Moderação → A contatar: revise os dados e envie o convite ao vendedor.
        Nada vai ao ar sem a autorização dele.
      </p>
    </form>
  );
}
