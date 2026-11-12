"use client";

import { startTransition, useActionState, useState } from "react";

import { saveSettingsAction } from "@/app/admin/(painel)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IDLE } from "@/lib/admin/form-state";
import type { SettingGroup, SettingKind } from "@/lib/admin/settings";
import { inviteTemplateProblem, renderInvite } from "@/lib/authorization/messages";
import { renderMessage, unknownPlaceholders } from "@/lib/leads/message";

import { Field, FormMessage, textareaClass } from "./form-bits";

export interface SettingField {
  key: string;
  label: string;
  help: string;
  kind: SettingKind;
  group: SettingGroup;
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
  groups,
  siteName,
  siteUrl,
}: {
  fields: SettingField[];
  groups: Record<SettingGroup, string>;
  siteName: string;
  siteUrl: string;
}) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, IDLE);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" aria-busy={pending}>
      {(Object.keys(groups) as SettingGroup[]).map((group) => (
        <fieldset key={group} className="flex flex-col gap-6">
          <legend className="mb-4 text-lg font-semibold">{groups[group]}</legend>
          {fields
            .filter((f) => f.group === group)
            .map((f) =>
              f.kind === "message" || f.kind === "invite" ? (
                <TemplateField
                  key={f.key}
                  field={f}
                  error={state.errors?.[f.key]}
                  siteName={siteName}
                  siteUrl={siteUrl}
                />
              ) : (
                <Field
                  key={f.key}
                  id={`c-${f.key}`}
                  label={f.label}
                  hint={f.help}
                  error={state.errors?.[f.key]}
                  className={f.kind === "phones" ? "max-w-xl" : "max-w-sm"}
                >
                  <Input
                    id={`c-${f.key}`}
                    name={f.key}
                    {...(f.kind === "phones"
                      ? { type: "text", inputMode: "tel", placeholder: "(11) 99999-0000" }
                      : { type: "number", min: f.min, max: f.max, step: f.step ?? 1 })}
                    defaultValue={f.value}
                    aria-invalid={state.errors?.[f.key] ? true : undefined}
                  />
                </Field>
              ),
            )}
        </fieldset>
      ))}
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="h-10 self-start rounded-xl px-4">
        Salvar configurações
      </Button>
    </form>
  );
}

function TemplateField({
  field: f,
  error,
  siteName,
  siteUrl,
}: {
  field: SettingField;
  error?: string;
  siteName: string;
  siteUrl: string;
}) {
  const [draft, setDraft] = useState(String(f.value ?? ""));
  const problem =
    f.kind === "invite"
      ? inviteTemplateProblem(draft.trim())
      : unknownPlaceholders(draft).length
        ? `Variável desconhecida: {${unknownPlaceholders(draft)[0]}}`
        : null;
  const preview =
    f.kind === "invite"
      ? renderInvite(draft, {
          ...SAMPLE,
          site: siteName,
          link: `${siteUrl}/autorizar/4245s2.Xk3…`,
        })
      : renderMessage(draft, { ...SAMPLE, site: siteName, url: `${siteUrl}${SAMPLE.url}` });
  return (
    <div className="flex flex-col gap-3">
      <Field id={`c-${f.key}`} label={f.label} hint={f.help} error={error}>
        <textarea
          id={`c-${f.key}`}
          name={f.key}
          rows={f.kind === "invite" ? 4 : 3}
          maxLength={f.kind === "invite" ? 700 : 500}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={textareaClass}
          aria-invalid={error ? true : undefined}
        />
      </Field>
      <div className="rounded-xl border border-border bg-card p-3 text-sm">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Prévia com um anúncio de exemplo
        </p>
        <p className="text-pretty">{preview}</p>
        {problem && draft.trim() && (
          <p className="mt-1 text-xs font-medium text-destructive">{problem}</p>
        )}
      </div>
    </div>
  );
}
