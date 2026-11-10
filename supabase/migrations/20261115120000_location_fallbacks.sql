-- Location fallbacks for listings whose post does not say where the car is
-- (src/lib/extraction/location.ts): the shop's default location, set by the
-- admin, and the state of the phone's area code (DDD), shown as an estimate.

alter table public.sources
  add column default_city text check (char_length(default_city) between 1 and 80),
  add column default_uf char(2) check (default_uf in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
    'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ));

comment on column public.sources.default_city is
  'Shop accounts: city used when a post does not say where the car is (admin, Fontes).';

alter table public.listings
  add column uf_from_ddd boolean not null default false;

comment on column public.listings.uf_from_ddd is
  'The state was inferred from the phone area code (no city); the page says it is an estimate.';

grant select (uf_from_ddd) on public.listings to anon, authenticated;

-- Mirror of UF_BY_DDD (a test keeps both in sync).
create or replace function public.uf_from_phone(phone text) returns char(2)
language sql immutable as $$
  select case substr(phone, 4, 2)
      when '11' then 'SP'
      when '12' then 'SP'
      when '13' then 'SP'
      when '14' then 'SP'
      when '15' then 'SP'
      when '16' then 'SP'
      when '17' then 'SP'
      when '18' then 'SP'
      when '19' then 'SP'
      when '21' then 'RJ'
      when '22' then 'RJ'
      when '24' then 'RJ'
      when '27' then 'ES'
      when '28' then 'ES'
      when '31' then 'MG'
      when '32' then 'MG'
      when '33' then 'MG'
      when '34' then 'MG'
      when '35' then 'MG'
      when '37' then 'MG'
      when '38' then 'MG'
      when '41' then 'PR'
      when '42' then 'PR'
      when '43' then 'PR'
      when '44' then 'PR'
      when '45' then 'PR'
      when '46' then 'PR'
      when '47' then 'SC'
      when '48' then 'SC'
      when '49' then 'SC'
      when '51' then 'RS'
      when '53' then 'RS'
      when '54' then 'RS'
      when '55' then 'RS'
      when '61' then 'DF'
      when '62' then 'GO'
      when '64' then 'GO'
      when '63' then 'TO'
      when '65' then 'MT'
      when '66' then 'MT'
      when '67' then 'MS'
      when '68' then 'AC'
      when '69' then 'RO'
      when '71' then 'BA'
      when '73' then 'BA'
      when '74' then 'BA'
      when '75' then 'BA'
      when '77' then 'BA'
      when '79' then 'SE'
      when '81' then 'PE'
      when '87' then 'PE'
      when '82' then 'AL'
      when '83' then 'PB'
      when '84' then 'RN'
      when '85' then 'CE'
      when '88' then 'CE'
      when '86' then 'PI'
      when '89' then 'PI'
      when '91' then 'PA'
      when '93' then 'PA'
      when '94' then 'PA'
      when '92' then 'AM'
      when '97' then 'AM'
      when '95' then 'RR'
      when '96' then 'AP'
      when '98' then 'MA'
      when '99' then 'MA'
  end
  where phone ~ '^\+55[0-9]{10,11}$'
$$;

-- Listings already published without any location: the state of the DDD.
update public.listings
set uf = public.uf_from_phone(contact_phone_e164), uf_from_ddd = true
where city is null and uf is null and not is_claimed
  and public.uf_from_phone(contact_phone_e164) is not null;
