alter table private.federation_queue add column target_url text;
alter table private.federation_queue
  add constraint federation_queue_target_url_https
  check(target_url is null or target_url ~ '^https://');

create table public.federation_inbox (
  activity_id text primary key check(activity_id ~ '^https://'),
  local_actor_id uuid not null references public.profiles(id) on delete cascade,
  remote_actor text not null check(remote_actor ~ '^https://'),
  activity_type text not null check(activity_type in ('Follow','Undo')),
  received_at timestamptz not null default now()
);

create table public.federation_remote_follows (
  local_actor_id uuid not null references public.profiles(id) on delete cascade,
  remote_actor text not null check(remote_actor ~ '^https://'),
  follow_activity_id text unique not null references public.federation_inbox(activity_id) on delete cascade,
  remote_inbox text not null check(remote_inbox ~ '^https://'),
  accepted_at timestamptz not null default now(),
  primary key(local_actor_id,remote_actor)
);

alter table public.federation_inbox enable row level security;
alter table public.federation_remote_follows enable row level security;
revoke all on public.federation_inbox,public.federation_remote_follows from public,anon,authenticated;
grant all on public.federation_inbox,public.federation_remote_follows to service_role;

create function public.receive_federated_activity(
  target_actor uuid,
  activity jsonb,
  remote_inbox_url text,
  reply jsonb default null
) returns text
language plpgsql security definer set search_path=''
as $$
declare
  incoming_id text := activity->>'id';
  remote_actor_url text := activity->>'actor';
  activity_type text := activity->>'type';
  undone_id text;
begin
  if not exists(
    select 1 from public.profiles
    where id=target_actor and federation_enabled and not is_private and not disabled
  ) then raise exception 'Attore locale non disponibile'; end if;
  if incoming_id !~ '^https://' or remote_actor_url !~ '^https://' or activity_type not in ('Follow','Undo')
  then raise exception 'Attività federata non valida'; end if;

  insert into public.federation_inbox(activity_id,local_actor_id,remote_actor,activity_type)
  values(incoming_id,target_actor,remote_actor_url,activity_type)
  on conflict do nothing;
  if not found then return 'duplicate'; end if;

  if activity_type='Follow' then
    if remote_inbox_url !~ '^https://' or reply is null then
      raise exception 'Attore remoto non valido';
    end if;
    insert into public.federation_remote_follows(local_actor_id,remote_actor,follow_activity_id,remote_inbox)
    values(target_actor,remote_actor_url,incoming_id,remote_inbox_url)
    on conflict(local_actor_id,remote_actor) do update
      set follow_activity_id=excluded.follow_activity_id,
          remote_inbox=excluded.remote_inbox,
          accepted_at=now();
    insert into private.federation_queue(activity_id,actor_id,target_host,target_url,payload,status)
    values(reply->>'id',target_actor,lower(split_part(split_part(remote_inbox_url,'://',2),'/',1)),remote_inbox_url,reply,'paused')
    on conflict do nothing;
    return 'followed';
  end if;

  undone_id := case jsonb_typeof(activity->'object')
    when 'string' then activity->>'object'
    when 'object' then activity->'object'->>'id'
    else null end;
  if undone_id is null then raise exception 'Undo non valido'; end if;
  delete from public.federation_remote_follows
  where local_actor_id=target_actor and remote_actor=remote_actor_url
    and follow_activity_id=undone_id;
  return 'undone';
end $$;

revoke all on function public.receive_federated_activity(uuid,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.receive_federated_activity(uuid,jsonb,text,jsonb) to service_role;
