alter table public.profiles
  add column federation_enabled boolean not null default false,
  add constraint profiles_federation_requires_public check(not federation_enabled or not is_private);

grant update(federation_enabled) on public.profiles to authenticated;
