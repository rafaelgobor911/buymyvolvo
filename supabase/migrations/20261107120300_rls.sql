-- Row Level Security on EVERY table.
--
-- Model: the browser never talks to the database. Public pages read through the
-- server as role `anon`; every write goes through server code using the table
-- owner (or service_role). So anon/authenticated only get SELECT on public data,
-- restricted by policies and, where needed, by column grants.

alter table public.vehicle_models enable row level security;
alter table public.vehicle_generations enable row level security;
alter table public.vehicle_engines enable row level security;
alter table public.vehicle_trims enable row level security;
alter table public.sources enable row level security;
alter table public.raw_posts enable row level security;
alter table public.sellers enable row level security;
alter table public.listings enable row level security;
alter table public.listing_sources enable row level security;
alter table public.listing_photos enable row level security;
alter table public.leads enable row level security;
alter table public.removal_requests enable row level security;
alter table public.blocklist enable row level security;
alter table public.hashtag_budget enable row level security;
alter table public.job_runs enable row level security;
alter table public.job_locks enable row level security;
alter table public.app_settings enable row level security;

-- Defense in depth: no direct writes or reads by API roles unless granted below.
revoke all on all tables in schema public from anon, authenticated;

-- --- Taxonomy: public ---------------------------------------------------------
grant select on public.vehicle_models, public.vehicle_generations,
  public.vehicle_engines, public.vehicle_trims to anon, authenticated;

create policy "taxonomy is public" on public.vehicle_models
  for select to anon, authenticated using (true);
create policy "taxonomy is public" on public.vehicle_generations
  for select to anon, authenticated using (true);
create policy "taxonomy is public" on public.vehicle_engines
  for select to anon, authenticated using (true);
create policy "taxonomy is public" on public.vehicle_trims
  for select to anon, authenticated using (true);

-- --- Listings: visible statuses only, no contact phone or internal fields ------
grant select (
  id, slug, status, origin, model_id, engine_id, trim_id, version_text, year_fab, year_model,
  km, price_cents, city, uf, color, transmission, fuel, options, summary_ptbr, seller_type,
  seller_id, contact_ig_username, is_claimed, is_featured, first_seen_at, last_seen_at,
  expires_at, sold_at, search_text, search_vector
) on public.listings to anon, authenticated;

create policy "visible listings are public" on public.listings
  for select to anon, authenticated
  using (status in ('active', 'sold', 'expired'));

-- --- Things hanging off visible listings -------------------------------------
grant select on public.listing_sources to anon, authenticated;
create policy "sources of visible listings" on public.listing_sources
  for select to anon, authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id and l.status in ('active', 'sold', 'expired')
  ));

-- raw_posts: only what the listing page needs (permalink + author credit), never the caption.
grant select (id, permalink, ig_username, media_type, posted_at) on public.raw_posts to anon, authenticated;
create policy "posts behind visible listings" on public.raw_posts
  for select to anon, authenticated
  using (exists (
    select 1
    from public.listing_sources ls
    join public.listings l on l.id = ls.listing_id
    where ls.raw_post_id = raw_posts.id and l.status in ('active', 'sold', 'expired')
  ));

grant select (id, listing_id, storage_path, width, height, position) on public.listing_photos to anon, authenticated;
create policy "photos of visible listings" on public.listing_photos
  for select to anon, authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id and l.status in ('active', 'sold', 'expired')
  ));

-- sellers: public profile fields only (no phone, e-mail, plan or commission).
grant select (id, display_name, type, verified_via) on public.sellers to anon, authenticated;
create policy "seller public profile" on public.sellers
  for select to anon, authenticated
  using (exists (
    select 1 from public.listings l
    where l.seller_id = sellers.id and l.status in ('active', 'sold', 'expired')
  ));

-- leads, removal_requests, blocklist, sources, hashtag_budget, job_runs,
-- job_locks, app_settings: RLS on, no policies → invisible to anon/authenticated.
-- Admin policies arrive in Phase 5.
