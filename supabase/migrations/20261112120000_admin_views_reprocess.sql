-- Phase 5b: page views for the click rate, and reprocessing of edited captions.

-- Views of a listing page per day: only a number, nothing about the visitor
-- (bots and prefetches are not counted). Click rate = leads / views.
create table public.listing_views_daily (
  listing_id uuid not null references public.listings (id) on delete cascade,
  day date not null,
  views integer not null default 0 check (views >= 0),
  primary key (listing_id, day)
);
create index listing_views_daily_day_idx on public.listing_views_daily (day);

alter table public.listing_views_daily enable row level security;
revoke all on public.listing_views_daily from anon, authenticated;

-- When an edited caption (caption_changed_at) was last re-extracted, so each
-- edit is processed once.
alter table public.raw_posts add column reprocessed_at timestamptz;
