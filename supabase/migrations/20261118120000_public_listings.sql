-- Phase 9b: listings sent by sellers through the public form "Anuncie no Buy
-- My Volvo". The seller accepts the Termos do Anunciante (with the commission
-- and the photo license) in the form itself, so the listing enters moderation
-- already authorized; the admin reviews and approves.

-- One row per listing sent by the form: a salted hash of the sender's IP, only
-- to limit how many listings one device can send per day (nothing else about
-- the device is kept).
create table public.listing_submissions (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index listing_submissions_ip_idx on public.listing_submissions (ip_hash, created_at);

alter table public.listing_submissions enable row level security;
revoke all on public.listing_submissions from anon, authenticated;

insert into public.app_settings (key, value, description) values
  ('public_listings_per_day', '3',
   'Anúncios aceitos pelo formulário público por aparelho em 24 horas (contra abuso)')
on conflict (key) do nothing;
