-- -----------------------------------------------------------------------------
-- LOCAL ONLY: recreates the pieces a Supabase project already ships with, so the
-- migrations in ../migrations run unchanged on a plain Postgres 16.
-- scripts/db/migrate.ts applies this file only when the `auth` schema is missing.
-- NEVER run against a Supabase project.
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists extensions;
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);

create or replace function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;

create or replace function auth.role() returns text
language sql stable
as $$ select coalesce(auth.jwt() ->> 'role', current_user) $$;

grant usage on schema public, extensions, auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Supabase default privileges: table access is open, RLS does the filtering.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
