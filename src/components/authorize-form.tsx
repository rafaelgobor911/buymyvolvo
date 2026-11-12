"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";

import { acceptInviteAction, declineInviteAction } from "@/app/autorizar/[codigo]/actions";
import { Field, FormMessage } from "@/components/admin/form-bits";
import { DocumentInput } from "@/components/document-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IDLE } from "@/lib/form-state";

const submitInTransition =
  (action: (data: FormData) => void) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };

export interface OtherListingOption {
  id: string;
  label: string;
}

export function AuthorizeForm({
  code,
  sellerType,
  others,
}: {
  code: string;
  sellerType: "loja" | "particular" | null;
  others: OtherListingOption[];
}) {
  const [state, formAction, pending] = useActionState(acceptInviteAction, IDLE);
  const error = (key: string) => state.errors?.[key];
  return (
    <form onSubmit={submitInTransition(formAction)} className="flex flex-col gap-5">
      <input type="hidden" name="codigo" value={code} />

      {others.length > 0 && (
        <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-medium">
            Outros anúncios seus esperando autorização
          </legend>
          <p className="text-sm text-muted-foreground">
            Marque os que também quer divulgar nas mesmas condições.
          </p>
          {others.map((o) => (
            <label key={o.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="outros"
                value={o.id}
                className="mt-0.5 size-4 accent-primary"
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      )}

      <Field id="az-nome" label="Seu nome ou o nome da loja" error={error("name")}>
        <Input
          id="az-nome"
          name="nome"
          maxLength={80}
          autoComplete="name"
          required
          aria-invalid={error("name") ? true : undefined}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Você é</legend>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["loja", "Loja"],
              ["particular", "Particular"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="tipo"
                value={value}
                defaultChecked={sellerType === value}
                required
                className="size-4 accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
        {error("type") && <p className="text-xs font-medium text-destructive">{error("type")}</p>}
      </fieldset>

      <Field
        id="az-whatsapp"
        label="Seu WhatsApp"
        hint="É por ele que vamos apresentar os compradores interessados."
        error={error("phone")}
      >
        <Input
          id="az-whatsapp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(11) 99999-0000"
          required
          aria-invalid={error("phone") ? true : undefined}
        />
      </Field>

      <DocumentInput
        id="az-cpf"
        name="cpf"
        kind="cpf"
        label="Seu CPF"
        hint="Se for loja, o CPF do responsável. Serve só para identificar quem autoriza; não aparece no anúncio."
        required
        serverError={error("cpf")}
      />

      <DocumentInput
        id="az-cnpj"
        name="cnpj"
        kind="cnpj"
        label="CNPJ da loja (opcional)"
        serverError={error("cnpj")}
      />

      <Field id="az-email" label="E-mail (opcional)" error={error("email")}>
        <Input
          id="az-email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={120}
          aria-invalid={error("email") ? true : undefined}
        />
      </Field>

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="termos" className="mt-0.5 size-4 accent-primary" />
          <span>
            Li e aceito os{" "}
            <Link
              href="/termos-do-anunciante"
              target="_blank"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Termos do Anunciante
            </Link>
            , incluindo a comissão e o uso das fotos do anúncio.
          </span>
        </label>
        {error("terms") && <p className="text-xs font-medium text-destructive">{error("terms")}</p>}
      </div>

      <FormMessage state={state} />
      <Button
        type="submit"
        disabled={pending}
        className="h-11 self-start rounded-xl px-5 text-base"
      >
        Autorizar a divulgação
      </Button>
    </form>
  );
}

export function DeclineInviteForm({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState(declineInviteAction, IDLE);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-10 self-start rounded-xl px-3 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        Não quero divulgar este anúncio
      </Button>
    );
  }
  return (
    <form onSubmit={submitInTransition(formAction)} className="flex flex-col gap-3">
      <input type="hidden" name="codigo" value={code} />
      <Field id="az-motivo" label="Quer contar o motivo? (opcional)">
        <Input id="az-motivo" name="motivo" maxLength={300} />
      </Field>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={pending} className="h-10 rounded-xl">
          Confirmar: não divulgar
        </Button>
        <Button type="button" variant="ghost" className="h-10" onClick={() => setOpen(false)}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
