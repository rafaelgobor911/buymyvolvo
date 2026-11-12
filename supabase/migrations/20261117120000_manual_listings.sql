-- Phase 9a: listings the admin creates from an ad text pasted by hand (what a
-- seller sent on WhatsApp, or the text of their ad on another site, copied by
-- a person: never collected automatically). The text stays internal, like an
-- Instagram caption; the page shows the structured data and a summary.

alter table public.listings drop constraint listings_origin_check;
alter table public.listings add constraint listings_origin_check
  check (origin in ('instagram', 'direct', 'admin'));

create table public.manual_sources (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings (id) on delete cascade,
  channel text not null
    check (channel in ('whatsapp', 'olx', 'webmotors', 'marketplace', 'instagram', 'other')),
  source_url text check (source_url ~ '^https?://' and char_length(source_url) <= 500),
  text text not null check (char_length(text) between 20 and 5000),
  created_by text not null check (created_by ~ '^admin:.+'),
  extraction_json jsonb,
  extraction_model text,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz not null default now()
);

alter table public.manual_sources enable row level security;
revoke all on public.manual_sources from anon, authenticated;
