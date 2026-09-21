alter table public.federation_inbox drop constraint federation_inbox_activity_type_check;
alter table public.federation_inbox
  add constraint federation_inbox_activity_type_check
  check(activity_type in ('Follow','Undo','Like','Reject','Create','Update','Delete'));

create index federation_inbox_remote_rate_idx
  on public.federation_inbox(local_actor_id,remote_actor,received_at desc);

create table public.federation_remote_objects (
  object_id text not null check(object_id ~ '^https://'),
  local_actor_id uuid not null references public.profiles(id) on delete cascade,
  remote_actor text not null check(remote_actor ~ '^https://'),
  create_activity_id text unique not null
    references public.federation_inbox(activity_id) on delete cascade,
  object_type text not null check(object_type in ('Note')),
  content text not null check(length(content) <= 20000),
  summary text check(summary is null or length(summary) <= 500),
  sensitive boolean not null default false,
  published_at timestamptz,
  in_reply_to text check(in_reply_to is null or in_reply_to ~ '^https://'),
  received_at timestamptz not null default now(),
  updated_at timestamptz,
  update_activity_id text unique
    references public.federation_inbox(activity_id) on delete set null,
  deleted_at timestamptz,
  delete_activity_id text unique
    references public.federation_inbox(activity_id) on delete set null,
  primary key(local_actor_id,object_id)
);

create index federation_remote_objects_local_received_idx
  on public.federation_remote_objects(local_actor_id,received_at desc)
  where deleted_at is null;

alter table public.federation_remote_objects enable row level security;
revoke all on public.federation_remote_objects from public,anon,authenticated;
grant all on public.federation_remote_objects to service_role;

create table public.federation_remote_actor_keys (
  key_id text primary key check(key_id ~ '^https://'),
  remote_actor text not null check(remote_actor ~ '^https://'),
  remote_inbox text not null check(remote_inbox ~ '^https://'),
  username text check(username is null or length(username) <= 64),
  display_name text check(display_name is null or length(display_name) <= 120),
  public_key_pem text not null check(
    length(public_key_pem) <= 8192
    and public_key_pem like '-----BEGIN PUBLIC KEY-----%'
  ),
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 hours'),
  check(expires_at > fetched_at)
);

create index federation_remote_actor_keys_expiry_idx
  on public.federation_remote_actor_keys(expires_at);

alter table public.federation_remote_actor_keys enable row level security;
revoke all on public.federation_remote_actor_keys from public,anon,authenticated;
grant all on public.federation_remote_actor_keys to service_role;

drop function public.receive_federated_activity(uuid,jsonb,text,jsonb,uuid);
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
  object_value jsonb := activity->'object';
  remote_object_id text := case jsonb_typeof(activity->'object')
    when 'string' then activity->>'object'
    when 'object' then activity->'object'->>'id'
    else null end;
begin
  if not exists(
    select 1 from public.profiles
    where id=target_actor and federation_enabled and not is_private and not disabled
  ) then raise exception 'Attore locale non disponibile'; end if;
  if incoming_id !~ '^https://' or remote_actor_url !~ '^https://'
    or activity_type not in ('Follow','Undo','Like','Reject','Create','Update','Delete')
  then raise exception 'Attività federata non valida'; end if;

  insert into public.federation_inbox(activity_id,local_actor_id,remote_actor,activity_type)
  values(incoming_id,target_actor,remote_actor_url,activity_type)
  on conflict do nothing;
  if not found then return 'duplicate'; end if;
  if (
    select count(*) > 120
    from public.federation_inbox
    where local_actor_id=target_actor
      and remote_actor=remote_actor_url
      and received_at > now() - interval '1 hour'
  ) then raise exception 'Limite attività federate superato'; end if;

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
    if remote_object_id is null or remote_inbox_url !~ '^https://' or not exists(
      select 1 from private.federation_queue q
      where q.activity_id=remote_object_id and q.actor_id=target_actor and q.target_url=remote_inbox_url
    ) or not exists(
      select 1 from public.federation_remote_follows f
      where f.local_actor_id=target_actor and f.remote_actor=remote_actor_url
        and f.remote_inbox=remote_inbox_url
    ) then raise exception 'Reject non valido'; end if;
    insert into public.federation_rejections(activity_id,outgoing_activity_id,remote_actor)
    values(incoming_id,remote_object_id,remote_actor_url);
    return 'rejected';
  end if;

  if activity_type='Create' then
    if jsonb_typeof(object_value) <> 'object'
      or object_value->>'type' <> 'Note'
      or remote_object_id is null
      or object_value->>'attributedTo' <> remote_actor_url
    then raise exception 'Oggetto remoto non valido'; end if;
    insert into public.federation_remote_objects(
      object_id,local_actor_id,remote_actor,create_activity_id,object_type,content,summary,
      sensitive,published_at,in_reply_to
    ) values(
      remote_object_id,target_actor,remote_actor_url,incoming_id,object_value->>'type',
      coalesce(object_value->>'content',''),nullif(object_value->>'summary',''),
      coalesce((object_value->>'sensitive')::boolean,false),
      nullif(object_value->>'published','')::timestamptz,
      nullif(object_value->>'inReplyTo','')
    )
    on conflict(local_actor_id,object_id) do nothing;
    if not found then raise exception 'Oggetto remoto già attribuito'; end if;
    return 'created';
  end if;

  if activity_type='Update' then
    if jsonb_typeof(object_value) <> 'object'
      or object_value->>'type' <> 'Note'
      or remote_object_id is null
      or object_value->>'attributedTo' <> remote_actor_url
    then raise exception 'Oggetto remoto non valido'; end if;
    update public.federation_remote_objects
      set content=coalesce(object_value->>'content',''),
          summary=nullif(object_value->>'summary',''),
          sensitive=coalesce((object_value->>'sensitive')::boolean,false),
          published_at=nullif(object_value->>'published','')::timestamptz,
          in_reply_to=nullif(object_value->>'inReplyTo',''),
          updated_at=now(),
          update_activity_id=incoming_id
      where federation_remote_objects.object_id=remote_object_id
        and local_actor_id=target_actor
        and remote_actor=remote_actor_url
        and deleted_at is null;
    if not found then raise exception 'Oggetto remoto non trovato'; end if;
    return 'updated';
  end if;

  if activity_type='Delete' then
    update public.federation_remote_objects
      set content='',summary=null,deleted_at=now(),delete_activity_id=incoming_id
      where federation_remote_objects.object_id=remote_object_id
        and local_actor_id=target_actor
        and remote_actor=remote_actor_url
        and deleted_at is null;
    if not found then raise exception 'Oggetto remoto non trovato'; end if;
    return 'deleted';
  end if;

  if remote_object_id is null then raise exception 'Undo non valido'; end if;
  delete from public.federation_remote_follows
  where local_actor_id=target_actor and remote_actor=remote_actor_url
    and follow_activity_id=remote_object_id;
  if found then return 'undone'; end if;
  delete from public.federation_remote_likes
  where local_post_id=target_post and remote_actor=remote_actor_url
    and activity_id=remote_object_id;
  return 'undone';
end $$;

revoke all on function public.receive_federated_activity(uuid,jsonb,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.receive_federated_activity(uuid,jsonb,text,jsonb,uuid) to service_role;
