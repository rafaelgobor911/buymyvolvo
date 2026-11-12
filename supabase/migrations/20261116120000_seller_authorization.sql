-- Phase 8a: intermediated model. Buy My Volvo now intermediates every sale:
-- a listing only goes public after its seller authorizes the intermediation
-- (/autorizar/<code>), and buyers talk to Buy My Volvo's WhatsApp, not to the
-- seller. Listings published before this change go back to moderation.

-- --- Seller authorization ------------------------------------------------------

alter table public.listings add column authorized_at timestamptz;

comment on column public.listings.authorized_at is
  'When the seller authorized Buy My Volvo to intermediate this listing (terms accepted). Required to be public.';

-- One row per listing once the admin starts the conversation with the seller
-- (no row = still to contact). The invite link is signed with HASH_SALT over
-- the listing and invited_at, so a new invite invalidates the previous link.
create table public.listing_outreach (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited', 'authorized', 'declined')),
  invited_at timestamptz,
  invited_by text,
  responded_at timestamptz,
  seller_id uuid references public.sellers (id) on delete set null,
  -- What the seller accepted: the Termos do Anunciante version and the fixed
  -- commission shown on the page (app_settings.seller_commission_brl, in cents).
  terms_version text,
  commission_cents integer check (commission_cents > 0),
  decline_reason text check (char_length(decline_reason) <= 500),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'invited' or invited_at is not null),
  check (status = 'invited' or responded_at is not null),
  check (status <> 'authorized' or (terms_version is not null and commission_cents is not null))
);
create index listing_outreach_seller_idx on public.listing_outreach (seller_id);

create trigger listing_outreach_set_updated_at before update on public.listing_outreach
  for each row execute function public.set_updated_at();

alter table public.listing_outreach enable row level security;
revoke all on public.listing_outreach from anon, authenticated;

-- Sellers who authorize on the invite page (no login): the link was sent to the
-- contact published in the listing.
alter table public.sellers drop constraint sellers_verified_via_check;
alter table public.sellers add constraint sellers_verified_via_check
  check (verified_via in ('instagram_login', 'whatsapp_code', 'manual', 'invite_link'));

-- --- Published listings go back to moderation ----------------------------------

with moved as (
  update public.listings set status = 'pending_review'
  where status = 'active' and authorized_at is null
  returning id
)
insert into public.audit_log (actor, action, entity, entity_id, changes, note)
select 'system:migration', 'listing.status', 'listing', id::text,
  jsonb_build_object('status', jsonb_build_object('from', 'active', 'to', 'pending_review')),
  'Modelo intermediado: aguarda a autorização do vendedor'
from moved;

alter table public.listings add constraint listings_active_requires_authorization
  check (status <> 'active' or authorized_at is not null);

-- Public pages only see authorized listings (sold and expired included).
drop policy "visible listings are public" on public.listings;
create policy "visible listings are public" on public.listings
  for select to anon, authenticated
  using (status in ('active', 'sold', 'expired') and authorized_at is not null);

-- --- Contact through Buy My Volvo ----------------------------------------------

-- Which Buy My Volvo WhatsApp number received the lead (round-robin when there
-- are two). Set on insert only (the leads guard blocks later changes).
alter table public.leads
  add column routed_to text check (routed_to ~ '^\+[1-9][0-9]{7,14}$');

insert into public.app_settings (key, value, description) values
  ('bmv_whatsapp_numbers', to_jsonb(''::text),
   'WhatsApp do Buy My Volvo que recebe os contatos (um ou dois números; com dois, revezamento)'),
  ('seller_commission_brl', '0',
   'Comissão fixa paga pelo vendedor, em reais (0 = ainda não definida: o convite fica bloqueado)'),
  ('authorization_invite_template',
   to_jsonb('Olá! Aqui é do {site}, um site que reúne anúncios de Volvo seminovos. Vimos o seu Volvo {modelo} {versao} {ano} e gostaríamos de divulgá-lo e levar compradores até você. Veja as condições e autorize por este link: {link}'::text),
   'Mensagem do convite de autorização enviada ao vendedor')
on conflict (key) do nothing;

-- Buyers now write to Buy My Volvo, not to the seller: the old default message
-- ("Vi seu Volvo...") is replaced, a customized one is kept.
update public.app_settings
set value = to_jsonb('Olá! Tenho interesse no Volvo {modelo} {versao} {ano} anunciado no {site} ({url}). Ainda está disponível? (ref. {ref})'::text)
where key = 'whatsapp_message_template'
  and value = to_jsonb('Olá! Vi seu Volvo {modelo} {versao} {ano} anunciado no {site} ({url}). Ainda está disponível? (ref. {ref})'::text);
