create table private.federation_withdrawals (
  actor_id uuid primary key references public.profiles(id) on delete cascade,
  event_key uuid unique not null default gen_random_uuid(),
  attempts integer not null default 0,
  available_at timestamptz not null default now()
);
alter table private.federation_withdrawals enable row level security;
grant all on private.federation_withdrawals to service_role;

create function private.revoke_federation_profile() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if new.disabled or (new.is_private and not old.is_private) then
    new.federation_enabled:=false;
  end if;
  return new;
end $$;
create trigger sn_revoke_federation_profile before update on public.profiles
for each row execute function private.revoke_federation_profile();

create function private.queue_federation_withdrawal() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if old.federation_enabled and not new.federation_enabled then
    insert into private.federation_withdrawals(actor_id)
    values(new.id)
    on conflict(actor_id) do update
      set event_key=gen_random_uuid(),attempts=0,available_at=now();
  end if;
  return new;
end $$;
create trigger sn_queue_federation_withdrawal after update on public.profiles
for each row execute function private.queue_federation_withdrawal();

create function public.claim_federation_withdrawals(batch_size integer default 4)
returns table(actor_id uuid,event_key uuid,actor_key uuid,attempts integer)
language plpgsql security definer set search_path=''
as $$
begin
  if batch_size not between 1 and 10 then raise exception 'Dimensione batch non valida'; end if;
  return query
  with candidates as (
    select w.actor_id from private.federation_withdrawals w
    where w.available_at<=now()
    order by w.available_at,w.actor_id
    limit batch_size for update skip locked
  )
  update private.federation_withdrawals w
  set attempts=w.attempts+1,available_at=now()+interval '5 minutes'
  from candidates c,public.profiles p
  where w.actor_id=c.actor_id and p.id=w.actor_id
  returning w.actor_id,w.event_key,p.actor_key,w.attempts;
end $$;

create function public.complete_federation_withdrawal(target_actor uuid,outgoing jsonb)
returns integer
language plpgsql security definer set search_path=''
as $$
declare inserted integer;
begin
  if not exists(select 1 from private.federation_withdrawals where actor_id=target_actor)
    or outgoing->>'type'<>'Delete' or outgoing->>'id' !~ '^https://' then
    raise exception 'Ritiro federato non valido';
  end if;
  insert into private.federation_queue(activity_id,actor_id,target_host,target_url,payload,status)
  select outgoing->>'id',target_actor,
    lower(split_part(split_part(f.remote_inbox,'://',2),'/',1)),
    f.remote_inbox,outgoing,'paused'
  from public.federation_remote_follows f
  where f.local_actor_id=target_actor
  on conflict(activity_id,target_url) do nothing;
  get diagnostics inserted=row_count;
  delete from public.federation_remote_follows where local_actor_id=target_actor;
  delete from private.federation_withdrawals where actor_id=target_actor;
  return inserted;
end $$;

revoke all on function public.claim_federation_withdrawals(integer),public.complete_federation_withdrawal(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.claim_federation_withdrawals(integer),public.complete_federation_withdrawal(uuid,jsonb) to service_role;
