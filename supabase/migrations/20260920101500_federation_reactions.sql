alter table public.federation_inbox drop constraint federation_inbox_activity_type_check;
alter table public.federation_inbox
  add constraint federation_inbox_activity_type_check
  check(activity_type in ('Follow','Undo','Like','Reject'));

create table public.federation_remote_likes (
  activity_id text primary key references public.federation_inbox(activity_id) on delete cascade,
  local_post_id uuid not null references public.posts(id) on delete cascade,
  remote_actor text not null check(remote_actor ~ '^https://'),
  received_at timestamptz not null default now(),
  unique(local_post_id,remote_actor)
);

create table public.federation_rejections (
  activity_id text primary key references public.federation_inbox(activity_id) on delete cascade,
  outgoing_activity_id text not null check(outgoing_activity_id ~ '^https://'),
  remote_actor text not null check(remote_actor ~ '^https://'),
  received_at timestamptz not null default now()
);

alter table public.federation_remote_likes enable row level security;
alter table public.federation_rejections enable row level security;
revoke all on public.federation_remote_likes,public.federation_rejections from public,anon,authenticated;
grant all on public.federation_remote_likes,public.federation_rejections to service_role;

drop function public.receive_federated_activity(uuid,jsonb,text,jsonb);
create function public.receive_federated_activity(
  target_actor uuid,
  activity jsonb,
  remote_inbox_url text,
  reply jsonb default null,
  target_post uuid default null
) returns text
language plpgsql security definer set search_path=''
as $$
declare
  incoming_id text := activity->>'id';
  remote_actor_url text := activity->>'actor';
  activity_type text := activity->>'type';
  object_id text := case jsonb_typeof(activity->'object')
    when 'string' then activity->>'object'
    when 'object' then activity->'object'->>'id'
    else null end;
begin
  if not exists(
    select 1 from public.profiles
    where id=target_actor and federation_enabled and not is_private and not disabled
  ) then raise exception 'Attore locale non disponibile'; end if;
  if incoming_id !~ '^https://' or remote_actor_url !~ '^https://'
    or activity_type not in ('Follow','Undo','Like','Reject')
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

  if activity_type='Like' then
    if target_post is null or not exists(
      select 1 from public.posts p where p.id=target_post and p.author_id=target_actor
    ) then raise exception 'Oggetto Like non valido'; end if;
    insert into public.federation_remote_likes(activity_id,local_post_id,remote_actor)
    values(incoming_id,target_post,remote_actor_url)
    on conflict(local_post_id,remote_actor) do update set activity_id=excluded.activity_id,received_at=now();
    return 'liked';
  end if;

  if activity_type='Reject' then
    if object_id is null or remote_inbox_url !~ '^https://' or not exists(
      select 1 from private.federation_queue q
      where q.activity_id=object_id and q.actor_id=target_actor and q.target_url=remote_inbox_url
    ) or not exists(
      select 1 from public.federation_remote_follows f
      where f.local_actor_id=target_actor and f.remote_actor=remote_actor_url
        and f.remote_inbox=remote_inbox_url
    ) then raise exception 'Reject non valido'; end if;
    insert into public.federation_rejections(activity_id,outgoing_activity_id,remote_actor)
    values(incoming_id,object_id,remote_actor_url);
    return 'rejected';
  end if;

  if object_id is null then raise exception 'Undo non valido'; end if;
  delete from public.federation_remote_follows
  where local_actor_id=target_actor and remote_actor=remote_actor_url
    and follow_activity_id=object_id;
  if found then return 'undone'; end if;
  delete from public.federation_remote_likes
  where local_post_id=target_post and remote_actor=remote_actor_url
    and activity_id=object_id;
  return 'undone';
end $$;

revoke all on function public.receive_federated_activity(uuid,jsonb,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.receive_federated_activity(uuid,jsonb,text,jsonb,uuid) to service_role;

create function public.federation_instance_blocked(candidate text)
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from private.blocked_instances
    where hostname=lower(trim(trailing '.' from candidate))
  )
$$;

revoke all on function public.federation_instance_blocked(text) from public,anon,authenticated;
grant execute on function public.federation_instance_blocked(text) to service_role;
