import { Mail } from "lucide-react";

import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";

/**
 * "Receber link por e-mail": a plain form posting to a Server Action, which
 * redirects back with ?link=enviado. Works before hydration.
 */
export function LoginLinkForm({
  action,
  next,
  sent,
  available,
}: {
  action: (form: FormData) => Promise<void>;
  next?: string;
  sent: boolean;
  available: boolean;
}) {
  if (sent) {
    return (
      <p role="status" className="flex gap-2 rounded-xl border border-border p-4 text-sm">
        <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span>
          Se o e-mail tiver acesso, enviamos um link para entrar. Confira a caixa de entrada e o
          spam; o link vale por pouco tempo e só pode ser usado uma vez.
        </span>
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      {/* Trap for bots: people never see or fill it. */}
      <div aria-hidden className="hidden">
        <label>
          Não preencha
          <input type="text" name="site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        E-mail
        <Input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          disabled={!available}
          className="h-11 rounded-xl"
        />
      </label>
      <SubmitButton
        variant="outline"
        pendingLabel="Enviando…"
        disabled={!available}
        className="h-11 rounded-xl text-base"
      >
        <Mail aria-hidden />
        Receber link de acesso
      </SubmitButton>
      {!available && (
        <p className="text-xs text-muted-foreground">
          O login por e-mail é ativado quando o projeto do Supabase for configurado.
        </p>
      )}
    </form>
  );
}
