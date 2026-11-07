-- Vehicle taxonomy. Ids are stable slugs ('xc60', 't8', 'r-design') so seeds and
-- code can reference them in every environment. Data lives in
-- 20261107120400_taxonomy_data.sql, generated from src/lib/taxonomy/data.ts.

create table public.vehicle_models (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null unique,
  body_types text[] not null default '{}',
  aliases text[] not null default '{}',
  parent_id text references public.vehicle_models (id),
  renamed_from_id text references public.vehicle_models (id),
  renamed_scope text check (renamed_scope in ('all', 'electric')),
  year_start smallint not null,
  year_end smallint,
  sort_order smallint not null default 0,
  review_note text,
  check (year_end is null or year_end >= year_start),
  check ((renamed_from_id is null) = (renamed_scope is null))
);

create table public.vehicle_generations (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  model_id text not null references public.vehicle_models (id) on delete cascade,
  name text not null,
  year_start smallint not null,
  year_end smallint,
  platform text check (platform in ('P80', 'P1', 'P2', 'P3', 'SPA', 'SPA2', 'CMA', 'SEA')),
  review_note text,
  check (year_end is null or year_end >= year_start)
);
create index vehicle_generations_model_idx on public.vehicle_generations (model_id);

create table public.vehicle_engines (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null unique,
  fuels text[] not null
    check (fuels <@ array['gasolina', 'diesel', 'hibrido_leve', 'hibrido_plugin', 'eletrico']),
  platforms text[] not null default '{}',
  model_ids text[],
  aliases text[] not null default '{}',
  year_start smallint not null,
  year_end smallint,
  review_note text,
  check (year_end is null or year_end >= year_start)
);

create table public.vehicle_trims (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null unique,
  model_ids text[],
  engine_ids text[],
  aliases text[] not null default '{}',
  year_start smallint not null,
  year_end smallint,
  review_note text,
  check (year_end is null or year_end >= year_start)
);
