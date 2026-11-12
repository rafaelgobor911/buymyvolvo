"use client";

import { Check, Copy, ExternalLink, MessageCircle, ShieldCheck } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { createInviteAction, recordDeclineAction } from "@/app/admin/(painel)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IDLE } from "@/lib/admin/form-state";
import type { OutreachStatus } from "@/lib/authorization/data";

import { Field, FormMessage } from "./form-bits";

export interface AuthorizationPanelProps {
  listingId: string;
  from: "moderacao" | "anuncios";
  status: OutreachStatus;
  /** Listing still in moderation: invites and declines are possible. */
  inModeration: boolean;
  /** Current commission setting ("R$ 1.500"), or null while not defined. */
  commission: string | null;
  invite: {
    url: string;
    message: string;
    invitedAt: string;
    expiresAt: string;
    expired: boolean;
    /** wa.me link to the phone published in the listing, with the message. */
    whatsappHref: string | null;
    /** Instagram Direct (ig.me) of the account that posted the listing. */
    instagramHref: string | null;
  } | null;
  authorized: {
    at: string;
    seller: { name: string; type: string; phone: string | null; email: string | null } | null;
    commission: string | null;
  } | null;
  declined: { at: string; reason: string | null } | null;
}

const submitInTransition =
  (action: (data: FormData) => void) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 rounded-lg"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? "Copiado" : label}
    </Button>
  );
}

function InviteForm({ listingId, renew }: { listingId: string; renew: boolean }) {
  const [state, formAction, pending] = useActionState(createInviteAction, IDLE);
  return (
    <form onSubmit={submitInTransition(formAction)} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={listingId} />
      {renew && <input type="hidden" name="renew" value="1" />}
      <Button
        type="submit"
        variant={renew ? "outline" : "default"}
        disabled={pending}
        className="h-10 self-start rounded-xl px-4"
      >
        {renew ? "Gerar novo link" : "Criar convite"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

function DeclineForm({ listingId, from }: { listingId: string; from: string }) {
  const [state, formAction, pending] = useActionState(recordDeclineAction, IDLE);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-9 self-start rounded-lg px-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        O vendedor não quer: registrar recusa
      </Button>
    );
  }
  return (
    <form onSubmit={submitInTransition(formAction)} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={listingId} />
      <input type="hidden" name="from" value={from} />
      <Field id="a-motivo" label="O que o vendedor disse (opcional)">
        <Input id="a-motivo" name="motivo" maxLength={300} />
      </Field>
      <p className="text-xs text-muted-foreground">
        O anúncio é rejeitado. Se o carro for postado de novo, volta para a moderação com o aviso de
        que o vendedor já recusou.
      </p>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="destructive"
          disabled={pending}
          className="h-9 rounded-lg px-3"
        >
          Registrar recusa
        </Button>
        <Button type="button" variant="ghost" className="h-9" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** "Autorização do vendedor": invite, follow-up and the seller's answer. */
export function AuthorizationPanel(props: AuthorizationPanelProps) {
  const { status, invite, authorized, declined } = props;
  return (
    <section
      aria-labelledby="autorizacao"
      className="flex flex-col gap-3 rounded-xl border border-border p-4 text-sm"
      data-outreach={status}
    >
      <h2 id="autorizacao" className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="size-4 text-primary" aria-hidden />
        Autorização do vendedor
      </h2>

      {status === "authorized" && authorized && (
        <div className="flex flex-col gap-1.5">
          <p className="font-medium text-primary">Autorizado em {authorized.at}.</p>
          {authorized.seller && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Vendedor</dt>
              <dd>
                {authorized.seller.name} ({authorized.seller.type})
              </dd>
              {authorized.seller.phone && (
                <>
                  <dt className="text-muted-foreground">WhatsApp</dt>
                  <dd className="font-mono">{authorized.seller.phone}</dd>
                </>
              )}
              {authorized.seller.email && (
                <>
                  <dt className="text-muted-foreground">E-mail</dt>
                  <dd>{authorized.seller.email}</dd>
                </>
              )}
              {authorized.commission && (
                <>
                  <dt className="text-muted-foreground">Comissão aceita</dt>
                  <dd>{authorized.commission}</dd>
                </>
              )}
            </dl>
          )}
          {props.inModeration && (
            <p className="text-muted-foreground">Revise os dados e aprove para publicar.</p>
          )}
        </div>
      )}

      {status === "declined" && declined && (
        <p>
          <span className="font-medium text-destructive">Recusou em {declined.at}</span>
          {declined.reason ? `: ${declined.reason}` : "."}
        </p>
      )}

      {(status === "to_contact" || status === "declined") && props.inModeration && (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground">
            Nenhum anúncio vai ao ar sem a autorização. Crie o convite e envie a mensagem ao
            vendedor pelo WhatsApp ou pelo Direct do Instagram.
          </p>
          {props.commission ? (
            <>
              <p>
                Comissão fixa que o vendedor vai ver: <strong>{props.commission}</strong>.
              </p>
              <InviteForm listingId={props.listingId} renew={false} />
            </>
          ) : (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-warning-foreground">
              Defina a comissão em{" "}
              <a href="/admin/configuracoes" className="font-medium underline">
                Configurações
              </a>{" "}
              antes de convidar: o vendedor precisa ver o valor para autorizar.
            </p>
          )}
        </div>
      )}

      {status === "invited" && invite && (
        <div className="flex flex-col gap-3">
          <p>
            Convite criado em {invite.invitedAt}.{" "}
            {invite.expired ? (
              <span className="font-medium text-destructive">O link venceu.</span>
            ) : (
              <span className="text-muted-foreground">O link vale até {invite.expiresAt}.</span>
            )}
          </p>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Mensagem para o vendedor
            </p>
            <p className="text-pretty break-words" data-testid="invite-message">
              {invite.message}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={invite.message} label="Copiar mensagem" />
            <CopyButton text={invite.url} label="Copiar link" />
            {invite.whatsappHref && (
              <a
                href={invite.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 font-medium hover:bg-muted"
              >
                <MessageCircle className="size-4" aria-hidden />
                Abrir no WhatsApp do vendedor
              </a>
            )}
            {invite.instagramHref && (
              <a
                href={invite.instagramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 font-medium hover:bg-muted"
              >
                <ExternalLink className="size-4" aria-hidden />
                Abrir o Direct do Instagram
              </a>
            )}
          </div>
          {props.inModeration && <InviteForm listingId={props.listingId} renew />}
        </div>
      )}

      {props.inModeration && status !== "authorized" && status !== "declined" && (
        <DeclineForm listingId={props.listingId} from={props.from} />
      )}
    </section>
  );
}
