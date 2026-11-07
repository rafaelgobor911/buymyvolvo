-- Core marketplace schema: sources → raw_posts → listings, sellers, leads,
-- removals/blocklist and operational tables. Enumerations are text + CHECK so
-- they are easy to evolve with later migrations.

-- --- Collection --------------------------------------------------------------

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('ig_business_account', 'ig_hashtag', 'manual')),
  handle text not null,
  active boolean not null default true,
  poll_interval_minutes integer not null default 180 check (poll_interval_minutes > 0),
  last_polled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, handle)
);

create table public.raw_posts (
  id uuid primary key default gen_random_uuid(),
  ig_media_id text not null unique,
  source_id uuid not null references public.sources (id),
  permalink text not null,
  caption text,
  media_type text check (media_type in ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM')),
  ig_username text,
  posted_at timestamptz,
  fetched_at timestamptz not null default now(),
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'not_listing', 'extracted', 'error')),
  extraction_json jsonb,
  extraction_model text,
  tokens_in integer check (tokens_in >= 0),
  tokens_out integer check (tokens_out >= 0),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index raw_posts_status_idx on public.raw_posts (processing_status, fetched_at);
create index raw_posts_source_idx on public.raw_posts (source_id, posted_at desc);

-- --- Sellers -----------------------------------------------------------------

create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  type text not null check (type in ('loja', 'particular')),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  ig_username text,
  email text,
  verified_via text check (verified_via in ('instagram_login', 'whatsapp_code', 'manual')),
  verified_at timestamptz,
  terms_version_accepted text,
  terms_accepted_at timestamptz,
  plan text not null default 'free' check (plan in ('free', 'destaque', 'loja_pro')),
  commission_rate numeric(5, 4) check (commission_rate between 0 and 1),
  auth_user_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- Listings ----------------------------------------------------------------

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'active', 'sold', 'expired', 'removed')),
  origin text not null check (origin in ('instagram', 'direct')),
  model_id text not null references public.vehicle_models (id),
  engine_id text references public.vehicle_engines (id),
  trim_id text references public.vehicle_trims (id),
  -- Version text as published ("T5 Momentum 2.0 Drive-E"); taxonomy ids are the source of truth.
  version_text text,
  year_fab smallint check (year_fab between 1970 and 2100),
  year_model smallint check (year_model between 1970 and 2100),
  km integer check (km >= 0),
  price_cents bigint check (price_cents > 0),
  city text,
  uf char(2) check (uf in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
    'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  )),
  color text,
  transmission text check (transmission in ('manual', 'automatico')),
  fuel text check (fuel in ('gasolina', 'diesel', 'hibrido_leve', 'hibrido_plugin', 'eletrico')),
  options text[] not null default '{}',
  summary_ptbr text,
  seller_type text not null default 'desconhecido'
    check (seller_type in ('loja', 'particular', 'desconhecido')),
  seller_id uuid references public.sellers (id) on delete set null,
  contact_phone_e164 text check (contact_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  contact_ig_username text,
  confidence numeric(3, 2) check (confidence between 0 and 1),
  red_flags text[] not null default '{}',
  is_claimed boolean not null default false,
  is_featured boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz,
  sold_at timestamptz,
  removed_at timestamptz,
  dedupe_key text,
  -- Maintained by listings_refresh_search(); never written by the app.
  search_text text not null default '',
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (year_fab is null or year_model is null or year_model between year_fab and year_fab + 1),
  check (status <> 'active' or (year_model is not null and (price_cents is not null or contact_phone_e164 is not null or contact_ig_username is not null)))
);

create index listings_search_vector_idx on public.listings using gin (search_vector);
create index listings_search_text_trgm_idx on public.listings using gin (search_text extensions.gin_trgm_ops);
create index listings_active_model_idx on public.listings (model_id, engine_id, trim_id, year_model)
  where status = 'active';
create index listings_active_recent_idx on public.listings (first_seen_at desc) where status = 'active';
create index listings_active_price_idx on public.listings (price_cents) where status = 'active';
create index listings_active_km_idx on public.listings (km) where status = 'active';
create index listings_active_uf_idx on public.listings (uf, price_cents) where status = 'active';
create index listings_status_idx on public.listings (status);
create index listings_seller_idx on public.listings (seller_id);
create index listings_dedupe_idx on public.listings (dedupe_key);

create or replace function public.listings_refresh_search()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_model text;
  v_engine text;
  v_trim text;
  v_head text;
begin
  select name into v_model from public.vehicle_models where id = new.model_id;
  select name into v_engine from public.vehicle_engines where id = new.engine_id;
  select name into v_trim from public.vehicle_trims where id = new.trim_id;
  v_head := concat_ws(' ', 'Volvo', v_model, v_engine, v_trim, new.version_text);

  new.search_text := public.normalize_text(concat_ws(' ',
    v_head, new.color, new.city, new.uf, array_to_string(new.options, ' '), new.summary_ptbr));
  new.search_vector :=
    setweight(to_tsvector('public.pt_unaccent', v_head), 'A') ||
    setweight(to_tsvector('public.pt_unaccent', concat_ws(' ', new.color, array_to_string(new.options, ' '))), 'B') ||
    setweight(to_tsvector('public.pt_unaccent', concat_ws(' ', new.city, new.uf, new.summary_ptbr)), 'C');
  return new;
end
$$;

create trigger listings_refresh_search
  before insert or update of model_id, engine_id, trim_id, version_text, color, city, uf, options, summary_ptbr
  on public.listings
  for each row execute function public.listings_refresh_search();

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- One listing ↔ many raw posts (same car announced in several places).
create table public.listing_sources (
  listing_id uuid not null references public.listings (id) on delete cascade,
  raw_post_id uuid not null unique references public.raw_posts (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (listing_id, raw_post_id)
);
create unique index listing_sources_one_primary_idx on public.listing_sources (listing_id) where is_primary;

-- Only for claimed listings or direct submissions, with the licence recorded.
create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  seller_id uuid not null references public.sellers (id),
  storage_path text not null unique,
  width integer check (width > 0),
  height integer check (height > 0),
  position smallint not null default 0,
  license_terms_version text not null,
  license_granted_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index listing_photos_listing_idx on public.listing_photos (listing_id, position);

-- --- Leads (auditable: never deleted with the listing) -----------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete restrict,
  seller_id uuid references public.sellers (id) on delete set null,
  ref_code text not null unique check (ref_code ~ '^[A-Z]{2}-[0-9A-Z]{4,8}$'),
  channel text not null check (channel in ('whatsapp', 'instagram')),
  created_at timestamptz not null default now(),
  ip_hash text,
  ua_hash text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  outcome text not null default 'unknown' check (outcome in ('unknown', 'sold_via_site', 'not_sold')),
  outcome_reported_at timestamptz
);
create index leads_listing_idx on public.leads (listing_id, created_at desc);
create index leads_seller_idx on public.leads (seller_id, created_at desc);
create index leads_dedupe_idx on public.leads (listing_id, ip_hash, ua_hash, created_at desc);

-- --- Removal & blocklist -----------------------------------------------------

create table public.removal_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  requester_contact text,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by text
);
create index removal_requests_status_idx on public.removal_requests (status, created_at);

create table public.blocklist (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ig_media_id', 'phone', 'ig_username')),
  value text not null,
  reason text,
  removal_request_id uuid references public.removal_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

-- --- Operations --------------------------------------------------------------

-- Hashtags count against Meta's 30-per-rolling-7-days limit from their first query.
create table public.hashtag_budget (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text not null,
  hashtag text not null check (hashtag ~ '^[a-z0-9_]+$'),
  ig_hashtag_id text,
  window_started_at timestamptz not null default now(),
  last_queried_at timestamptz not null default now(),
  unique (ig_user_id, hashtag, window_started_at)
);
create index hashtag_budget_window_idx on public.hashtag_budget (ig_user_id, window_started_at desc);

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'skipped')),
  dry_run boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}',
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  ai_cost_usd numeric(10, 4) not null default 0,
  error text
);
create index job_runs_job_idx on public.job_runs (job_name, started_at desc);

-- Lease-based lock (works through Supabase's transaction pooler, unlike advisory locks).
create table public.job_locks (
  job_name text primary key,
  locked_until timestamptz not null,
  locked_by text not null
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.app_settings (key, value, description) values
  ('whatsapp_message_template',
   to_jsonb('Olá! Vi seu Volvo {modelo} {versao} {ano} anunciado no {site} ({url}). Ainda está disponível? (ref. {ref})'::text),
   'Mensagem pré-preenchida do WhatsApp'),
  ('publish_confidence_threshold', '0.85', 'Confiança mínima para publicar sem moderação'),
  ('hashtag_stale_after_days', '14', 'Aviso "pode não estar mais disponível" em posts de hashtag'),
  ('hashtag_expire_after_days', '30', 'Expiração de posts de hashtag');

-- updated_at triggers
create trigger sources_set_updated_at before update on public.sources
  for each row execute function public.set_updated_at();
create trigger raw_posts_set_updated_at before update on public.raw_posts
  for each row execute function public.set_updated_at();
create trigger sellers_set_updated_at before update on public.sellers
  for each row execute function public.set_updated_at();
create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();
