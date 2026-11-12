"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useMemo, useState } from "react";

import { type PublicFormState, submitListingAction } from "@/app/anunciar/actions";
import { Field, FormMessage, textareaClass } from "@/components/admin/form-bits";
import { DocumentInput } from "@/components/document-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { downscale, PHOTO_UPLOAD_MAX_BYTES } from "@/lib/photos/downscale";
import type { Option, PublicFormOptions } from "@/lib/submissions/form";

const IDLE: PublicFormState = { status: "idle" };
const MAX_PHOTOS = 15;

type Upload = { name: string; status: "fila" | "enviando" | "ok" | "erro"; error?: string };

function Select({
  id,
  name,
  options,
  value,
  onChange,
  empty,
  invalid,
  required,
}: {
  id: string;
  name: string;
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  empty: string;
  invalid?: boolean;
  required?: boolean;
}) {
  return (
    <NativeSelect
      id={id}
      name={name}
      className="w-full"
      required={required}
      aria-invalid={invalid ? true : undefined}
      {...(onChange
        ? { value: value ?? "", onChange: (e) => onChange(e.target.value) }
        : { defaultValue: "" })}
    >
      <NativeSelectOption value="">{empty}</NativeSelectOption>
      {options.map((o) => (
        <NativeSelectOption key={o.value} value={o.value}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/** "Anuncie no Buy My Volvo": car, place, photos, seller and the terms. */
export function PublicListingForm({
  options,
  photosEnabled,
}: {
  options: PublicFormOptions;
  photosEnabled: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitListingAction, IDLE);
  const [modelId, setModelId] = useState("");
  const [engineId, setEngineId] = useState("");
  const [trimId, setTrimId] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [uploading, setUploading] = useState(false);
  const error = (key: string) => state.errors?.[key];
  const engines = options.enginesByModel[modelId] ?? [];
  const trims = options.trimsByModel[modelId] ?? [];
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  // Sent: upload the photos one by one with the token, then the thank-you page.
  useEffect(() => {
    if (state.status !== "saved") return;
    const sent = state.sent;
    if (!sent || photos.length === 0) {
      router.push("/anunciar/enviado");
      return;
    }
    let cancelled = false;
    (async () => {
      setUploading(true);
      setUploads(photos.map((f) => ({ name: f.name, status: "fila" })));
      let sentCount = 0;
      for (const [i, file] of photos.entries()) {
        if (cancelled) return;
        const set = (u: Upload) => setUploads((prev) => prev.map((p, j) => (j === i ? u : p)));
        set({ name: file.name, status: "enviando" });
        let blob: Blob = file;
        try {
          blob = await downscale(file);
        } catch {
          // The server validates and converts anyway.
        }
        const data = new FormData();
        data.append("anuncio", sent.listingId);
        data.append("token", sent.token);
        data.append("foto", blob, "foto.jpg");
        const response = await fetch("/anunciar/fotos", { method: "POST", body: data }).catch(
          () => null,
        );
        const body = (await response?.json().catch(() => null)) as {
          ok: boolean;
          error?: string;
        } | null;
        if (body?.ok) {
          sentCount++;
          set({ name: file.name, status: "ok" });
        } else {
          set({ name: file.name, status: "erro", error: body?.error ?? "falha no envio" });
        }
      }
      setUploading(false);
      router.push(
        `/anunciar/enviado?fotos=${sentCount}${sentCount < photos.length ? `&falharam=${photos.length - sentCount}` : ""}`,
      );
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per successful submission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  const addPhotos = (files: FileList) => {
    const accepted = Array.from(files).filter((f) => f.size <= PHOTO_UPLOAD_MAX_BYTES);
    setPhotos((prev) => [...prev, ...accepted].slice(0, MAX_PHOTOS));
  };

  const busy = pending || uploading;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" aria-busy={busy}>
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Site</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-4 text-xl font-semibold">O carro</legend>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="p-modelo" label="Modelo" error={error("modelId")}>
            <Select
              id="p-modelo"
              name="modelo"
              options={options.models}
              value={modelId}
              onChange={(v) => {
                setModelId(v);
                setEngineId("");
                setTrimId("");
              }}
              empty="Escolha"
              invalid={!!error("modelId")}
              required
            />
          </Field>
          <Field id="p-motor" label="Motor (opcional)" error={error("engineId")}>
            <Select
              id="p-motor"
              name="motor"
              options={engines}
              value={engineId}
              onChange={setEngineId}
              empty={modelId ? "Não sei / outro" : "Escolha o modelo"}
              invalid={!!error("engineId")}
            />
          </Field>
          <Field id="p-versao" label="Versão (opcional)" error={error("trimId")}>
            <Select
              id="p-versao"
              name="versao"
              options={trims}
              value={trimId}
              onChange={setTrimId}
              empty={modelId ? "Não sei / outra" : "Escolha o modelo"}
              invalid={!!error("trimId")}
            />
          </Field>
        </div>
        <Field
          id="p-versao-texto"
          label="Versão como está no documento (opcional)"
          hint='Por exemplo: "Recharge T8 Plug-in Hybrid".'
        >
          <Input id="p-versao-texto" name="versao_texto" maxLength={60} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-4">
          <Field id="p-ano-fab" label="Ano de fabricação" error={error("yearFab")}>
            <Input id="p-ano-fab" name="ano_fab" inputMode="numeric" maxLength={4} />
          </Field>
          <Field id="p-ano-modelo" label="Ano-modelo" error={error("yearModel")}>
            <Input
              id="p-ano-modelo"
              name="ano_modelo"
              inputMode="numeric"
              maxLength={4}
              required
              aria-invalid={error("yearModel") ? true : undefined}
            />
          </Field>
          <Field id="p-km" label="Km" error={error("km")}>
            <Input
              id="p-km"
              name="km"
              inputMode="numeric"
              placeholder="45.000"
              required
              aria-invalid={error("km") ? true : undefined}
            />
          </Field>
          <Field id="p-preco" label="Preço (R$)" error={error("priceCents")}>
            <Input
              id="p-preco"
              name="preco"
              inputMode="numeric"
              placeholder="189.900"
              required
              aria-invalid={error("priceCents") ? true : undefined}
            />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="p-cor" label="Cor (opcional)">
            <Input id="p-cor" name="cor" maxLength={40} />
          </Field>
          <Field id="p-cambio" label="Câmbio (opcional)" error={error("transmission")}>
            <Select id="p-cambio" name="cambio" options={options.transmissions} empty="—" />
          </Field>
          <Field id="p-combustivel" label="Combustível (opcional)" error={error("fuel")}>
            <Select id="p-combustivel" name="combustivel" options={options.fuels} empty="—" />
          </Field>
        </div>
        <Field
          id="p-itens"
          label="Itens de destaque (opcional)"
          hint="Separados por vírgula: teto solar, som Bowers & Wilkins, 7 lugares…"
        >
          <Input id="p-itens" name="itens" maxLength={600} />
        </Field>
        <Field
          id="p-descricao"
          label="Descrição (opcional)"
          hint="Estado, revisões, histórico. Aparece no anúncio; não coloque telefone, e-mail ou links."
          error={error("description")}
        >
          <textarea
            id="p-descricao"
            name="descricao"
            rows={5}
            maxLength={2000}
            className={textareaClass}
            aria-invalid={error("description") ? true : undefined}
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-4 text-xl font-semibold">Onde está</legend>
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <Field id="p-cidade" label="Cidade" error={error("city")}>
            <Input
              id="p-cidade"
              name="cidade"
              maxLength={80}
              autoComplete="address-level2"
              required
              aria-invalid={error("city") ? true : undefined}
            />
          </Field>
          <Field id="p-uf" label="UF" error={error("uf")}>
            <Select
              id="p-uf"
              name="uf"
              options={options.ufs}
              empty="Escolha"
              invalid={!!error("uf")}
              required
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-4 text-xl font-semibold">Fotos</legend>
        {photosEnabled ? (
          <>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Escolher fotos ({photos.length} de {MAX_PHOTOS})
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                disabled={busy || photos.length >= MAX_PHOTOS}
                onChange={(e) => {
                  if (e.target.files?.length) addPhotos(e.target.files);
                  e.target.value = "";
                }}
                className="text-sm font-normal file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm disabled:opacity-50"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Até {MAX_PHOTOS} fotos (JPEG, PNG, WebP ou AVIF, até 10 MB cada). A primeira é a capa.
              As fotos perdem os dados do celular, como a localização.
            </p>
            {photos.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Fotos escolhidas">
                {photos.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL) */}
                    <img
                      src={previews[i]}
                      alt={`Foto ${i + 1}${i === 0 ? " (capa)" : ""}`}
                      className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
                    />
                    {!busy && (
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 rounded-full bg-background/90 p-1 shadow"
                        aria-label={`Tirar a foto ${i + 1}`}
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            O envio de fotos ainda não está disponível. Depois do cadastro, a nossa equipe pede as
            fotos pelo WhatsApp.
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-4 text-xl font-semibold">Seus dados</legend>
        <p className="-mt-2 text-sm text-muted-foreground">
          Não aparecem no anúncio. Servem só para a nossa equipe falar com você sobre esta venda.
        </p>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Você é</legend>
          <div className="flex flex-wrap gap-4">
            {(
              [
                ["particular", "Particular"],
                ["loja", "Loja"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="tipo"
                  value={value}
                  required
                  className="size-4 accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
          {error("sellerType") && (
            <p className="text-xs font-medium text-destructive">{error("sellerType")}</p>
          )}
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="p-nome" label="Seu nome ou o nome da loja" error={error("name")}>
            <Input
              id="p-nome"
              name="nome"
              maxLength={80}
              autoComplete="name"
              required
              aria-invalid={error("name") ? true : undefined}
            />
          </Field>
          <Field id="p-whatsapp" label="Seu WhatsApp" error={error("phone")}>
            <Input
              id="p-whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 99999-0000"
              required
              aria-invalid={error("phone") ? true : undefined}
            />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <DocumentInput
            id="p-cpf"
            name="cpf"
            kind="cpf"
            label="Seu CPF"
            hint="Se for loja, o CPF do responsável. Só para identificar quem anuncia."
            required
            serverError={error("cpf")}
          />
          <DocumentInput
            id="p-cnpj"
            name="cnpj"
            kind="cnpj"
            label="CNPJ da loja (opcional)"
            serverError={error("cnpj")}
          />
        </div>
        <Field
          id="p-email"
          label="E-mail (opcional)"
          error={error("email")}
          className="sm:max-w-md"
        >
          <Input
            id="p-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={120}
            aria-invalid={error("email") ? true : undefined}
          />
        </Field>
      </fieldset>

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
            , incluindo a comissão e o uso das fotos que eu enviar.
          </span>
        </label>
        {error("terms") && <p className="text-xs font-medium text-destructive">{error("terms")}</p>}
      </div>

      {state.status === "error" && <FormMessage state={state} />}
      {uploads.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm" aria-live="polite">
          {uploads.map((u, i) => (
            <li
              key={i}
              className={u.status === "erro" ? "text-destructive" : "text-muted-foreground"}
            >
              Foto {i + 1}:{" "}
              {u.status === "fila"
                ? "na fila"
                : u.status === "enviando"
                  ? "enviando…"
                  : u.status === "ok"
                    ? "enviada"
                    : `não enviada (${u.error})`}
            </li>
          ))}
        </ul>
      )}
      <Button type="submit" disabled={busy} className="h-11 self-start rounded-xl px-5 text-base">
        {uploading ? "Enviando as fotos…" : pending ? "Enviando…" : "Enviar anúncio"}
      </Button>
    </form>
  );
}
