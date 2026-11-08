-- "Marcar como vendido": did the buyer come through the site? true/false, or
-- null when the seller does not know. When the seller names the contact,
-- that lead's outcome is set too (leads.outcome).
alter table public.listings add column sold_via_site boolean;
