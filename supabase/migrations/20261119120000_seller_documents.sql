-- Phase 9b: identity of sellers who authorize or send a listing. CPF is
-- required (for shops, the CPF of the person responsible); CNPJ is optional,
-- for shops. Both checked by their verification digits in the app. Private:
-- anon only has the column grants of the public seller profile.

alter table public.sellers
  add column cpf char(11) check (cpf ~ '^[0-9]{11}$'),
  add column cnpj text check (cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$');

comment on column public.sellers.cpf is
  'CPF of the seller (or of the person responsible for the shop), digits only. Private.';
comment on column public.sellers.cnpj is
  'CNPJ of the shop (numeric or alphanumeric format), when given. Private.';

-- One seller per CPF: the forms find the seller by CPF before the phone.
create unique index sellers_cpf_key on public.sellers (cpf) where cpf is not null;
