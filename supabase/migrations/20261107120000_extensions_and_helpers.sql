-- Extensions and shared helpers.
-- On Supabase, extensions live in the `extensions` schema.

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent() is STABLE; an IMMUTABLE wrapper is needed for indexes and generated values.
create or replace function public.immutable_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, value) $$;

-- Lowercase + no accents. Used for city matching and trigram search.
create or replace function public.normalize_text(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$ select lower(public.immutable_unaccent(value)) $$;

-- Portuguese full-text configuration that ignores accents ("eletrico" = "elétrico").
create text search configuration public.pt_unaccent (copy = pg_catalog.portuguese);
alter text search configuration public.pt_unaccent
  alter mapping for hword, hword_part, word
  with extensions.unaccent, portuguese_stem;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;
