"use client";

import { startTransition, useActionState, useState } from "react";

import { requestRemovalAction } from "@/app/anuncio/[slug]/remover/actions";
import { Field, FormMessage, textareaClass } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHOICE_BOX, CHOICE_ROW, PUBLIC_FIELDS } from "@/components/public-fields";
import { IDLE } from "@/lib/form-state";
import { cn } from "@/lib/utils";

export function RemovalForm({ slug, reasons }: { slug: string; reasons: readonly string[] }) {
  const [state, formAction, pending] = useActionState(requestRemovalAction, IDLE);
  const [reason, setReason] = useState("");
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };
  return (
    <form onSubmit={onSubmit} className={cn("flex flex-col gap-5", PUBLIC_FIELDS)}>
      <input type="hidden" name="slug" value={slug} />
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Site</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Motivo</legend>
        {reasons.map((r) => (
          <label key={r} className={CHOICE_ROW}>
            <input
              type="radio"
              name="motivo"
              value={r}
              required
              checked={reason === r}
              onChange={() => setReason(r)}
              className={CHOICE_BOX}
            />
            {r}
          </label>
        ))}
      </fieldset>

      <Field
        id="rm-detalhe"
        label={reason === "Outro motivo" ? "Conte o motivo" : "Detalhes (opcional)"}
      >
        <textarea
          id="rm-detalhe"
          name="detalhe"
          rows={3}
          maxLength={500}
          className={textareaClass}
        />
      </Field>

      <Field
        id="rm-contato"
        label="Seu e-mail ou telefone (opcional)"
        hint="Só para falarmos com você sobre este pedido, se precisar."
      >
        <Input id="rm-contato" name="contato" maxLength={120} autoComplete="email" />
      </Field>

      <label className={cn(CHOICE_ROW, "items-start py-2.5")}>
        <input type="checkbox" name="declaro" className={CHOICE_BOX} />
        <span className="text-pretty">
          Declaro que o anúncio é meu ou que tenho autorização de quem anunciou para pedir a
          remoção.
        </span>
      </label>

      <FormMessage state={state} />
      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl px-6 text-base sm:w-auto sm:self-start"
      >
        Remover anúncio
      </Button>
    </form>
  );
}
