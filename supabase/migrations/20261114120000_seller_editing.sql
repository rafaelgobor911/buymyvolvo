-- Phase 6b: the seller's own description of a claimed listing (public; shown
-- instead of the automatic summary). Photos use listing_photos (Phase 1).
alter table public.listings
  add column seller_description text check (char_length(seller_description) <= 2000);
grant select (seller_description) on public.listings to anon, authenticated;
