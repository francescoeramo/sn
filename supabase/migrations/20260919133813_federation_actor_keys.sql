-- Keys stay server-only. Requiring a fresh opt-in avoids exposing actors that do not yet have a key.
update public.profiles set federation_enabled=false where federation_enabled;

create table public.federation_actor_keys (
  actor_id uuid primary key references public.profiles(id) on delete cascade,
  public_key_pem text not null check(public_key_pem like '-----BEGIN PUBLIC KEY-----%'),
  private_key_encrypted text not null check(private_key_encrypted like 'v1:%'),
  created_at timestamptz not null default now()
);

alter table public.federation_actor_keys enable row level security;
revoke all on public.federation_actor_keys from public,anon,authenticated;
grant all on public.federation_actor_keys to service_role;
