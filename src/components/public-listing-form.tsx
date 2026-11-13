"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useMemo, useState } from "react";

import { type PublicFormState, submitListingAction } from "@/app/anunciar/actions";
import { Field, FormMessage, textareaClass } from "@/components/admin/form-bits";
import { DocumentInput } from "@/components/document-input";
import { PhotoPicker } from "@/components/photo-picker";
import { CHOICE_BOX, CHOICE_ROW, PUBLIC_FIELDS } from "@/components/public-fields";
import { SellerTypeChoice, type SellerTypeValue } from "@/components/seller-type-choice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { downscale, PHOTO_UPLOAD_MAX_BYTES } from "@/lib/photos/downscale";
import type { Option, PublicFormOptions } from "@/lib/submissions/form";
import { cn } from "@/lib/utils";

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
  ...aria
}: {
  id: string;
  name: string;
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  empty: string;
  invalid?: boolean;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  return (
    <NativeSelect
      id={id}
      name={name}
      className="w-full"
      required={required}
      aria-describedby={aria["aria-describedby"]}
      aria-invalid={invalid || aria["aria-invalid"] ? true : undefined}
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
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const [sellerType, setSellerType] = useState<SellerTypeValue>("");
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

  // Never drop a photo silently: say which ones stayed out and why.
  const addPhotos = (files: FileList) => {
    const chosen = Array.from(files);
    const images = chosen.filter((f) => f.type.startsWith("image/"));
    const fitting = images.filter((f) => f.size <= PHOTO_UPLOAD_MAX_BYTES);
    const room = Math.max(0, MAX_PHOTOS - photos.length);
    const accepted = fitting.slice(0, room);
    const notes: string[] = [];
    const notImages = chosen.length - images.length;
    const tooBig = images.length - fitting.length;
    const overLimit = fitting.length - accepted.length;
    if (notImages) {
      notes.push(
        notImages === 1
          ? "1 arquivo não é foto e ficou de fora."
          : `${notImages} arquivos não são fotos e ficaram de fora.`,
      );
    }
    if (tooBig) {
      notes.push(
        tooBig === 1
          ? "1 foto tem mais de 10 MB e ficou de fora."
          : `${tooBig} fotos têm mais de 10 MB e ficaram de fora.`,
      );
    }
    if (overLimit) {
      notes.push(
        `O limite é de ${MAX_PHOTOS} fotos: ${overLimit === 1 ? "1 ficou" : `${overLimit} ficaram`} de fora.`,
      );
    }
    setPhotoNotice(notes.length ? notes.join(" ") : null);
    setPhotos((prev) => [...prev, ...accepted]);
  };

  const busy = pending || uploading;

  return (
    <form onSubmit={onSubmit} className={cn("flex flex-col gap-8", PUBLIC_FIELDS)} aria-busy={busy}>
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
            <PhotoPicker
              label={photos.length ? "Escolher mais fotos" : "Escolher fotos"}
              detail={`${photos.length} de ${MAX_PHOTOS} escolhidas`}
              disabled={busy || photos.length >= MAX_PHOTOS}
              describedBy="p-fotos-dica p-fotos-aviso"
              onFiles={addPhotos}
            />
            <p id="p-fotos-dica" className="text-xs text-pretty text-muted-foreground">
              Até {MAX_PHOTOS} fotos (JPEG, PNG, WebP ou AVIF, até 10 MB cada). A primeira é a capa.
              As fotos perdem os dados do celular, como a localização.
            </p>
            <p
              id="p-fotos-aviso"
              role="status"
              className={cn(
                "text-sm font-medium text-warning-foreground",
                !photoNotice && "sr-only",
              )}
            >
              {photoNotice}
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
                        className="absolute -top-1.5 -right-1.5 flex size-11 items-center justify-center rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        aria-label={`Tirar a foto ${i + 1}`}
                      >
                        <span className="flex size-7 items-center justify-center rounded-full border border-border bg-background/95">
                          <X className="size-4" aria-hidden />
                        </span>
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
        <SellerTypeChoice
          idPrefix="p"
          value={sellerType}
          onChange={setSellerType}
          error={error("sellerType")}
        />
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
            hint="Se for loja, o CPF do responsável. Só para identificar quem anuncia; nunca aparece no site."
            required
            serverError={error("cpf")}
          />
          {/* Only shops have a CNPJ; the server ignores it for private sellers too. */}
          {sellerType === "loja" && (
            <DocumentInput
              id="p-cnpj"
              name="cnpj"
              kind="cnpj"
              label="CNPJ da loja (opcional)"
              serverError={error("cnpj")}
            />
          )}
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
        <label className={cn(CHOICE_ROW, "items-start py-2.5")}>
          <input
            type="checkbox"
            name="termos"
            className={CHOICE_BOX}
            aria-describedby={error("terms") ? "p-termos-erro" : undefined}
            aria-invalid={error("terms") ? true : undefined}
          />
          <span className="text-pretty">
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
        {error("terms") && (
          <p id="p-termos-erro" className="text-xs font-medium text-destructive">
            {error("terms")}
          </p>
        )}
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
      <Button
        type="submit"
        disabled={busy}
        className="h-12 w-full rounded-xl px-6 text-base sm:w-auto sm:self-start"
      >
        {uploading ? "Enviando as fotos…" : pending ? "Enviando…" : "Enviar anúncio"}
      </Button>
    </form>
  );
}
