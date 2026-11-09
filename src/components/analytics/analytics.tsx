"use client";

import Link from "next/link";
import { useEffect, useId, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  type ConsentChoice,
  consentVersionKey,
  onConsentOpen,
  openConsentPreferences,
  parseConsent,
  readStoredConsent,
  saveConsent,
  subscribeConsent,
} from "@/lib/analytics/consent";
import { applyConsent, type EventParams, type GoogleTagConfig, track } from "@/lib/analytics/gtag";

const serverSnapshot = () => undefined;

function useConsent(version: string) {
  const raw = useSyncExternalStore(subscribeConsent, readStoredConsent, serverSnapshot);
  // undefined: not hydrated yet (render nothing); null: no valid choice yet.
  return { raw, choice: raw === undefined ? undefined : parseConsent(raw, version) };
}

/**
 * Consent banner + Google tag. Mounted only when a tag is configured
 * (NEXT_PUBLIC_GA_MEASUREMENT_ID or NEXT_PUBLIC_GOOGLE_ADS_ID). Clicks on
 * elements with data-track="<event>" (and JSON in data-track-params) become
 * events; nothing is sent without consent.
 */
export function Analytics({ config }: { config: GoogleTagConfig }) {
  const version = consentVersionKey({ ads: !!config.adsId });
  const { raw, choice } = useConsent(version);
  const [open, setOpen] = useState(false);

  useEffect(() => onConsentOpen(() => setOpen(true)), []);

  useEffect(() => {
    if (choice) applyConsent(choice, config);
    // raw is the stable identity of the choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest("[data-track]") : null;
      if (!el) return;
      let params: EventParams = {};
      try {
        params = JSON.parse(el.getAttribute("data-track-params") ?? "{}") as EventParams;
      } catch {
        // malformed params: send the event alone
      }
      track(el.getAttribute("data-track")!, params);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (choice === undefined || (choice && !open)) return null;
  return (
    <ConsentBanner
      key={raw ?? "new"}
      initial={choice}
      offerAds={!!config.adsId}
      onSave={(next) => {
        saveConsent(next, version);
        setOpen(false);
      }}
      onClose={choice ? () => setOpen(false) : undefined}
    />
  );
}

function ConsentBanner({
  initial,
  offerAds,
  onSave,
  onClose,
}: {
  initial: ConsentChoice | null;
  offerAds: boolean;
  onSave: (choice: ConsentChoice) => void;
  onClose?: () => void;
}) {
  const id = useId();
  const [custom, setCustom] = useState(!!initial);
  const [analytics, setAnalytics] = useState(initial?.analytics ?? false);
  const [ads, setAds] = useState(initial?.ads ?? false);
  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
      data-consent-banner
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-border bg-background p-5 shadow-lg">
        <div className="flex flex-col gap-2">
          <h2 id={`${id}-titulo`} className="font-semibold">
            Cookies e privacidade
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            Usamos cookies essenciais para o site funcionar. Com a sua permissão, usamos também
            cookies do Google para medir o uso do site
            {offerAds ? " e o resultado de campanhas de publicidade" : ""}. Você pode mudar a
            escolha quando quiser, no rodapé.{" "}
            <Link
              href="/privacidade"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Política de Privacidade
            </Link>
          </p>
        </div>
        {custom && (
          <fieldset className="flex flex-col gap-3 text-sm">
            <legend className="sr-only">Categorias de cookies</legend>
            <label className="flex items-start gap-3">
              <input type="checkbox" checked disabled className="mt-0.5 size-4 accent-primary" />
              <span>
                <span className="font-medium">Essenciais</span>
                <span className="block text-muted-foreground">
                  Login, sua escolha de cookies e o tema. Sempre ativos.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                <span className="font-medium">Medição</span>
                <span className="block text-muted-foreground">
                  Google Analytics: páginas vistas e cliques de contato, sem dados seus.
                </span>
              </span>
            </label>
            {offerAds && (
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={ads}
                  onChange={(e) => setAds(e.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  <span className="font-medium">Publicidade</span>
                  <span className="block text-muted-foreground">
                    Google Ads: medir os contatos que vêm de anúncios do site.
                  </span>
                </span>
              </label>
            )}
          </fieldset>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
          )}
          {custom ? (
            <Button variant="outline" onClick={() => onSave({ analytics, ads: offerAds && ads })}>
              Salvar escolhas
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setCustom(true)}>
              Personalizar
            </Button>
          )}
          <Button variant="outline" onClick={() => onSave({ analytics: false, ads: false })}>
            Recusar
          </Button>
          <Button onClick={() => onSave({ analytics: true, ads: offerAds })}>Aceitar todos</Button>
        </div>
      </div>
    </section>
  );
}

/** Footer link that reopens the cookie preferences. */
export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openConsentPreferences} className={className}>
      Preferências de cookies
    </button>
  );
}

/** Sends one event when rendered (per `id`), e.g. view_item on a listing page. */
export function TrackEvent({
  name,
  id,
  params,
}: {
  name: string;
  id: string;
  params: EventParams;
}) {
  useEffect(() => {
    track(name, params);
    // one event per page/item
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, id]);
  return null;
}
