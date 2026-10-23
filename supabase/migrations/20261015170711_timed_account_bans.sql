-- Permanent bans keep the existing disabled flag; temporary bans use a separate expiry.
-- Existing disabled accounts remain permanently suspended. No client UPDATE grant is added.
alter table public.profiles add column banned_until timestamptz;
alter table public.moderation_audit add column ban_expires_at timestamptz;

create or replace function private.member() returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and not disabled and (banned_until is null or banned_until<=now()))
$$;

create or replace function private.can_see_author(other uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.member() and not private.blocked(other) and exists(select 1 from public.profiles p where p.id=other and not p.disabled and (p.banned_until is null or p.banned_until<=now()) and (p.id=auth.uid() or not p.is_private or exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.following_id=p.id and f.accepted)))
$$;

create or replace function private.can_message(other uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.member() and not private.blocked(other) and exists(select 1 from public.profiles where id=other and not disabled and (banned_until is null or banned_until<=now())) and exists(select 1 from public.follows where follower_id=auth.uid() and following_id=other and accepted) and exists(select 1 from public.follows where follower_id=other and following_id=auth.uid() and accepted)
$$;

create or replace function public.profile_connections(target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare visibility text; follower_limit integer; result jsonb;
begin
  if not private.member() or private.blocked(target) then raise exception 'Accesso negato'; end if;
  select connections_visibility into visibility from public.profiles where id=target and not disabled and (banned_until is null or banned_until<=now());
  if not found then raise exception 'Profilo non disponibile'; end if;
  if target=auth.uid() then visibility := 'everyone'; end if;
  follower_limit := case when visibility='preview' then 10 when visibility='everyone' then 1000 else 0 end;
  select jsonb_build_object(
    'followers',coalesce((select jsonb_agg(to_jsonb(x) order by x.followed_at desc) from (
      select p.id,p.username,p.display_name,p.bio,p.is_private,p.connections_visibility,p.federation_enabled,p.color,p.created_at,f.created_at followed_at
      from public.follows f join public.profiles p on p.id=f.follower_id
      where f.following_id=target and f.accepted and not p.disabled and (p.banned_until is null or p.banned_until<=now())
      order by f.created_at desc limit follower_limit
    ) x),'[]'::jsonb),
    'following',case when visibility='everyone' then coalesce((select jsonb_agg(to_jsonb(x) order by x.followed_at desc) from (
      select p.id,p.username,p.display_name,p.bio,p.is_private,p.connections_visibility,p.federation_enabled,p.color,p.created_at,f.created_at followed_at
      from public.follows f join public.profiles p on p.id=f.following_id
      where f.follower_id=target and f.accepted and not p.disabled and (p.banned_until is null or p.banned_until<=now())
      order by f.created_at desc limit 1000
    ) x),'[]'::jsonb) else '[]'::jsonb end,
    'visibility',visibility
  ) into result;
  return result;
end $$;

create or replace function private.extract_mentions() returns trigger language plpgsql security definer set search_path='' as $$
declare source_kind text; source uuid; pid uuid; author uuid; body text; handle text; target uuid;
begin
  if tg_table_name='posts' then
    source_kind:='post'; source:=new.id; pid:=new.id; author:=new.author_id; body:=new.body;
  else
    source_kind:='comment'; source:=new.id; pid:=new.post_id; author:=new.author_id; body:=new.body;
  end if;
  for handle in select distinct m[1] from regexp_matches(body,'@([a-zA-Z0-9_]{2,30})','g') as m loop
    select p.id into target from public.profiles p
    where lower(p.username)=lower(handle) and not p.disabled and (p.banned_until is null or p.banned_until<=now()) and p.id<>author;
    if target is not null and not private.blocked(target) and private.can_see_post(pid) then
      insert into public.mentions(author_id,mentioned_id,source_type,source_id,post_id)
      values(author,target,source_kind,source,pid)
      on conflict(author_id,mentioned_id,source_type,source_id) do nothing;
      if found and coalesce((select mentions_enabled from public.mention_preferences where user_id=target),true) then
        insert into public.notifications(user_id,actor_id,kind,post_id) values(target,author,'mention',pid);
      end if;
    end if;
  end loop;
  return new;
end $$;

create or replace function public.receive_federated_activity(
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
    where id=target_actor and federation_enabled and not is_private and not disabled and (banned_until is null or banned_until<=now())
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

create or replace function public.enqueue_federated_activity(
  target_actor uuid,
  outgoing_id text,
  outgoing jsonb
) returns integer
language plpgsql security definer set search_path=''
as $$
declare inserted integer;
begin
  if outgoing_id !~ '^https://' or outgoing->>'id'<>outgoing_id then
    raise exception 'Attività in uscita non valida';
  end if;
  if not exists(
    select 1 from public.profiles
    where id=target_actor and federation_enabled and not is_private and not disabled and (banned_until is null or banned_until<=now())
  ) then return 0; end if;
  insert into private.federation_queue(activity_id,actor_id,target_host,target_url,payload,status)
  select outgoing_id,target_actor,
    lower(split_part(split_part(f.remote_inbox,'://',2),'/',1)),
    f.remote_inbox,outgoing,'paused'
  from public.federation_remote_follows f
  where f.local_actor_id=target_actor
    and not exists(
      select 1 from private.blocked_instances b
      where b.hostname=lower(split_part(split_part(f.remote_inbox,'://',2),'/',1))
    )
  on conflict(activity_id,target_url) do nothing;
  get diagnostics inserted=row_count;
  return inserted;
end $$;

alter policy profiles_read on public.profiles using(
  private.member() and not disabled and (banned_until is null or banned_until<=now()) and not private.blocked(id)
);

create or replace function private.revoke_federation_profile() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if new.disabled or new.banned_until>now() or (new.is_private and not old.is_private) then
    new.federation_enabled:=false;
  end if;
  return new;
end $$;

-- A new RPC avoids breaking clients still using the three-argument suspension RPC.
create function public.set_account_ban(target uuid,next_disabled boolean,decision_reason text,duration text)
returns void language plpgsql security definer set search_path='' as $$
declare current_disabled boolean; current_until timestamptz; expiry timestamptz;
begin
  if auth.uid() is null or not private.member() or not private.admin() or target=auth.uid()
    or exists(select 1 from private.admins where user_id=target) then
    raise exception 'Accesso negato';
  end if;
  if decision_reason is null or length(trim(decision_reason)) not between 10 and 500 then
    raise exception 'Motiva la decisione (10-500 caratteri)';
  end if;
  if duration is null or duration not in ('3_days','1_month','6_months','1_year','permanent') then
    raise exception 'Durata del ban non valida';
  end if;
  select disabled,banned_until into current_disabled,current_until from public.profiles where id=target for update;
  if not found then raise exception 'Account non disponibile'; end if;
  if (current_disabled or coalesce(current_until>now(),false))=next_disabled then
    raise exception 'Stato account già aggiornato';
  end if;
  if next_disabled then
    expiry:=case duration
      when '3_days' then now()+interval '72 hours'
      when '1_month' then ((now() at time zone 'UTC')+interval '1 month') at time zone 'UTC'
      when '6_months' then ((now() at time zone 'UTC')+interval '6 months') at time zone 'UTC'
      when '1_year' then ((now() at time zone 'UTC')+interval '1 year') at time zone 'UTC'
      else null end;
  end if;
  update public.profiles set disabled=(next_disabled and duration='permanent'),banned_until=expiry where id=target;
  insert into public.moderation_audit(moderator_id,action,target_type,target_id,reason,ban_expires_at)
    values(auth.uid(),case when next_disabled then 'account_suspended' else 'account_restored' end,'account',target,trim(decision_reason),expiry);
end $$;
revoke all on function public.set_account_ban(uuid,boolean,text,text) from public,anon;
grant execute on function public.set_account_ban(uuid,boolean,text,text) to authenticated;

create or replace function public.set_account_disabled(target uuid,next_disabled boolean,decision_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.set_account_ban(target,next_disabled,decision_reason,'permanent');
end $$;

-- Only add fields to the RPC result; retain its existing columns and effective disabled state.
drop function public.moderation_accounts();
create function public.moderation_accounts()
returns table(id uuid,username text,display_name text,disabled boolean,is_admin boolean,created_at timestamptz,ban_expires_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.member() or not private.admin() then
    raise exception 'Accesso negato';
  end if;
  return query
    select p.id,p.username,p.display_name,p.disabled or coalesce(p.banned_until>now(),false),
      exists(select 1 from private.admins a where a.user_id=p.id),p.created_at,
      case when p.disabled then null when p.banned_until>now() then p.banned_until else null end
    from public.profiles p order by p.created_at,p.id;
end $$;
revoke all on function public.moderation_accounts() from public,anon;
grant execute on function public.moderation_accounts() to authenticated;

-- Rollback: deploy previous readers first; convert still-active temporary bans to disabled=true
-- before restoring prior function/policy definitions. Keep expiry columns and audit data.
