-- Buyers see the alerts a listing's own post declares (repasse, ágio, leilão,
-- sinistro, pedido de sinal...). They come from the public post text and are
-- filtered for display by the app ('sem_contato' is internal).
grant select (red_flags) on public.listings to anon, authenticated;

-- "Só repasse" / "sem repasse" filters.
create index listings_red_flags_idx on public.listings using gin (red_flags);
