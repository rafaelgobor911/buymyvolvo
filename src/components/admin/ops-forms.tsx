"use client";

import { startTransition, useActionState, useState } from "react";

import {
  addBlockAction,
  addSourcesAction,
  claimDecisionAction,
  removalAction,
  runJobAction,
} from "@/app/admin/(painel)/ops-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { IDLE } from "@/lib/admin/form-state";

import { Field, FormMessage, type Option, textareaClass } from "./form-bits";

/** Submits through a transition, so React keeps the fields when the server returns an error. */
const submitWith =
  (action: (data: FormData) => void) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => action(data));
  };

export function AddSourcesForm({ budgetLeft }: { budgetLeft: number }) {
  const [state, formAction, pending] = useActionState(addSourcesAction, IDLE);
  const [type, setType] = useState("ig_business_account");
  return (
    <form onSubmit={submitWith(formAction)} className="flex flex-col gap-3">
      <Field id="fo-tipo" label="Tipo">
        <NativeSelect
          id="fo-tipo"
          name="tipo"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full sm:w-72"
        >
          <NativeSelectOption value="ig_business_account">Conta de loja (@)</NativeSelectOption>
          <NativeSelectOption value="ig_hashtag">Hashtag (#)</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field
        id="fo-fontes"
        label={type === "ig_hashtag" ? "Hashtags" : "Contas"}
        hint={
          type === "ig_hashtag"
            ? `Uma por linha, sem #. Restam ${budgetLeft} vaga(s) no orçamento desta semana; cada hashtag nova gasta uma na primeira leitura.`
            : "Uma por linha, com ou sem @. Só contas profissionais (loja ou criador) aparecem na API."
        }
      >
        <textarea id="fo-fontes" name="fontes" rows={3} className={textareaClass} />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="h-10 self-start rounded-xl px-4">
        Adicionar
      </Button>
    </form>
  );
}

export function RunJobForm({ jobs }: { jobs: Option[] }) {
  const [state, formAction, pending] = useActionState(runJobAction, IDLE);
  return (
    <form onSubmit={submitWith(formAction)} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="j-job" label="Job">
          <NativeSelect id="j-job" name="job" className="w-full sm:w-72">
            {jobs.map((j) => (
              <NativeSelectOption key={j.value} value={j.value}>
                {j.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <label className="flex h-8 items-center gap-2 text-sm">
          <input type="checkbox" name="ensaio" defaultChecked className="size-4 accent-primary" />
          Ensaio (não grava nada)
        </label>
        <Button type="submit" disabled={pending} className="h-10 rounded-xl px-4">
          {pending ? "Rodando…" : "Rodar agora"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Até 45 s por vez; o que não couber fica para a próxima rodada. Coletas reais consultam a API
        da Meta, e a extração usa a API da Anthropic (com custo).
      </p>
      <FormMessage state={state} />
    </form>
  );
}

export function RemovalDecision({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(removalAction, IDLE);
  return (
    <form onSubmit={submitWith(formAction)} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-end gap-2">
        <Button
          type="submit"
          name="decisao"
          value="confirmar"
          disabled={pending}
          className="h-9 rounded-xl px-3"
        >
          Confirmar remoção
        </Button>
        <Input
          name="motivo"
          aria-label="Motivo da recusa"
          placeholder="Motivo, se for recusar"
          className="h-9 w-56"
          maxLength={300}
        />
        <Button
          type="submit"
          name="decisao"
          value="recusar"
          variant="outline"
          disabled={pending}
          className="h-9 rounded-xl px-3"
        >
          Recusar
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function AddBlockForm({ kinds }: { kinds: Option[] }) {
  const [state, formAction, pending] = useActionState(addBlockAction, IDLE);
  return (
    <form onSubmit={submitWith(formAction)} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr_1fr]">
        <Field id="b-tipo" label="Tipo">
          <NativeSelect id="b-tipo" name="tipo" className="w-full">
            {kinds.map((k) => (
              <NativeSelectOption key={k.value} value={k.value}>
                {k.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field id="b-valor" label="Valor">
          <Input id="b-valor" name="valor" placeholder="(41) 99999-0000, @loja ou id do post" />
        </Field>
        <Field id="b-motivo" label="Motivo">
          <Input id="b-motivo" name="motivo" maxLength={300} />
        </Field>
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="h-10 self-start rounded-xl px-4">
        Bloquear
      </Button>
    </form>
  );
}

export function ClaimDecision({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(claimDecisionAction, IDLE);
  return (
    <form onSubmit={submitWith(formAction)} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-end gap-2">
        <Button
          type="submit"
          name="decisao"
          value="aprovar"
          disabled={pending}
          className="h-9 rounded-xl px-3"
        >
          Aprovar
        </Button>
        <Input
          name="motivo"
          aria-label="Motivo da recusa"
          placeholder="Motivo, se for recusar (o vendedor vê)"
          className="h-9 w-72"
          maxLength={500}
        />
        <Button
          type="submit"
          name="decisao"
          value="recusar"
          variant="outline"
          disabled={pending}
          className="h-9 rounded-xl px-3"
        >
          Recusar
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
