"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect } from "react";

import { rejectListingAction, setStatusAction } from "@/app/admin/(painel)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { IDLE } from "@/lib/admin/form-state";

import { Field, FormMessage, type Option } from "./form-bits";

const submitInTransition =
  (action: (data: FormData) => void) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };

export function RejectForm({
  id,
  from,
  reasons,
}: {
  id: string;
  from: "moderacao" | "anuncios";
  reasons: readonly string[];
}) {
  const [state, formAction, pending] = useActionState(rejectListingAction, IDLE);
  return (
    <form onSubmit={submitInTransition(formAction)} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="from" value={from} />
      <Field id="r-motivo" label="Motivo da rejeição">
        <NativeSelect
          id="r-motivo"
          name="motivo"
          defaultValue=""
          className="w-full"
          data-shortcut="r"
          required
        >
          <NativeSelectOption value="" disabled>
            Escolha o motivo (R)
          </NativeSelectOption>
          {reasons.map((r) => (
            <NativeSelectOption key={r} value={r}>
              {r}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field id="r-detalhe" label="Detalhe (opcional)">
        <Input id="r-detalhe" name="detalhe" maxLength={300} />
      </Field>
      <FormMessage state={state} />
      <Button
        type="submit"
        variant="destructive"
        disabled={pending}
        className="h-10 self-start rounded-xl px-4"
      >
        Rejeitar
      </Button>
    </form>
  );
}

export function StatusForm({
  id,
  status,
  statuses,
}: {
  id: string;
  status: string;
  statuses: Option[];
}) {
  const [state, formAction, pending] = useActionState(setStatusAction, IDLE);
  return (
    <form onSubmit={submitInTransition(formAction)} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <Field id="s-status" label="Status">
        <NativeSelect id="s-status" name="status" defaultValue={status} className="w-full">
          {statuses.map((s) => (
            <NativeSelectOption key={s.value} value={s.value}>
              {s.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field id="s-detalhe" label="Motivo (obrigatório para rejeitar)">
        <Input id="s-detalhe" name="detalhe" maxLength={300} />
      </Field>
      <FormMessage state={state} />
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="h-10 self-start rounded-xl px-4"
      >
        Alterar status
      </Button>
    </form>
  );
}

/**
 * Keyboard shortcuts of the moderation screen: A approves, S saves, R goes to
 * the rejection reason, J/K open the next/previous listing. Inside a field,
 * Ctrl/Cmd+Enter approves (or saves).
 */
export function ModerationShortcuts({
  prevHref,
  nextHref,
}: {
  prevHref: string | null;
  nextHref: string | null;
}) {
  const router = useRouter();
  useEffect(() => {
    const click = (key: string) =>
      document.querySelector<HTMLButtonElement>(`button[data-shortcut="${key}"]:not(:disabled)`);
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        const button = click("a") ?? click("s");
        if (button) {
          event.preventDefault();
          button.click();
        }
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "a" || key === "s") {
        const button = click(key);
        if (button) {
          event.preventDefault();
          button.click();
        }
      } else if (key === "r") {
        event.preventDefault();
        document.querySelector<HTMLElement>('[data-shortcut="r"]')?.focus();
      } else if (key === "j" && nextHref) router.push(nextHref);
      else if (key === "k" && prevHref) router.push(prevHref);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, prevHref, nextHref]);
  return null;
}
