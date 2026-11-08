"use client";

import { startTransition, useActionState, useState } from "react";

import { markSoldAction } from "@/app/vendedor/actions";
import { Field, FormMessage } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { IDLE } from "@/lib/form-state";

const ANSWERS = [
  { value: "sim", label: "Sim, o comprador chegou pelo site" },
  { value: "nao", label: "Não, vendi por outro caminho" },
  { value: "nao_sei", label: "Não sei" },
];

/** "Marcar como vendido" with the question that feeds the leads' outcome. */
export function MarkSoldForm({ listingId, refs }: { listingId: string; refs: string[] }) {
  const [state, formAction, pending] = useActionState(markSoldAction, IDLE);
  const [answer, setAnswer] = useState("");
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
      <input type="hidden" name="id" value={listingId} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium">
          Vendeu para alguém que chegou pelo site?
        </legend>
        {ANSWERS.map((a) => (
          <label key={a.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="pelo_site"
              value={a.value}
              required
              checked={answer === a.value}
              onChange={() => setAnswer(a.value)}
              className="size-4 accent-primary"
            />
            {a.label}
          </label>
        ))}
      </fieldset>
      {answer === "sim" && refs.length > 0 && (
        <Field
          id={`contato-${listingId}`}
          label="Qual contato comprou? (opcional)"
          hint="O código aparece no fim da mensagem que você recebeu, como VX-7K3P9."
        >
          <NativeSelect
            id={`contato-${listingId}`}
            name="contato"
            defaultValue=""
            className="w-full sm:w-64"
          >
            <NativeSelectOption value="">Não sei qual</NativeSelectOption>
            {refs.map((r) => (
              <NativeSelectOption key={r} value={r}>
                {r}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      )}
      <FormMessage state={state} />
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="h-9 self-start rounded-xl px-3"
      >
        Marcar como vendido
      </Button>
    </form>
  );
}
