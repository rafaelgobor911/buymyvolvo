-- Phase 4: contact clicks (WhatsApp or Instagram) recorded as leads.

-- Short public code of a listing (the last part of its slug), used by
-- /r/<code> (contact click) and /a/<code> (short link in the WhatsApp message).
-- has_phone tells the page which button to show without exposing the number.
alter table public.listings
  add column short_id text generated always as (substring(slug from '[^-]+$')) stored,
  add column has_phone boolean generated always as (contact_phone_e164 is not null) stored;
create unique index listings_short_id_key on public.listings (short_id);
grant select (short_id, has_phone) on public.listings to anon, authenticated;

-- A repeated click (same listing, same IP+UA hash, within lead_dedupe_hours)
-- reuses the first lead's ref code and only bumps the counter.
alter table public.leads
  add column click_count integer not null default 1 check (click_count >= 1),
  add column last_clicked_at timestamptz not null default now();

-- Leads are the audit trail behind any future charge: once written, only the
-- seller link, the sale outcome (Phase 6) and the repeat-click counter change,
-- and rows are never deleted. Disposable test databases opt out per transaction
-- with `set local buymyvolvo.allow_lead_delete = 'on'`.
create or replace function public.leads_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('buymyvolvo.allow_lead_delete', true), '') = 'on' then
      return old;
    end if;
    raise exception 'Leads are an audit trail and cannot be deleted (lead %).', old.ref_code;
  end if;
  if (new.id, new.listing_id, new.ref_code, new.channel, new.created_at, new.ip_hash, new.ua_hash,
      new.referrer, new.utm_source, new.utm_medium, new.utm_campaign)
     is distinct from
     (old.id, old.listing_id, old.ref_code, old.channel, old.created_at, old.ip_hash, old.ua_hash,
      old.referrer, old.utm_source, old.utm_medium, old.utm_campaign) then
    raise exception 'Only seller_id, outcome and click counters of a lead can change (lead %).', old.ref_code;
  end if;
  return new;
end;
$$;

create trigger leads_guard before update or delete on public.leads
  for each row execute function public.leads_guard();

insert into public.app_settings (key, value, description) values
  ('lead_dedupe_hours', '24', 'Cliques repetidos do mesmo aparelho no mesmo anúncio contam como um só lead nesse intervalo (horas)')
on conflict (key) do nothing;
