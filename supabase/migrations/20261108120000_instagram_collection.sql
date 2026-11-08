-- Phase 3: state for the Instagram collection jobs.
-- New columns stay internal: anon only has column-level grants on raw_posts
-- (id, permalink, ig_username, media_type, posted_at) and nothing on sources.

-- Profile read through Business Discovery (the bio is a contact/city fallback)
-- and the health of each source.
alter table public.sources
  add column ig_user_id text,
  add column ig_name text,
  add column ig_biography text,
  add column ig_website text,
  add column ig_media_count integer check (ig_media_count >= 0),
  add column profile_fetched_at timestamptz,
  add column last_error text,
  add column last_error_at timestamptz,
  add column consecutive_failures integer not null default 0 check (consecutive_failures >= 0);

-- Lifecycle: when a post was last returned by the API, when it disappeared and
-- when its caption last changed (e.g. edited to "VENDIDO").
alter table public.raw_posts
  add column last_seen_at timestamptz,
  add column gone_at timestamptz,
  add column caption_changed_at timestamptz;

update public.raw_posts set last_seen_at = fetched_at where last_seen_at is null;
alter table public.raw_posts alter column last_seen_at set default now();
alter table public.raw_posts alter column last_seen_at set not null;

create index raw_posts_live_idx on public.raw_posts (source_id, posted_at desc)
  where gone_at is null;

insert into public.app_settings (key, value, description) values
  ('hashtag_budget_max', '25', 'Hashtags únicas por 7 dias (o limite da Meta é 30; a folga cobre buscas manuais)'),
  ('business_discovery_pages', '2', 'Páginas de 25 posts lidas por conta a cada coleta'),
  ('token_alert_days', '10', 'Avisar quando o token do Instagram vencer em menos dias que isso')
on conflict (key) do nothing;
