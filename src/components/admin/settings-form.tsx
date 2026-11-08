"use client";

import { startTransition, useActionState, useState } from "react";

import { saveSettingsAction } from "@/app/admin/(painel)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IDLE } from "@/lib/admin/form-state";
import { renderMessage, unknownPlaceholders } from "@/lib/leads/message";

import { Field, FormMessage, textareaClass } from "./form-bits";

export interface SettingField {
  key: string;
  label: string;
  help: string;
  kind: "text" | "number";
  min?: number;
  max?: number;
  step?: number;
  value: string | number;
}

const SAMPLE = {
  modelo: "XC60",
  versao: "T8 Polestar Engineered",
  ano: 2024,
  url: "/a/4245s2",
  ref: "VX-7K3P9",
};

export function SettingsForm({
  fields,
  siteName,
  siteUrl,
}: {
  fields: SettingField[];
  siteName: string;
  siteUrl: string;
}) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, IDLE);
  const template = fields.find((f) => f.key === "whatsapp_message_template");
  const [draft, setDraft] = useState(String(template?.value ?? ""));
  const unknown = unknownPlaceholders(draft);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" aria-busy={pending}>
      {fields.map((f) =>
        f.kind === "text" ? (
          <div key={f.key} className="flex flex-col gap-3">
            <Field id={`c-${f.key}`} label={f.label} hint={f.help} error={state.errors?.[f.key]}>
              <textarea
                id={`c-${f.key}`}
                name={f.key}
                rows={3}
                maxLength={500}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className={textareaClass}
                aria-invalid={state.errors?.[f.key] ? true : undefined}
              />
            </Field>
            <div className="rounded-xl border border-border bg-card p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Prévia com um anúncio de exemplo
              </p>
              <p className="text-pretty">
                {renderMessage(draft, {
                  ...SAMPLE,
                  site: siteName,
                  url: `${siteUrl}${SAMPLE.url}`,
                })}
              </p>
              {unknown.length > 0 && (
                <p className="mt-1 text-xs font-medium text-destructive">
                  Variável desconhecida: {`{${unknown[0]}}`}
                </p>
              )}
            </div>
          </div>
        ) : (
          <Field
            key={f.key}
            id={`c-${f.key}`}
            label={f.label}
            hint={f.help}
            error={state.errors?.[f.key]}
            className="max-w-sm"
          >
            <Input
              id={`c-${f.key}`}
              name={f.key}
              type="number"
              min={f.min}
              max={f.max}
              step={f.step ?? 1}
              defaultValue={f.value}
              aria-invalid={state.errors?.[f.key] ? true : undefined}
            />
          </Field>
        ),
      )}
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="h-10 self-start rounded-xl px-4">
        Salvar configurações
      </Button>
    </form>
  );
}
