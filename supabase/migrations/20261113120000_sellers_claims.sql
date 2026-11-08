-- Phase 6a: seller claims, terms acceptance and public removal requests.

-- Sellers and anonymous visitors (the removal form) also leave audit entries.
alter table public.audit_log drop constraint audit_log_actor_check;
alter table public.audit_log add constraint audit_log_actor_check
  check (actor ~ '^(admin|system|seller|public):.+');

-- A seller asking to own a listing. Proof for now is manual: the seller sends
-- the claim code from the listing's own WhatsApp or Instagram, and an admin
-- checks it. 'instagram_login' and 'whatsapp_code' come later.
create table public.listing_claims (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  seller_id uuid not null references public.sellers (id) on delete cascade,
  method text not null check (method in ('manual', 'instagram_login', 'whatsapp_code')),
  code text not null unique check (code ~ '^[A-Z0-9-]{6,20}$'),
  evidence text check (char_length(evidence) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  decision_note text check (char_length(decision_note) <= 500)
);
create unique index listing_claims_one_pending_idx on public.listing_claims (listing_id, seller_id)
  where status = 'pending';
create index listing_claims_status_idx on public.listing_claims (status, created_at);
create index listing_claims_seller_idx on public.listing_claims (seller_id, created_at desc);

-- Every version of the terms a seller accepted (sellers.terms_* keeps the latest).
create table public.terms_acceptances (
  id bigint generated always as identity primary key,
  seller_id uuid not null references public.sellers (id) on delete cascade,
  terms text not null check (terms in ('seller_terms', 'photo_license')),
  version text not null,
  accepted_at timestamptz not null default now(),
  unique (seller_id, terms, version)
);

-- Removal form without login: a salted hash of the requester's IP, only to
-- limit how many removals one device can ask for.
alter table public.removal_requests add column requester_ip_hash text;
create index removal_requests_ip_idx on public.removal_requests (requester_ip_hash, created_at);

alter table public.listing_claims enable row level security;
alter table public.terms_acceptances enable row level security;
revoke all on public.listing_claims, public.terms_acceptances from anon, authenticated;

insert into public.app_settings (key, value, description) values
  ('removal_requests_per_day', '3', 'Pedidos de remoção aceitos por aparelho em 24 horas (contra abuso)')
on conflict (key) do nothing;
