-- Phase 5a: admin moderation, audit trail and extraction corrections.

-- 'rejected': moderation decided the post is not a usable listing (not a car
-- for sale, not a Volvo, bad extraction). Hidden like 'removed', but unlike a
-- seller's removal a repost of the same car goes back to moderation.
alter table public.listings drop constraint listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('pending_review', 'active', 'sold', 'expired', 'removed', 'rejected'));
alter table public.listings
  add column rejected_at timestamptz,
  add column review_note text check (char_length(review_note) <= 500);

-- Every admin action and automated change worth explaining later: who, what,
-- when and the values before and after. Append-only.
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  -- 'admin:<email>' or 'system:<job or process>'
  actor text not null check (actor ~ '^(admin|system):.+'),
  action text not null,
  entity text not null,
  entity_id text,
  -- { "<field>": { "from": <old>, "to": <new> } }
  changes jsonb not null default '{}'::jsonb,
  note text check (char_length(note) <= 500)
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id, at desc);
create index audit_log_at_idx on public.audit_log (at desc);

create or replace function public.audit_log_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;
create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function public.audit_log_append_only();

-- Fields a moderator corrected, with the source post: material for new gold
-- cases and few-shot examples of the extraction.
create table public.extraction_corrections (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  raw_post_id uuid references public.raw_posts (id) on delete set null,
  field text not null,
  extracted jsonb,
  corrected jsonb,
  admin_email text not null
);
create index extraction_corrections_listing_idx on public.extraction_corrections (listing_id);

-- Internal tables: RLS on, nothing granted to API roles (admin reads and
-- writes on the server with the owner role, after checking the session).
alter table public.audit_log enable row level security;
alter table public.extraction_corrections enable row level security;
revoke all on public.audit_log, public.extraction_corrections from anon, authenticated;
