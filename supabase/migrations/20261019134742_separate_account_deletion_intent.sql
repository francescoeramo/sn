-- Suspension is reversible; only a password-confirmed owner request authorizes deletion.
-- Do not backfill from disabled: legacy suspensions and interrupted deletions are ambiguous.
create table private.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table private.account_deletion_requests enable row level security;
revoke all on private.account_deletion_requests from public, anon, authenticated;

create function public.begin_account_deletion(target uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.profiles set disabled=true where id=target;
  if not found then raise exception 'Account non disponibile'; end if;
  insert into private.account_deletion_requests(user_id) values(target)
    on conflict(user_id) do nothing;
end $$;
revoke all on function public.begin_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.begin_account_deletion(uuid) to service_role;

create function public.pending_account_deletions() returns table(id uuid)
language sql stable security definer set search_path='' as $$
  select user_id from private.account_deletion_requests
  order by requested_at,user_id limit 20;
$$;
revoke all on function public.pending_account_deletions() from public, anon, authenticated;
grant execute on function public.pending_account_deletions() to service_role;

-- Rollback: stop maintenance first; retain intent records until all requested deletions
-- have completed. Never restore a disabled-only cleanup selector.
