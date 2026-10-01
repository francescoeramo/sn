alter table public.profiles
  add column connections_visibility text not null default 'everyone'
  check(connections_visibility in ('everyone','nobody','preview'));
grant update(connections_visibility) on public.profiles to authenticated;
alter table public.follows add column created_at timestamptz not null default now();

create function public.profile_connections(target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare visibility text; follower_limit integer; result jsonb;
begin
  if not private.member() or private.blocked(target) then raise exception 'Accesso negato'; end if;
  select connections_visibility into visibility from public.profiles where id=target and not disabled;
  if not found then raise exception 'Profilo non disponibile'; end if;
  if target=auth.uid() then visibility := 'everyone'; end if;
  follower_limit := case when visibility='preview' then 10 when visibility='everyone' then 1000 else 0 end;
  select jsonb_build_object(
    'followers',coalesce((select jsonb_agg(to_jsonb(x) order by x.followed_at desc) from (
      select p.id,p.username,p.display_name,p.bio,p.is_private,p.connections_visibility,p.federation_enabled,p.color,p.created_at,f.created_at followed_at
      from public.follows f join public.profiles p on p.id=f.follower_id
      where f.following_id=target and f.accepted and not p.disabled
      order by f.created_at desc limit follower_limit
    ) x),'[]'::jsonb),
    'following',case when visibility='everyone' then coalesce((select jsonb_agg(to_jsonb(x) order by x.followed_at desc) from (
      select p.id,p.username,p.display_name,p.bio,p.is_private,p.connections_visibility,p.federation_enabled,p.color,p.created_at,f.created_at followed_at
      from public.follows f join public.profiles p on p.id=f.following_id
      where f.follower_id=target and f.accepted and not p.disabled
      order by f.created_at desc limit 1000
    ) x),'[]'::jsonb) else '[]'::jsonb end,
    'visibility',visibility
  ) into result;
  return result;
end $$;
revoke all on function public.profile_connections(uuid) from public,anon;
grant execute on function public.profile_connections(uuid) to authenticated;

alter table public.reactions drop constraint if exists reactions_emoji_check;
alter table public.reactions add constraint reactions_emoji_check
  check(emoji in('❤️','😂','👍','👎','😠','🎉','😮','🙏'));

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts on delete cascade,
  owner_id uuid not null references public.profiles on delete cascade default auth.uid(),
  media_path text not null unique references public.media_assets(path) on delete cascade,
  media_type text,
  alt text not null default '' check(length(alt)<=300),
  caption text not null default '' check(length(caption)<=2200),
  position smallint not null check(position between 0 and 9),
  created_at timestamptz not null default now(),
  unique(post_id,position)
);
create index post_media_post on public.post_media(post_id,position);
alter table public.post_media enable row level security;
revoke all on public.post_media from public,anon,authenticated;
grant select,insert on public.post_media to authenticated;
grant all on public.post_media to service_role;
create policy post_media_read on public.post_media for select to authenticated
  using(private.can_see_post(post_id));
create policy post_media_add on public.post_media for insert to authenticated
  with check(
    owner_id=auth.uid()
    and exists(select 1 from public.posts p where p.id=post_id and p.author_id=auth.uid())
    and exists(select 1 from public.media_assets a where a.path=media_path and a.owner_id=auth.uid() and not a.deleting)
  );

create function public.create_circle_post_with_media(
  target_circles uuid[], post_body text, warning text, media_items jsonb
) returns uuid
language plpgsql security definer set search_path='' as $$
declare new_post uuid; target uuid; first_item jsonb; invalid_items integer;
begin
  perform private.throttle('post',20);
  if target_circles is null or cardinality(target_circles) not between 1 and 5
    or cardinality(target_circles)<>(select count(distinct value) from unnest(target_circles) value)
    or post_body is null or length(trim(post_body))>2200
    or warning is null or length(warning)>160
    or jsonb_typeof(media_items)<>'array' or jsonb_array_length(media_items) not between 1 and 10 then
    raise exception 'Post non valido';
  end if;
  foreach target in array target_circles loop
    if not private.in_circle(target) or exists(
      select 1 from public.circles where id=target and archived_at is not null
    ) then raise exception 'Canale non disponibile'; end if;
  end loop;
  select count(*) into invalid_items
  from jsonb_array_elements(media_items) item
  left join public.media_assets asset on asset.path=item->>'media_path'
  where item->>'media_path' is null
    or length(item->>'media_path')>200
    or length(coalesce(item->>'alt',''))>300
    or length(coalesce(item->>'caption',''))>2200
    or asset.path is null or asset.owner_id<>auth.uid() or asset.deleting
    or asset.created_at<=now()-interval '1 hour'
    or not exists(select 1 from storage.objects where bucket_id='media' and name=asset.path)
    or exists(select 1 from public.posts p where p.media_path=asset.path)
    or exists(select 1 from public.post_media pm where pm.media_path=asset.path)
    or exists(select 1 from public.messages m where m.media_path=asset.path);
  if invalid_items>0 or (
    select count(distinct item->>'media_path') from jsonb_array_elements(media_items) item
  )<>jsonb_array_length(media_items) then raise exception 'File non disponibile'; end if;
  first_item:=media_items->0;
  insert into public.posts(author_id,body,content_warning,kind,media_path,alt)
  values(auth.uid(),trim(post_body),trim(warning),'post',first_item->>'media_path',trim(coalesce(first_item->>'alt','')))
  returning id into new_post;
  insert into public.circle_posts(circle_id,post_id,added_by)
  select value,new_post,auth.uid() from unnest(target_circles) value;
  insert into public.post_media(post_id,owner_id,media_path,media_type,alt,caption,position)
  select new_post,auth.uid(),item->>'media_path',nullif(item->>'media_type',''),
    trim(coalesce(item->>'alt','')),trim(coalesce(item->>'caption','')),(ordinality-1)::smallint
  from jsonb_array_elements(media_items) with ordinality as media(item,ordinality);
  return new_post;
end $$;
revoke all on function public.create_circle_post_with_media(uuid[],text,text,jsonb) from public,anon;
grant execute on function public.create_circle_post_with_media(uuid[],text,text,jsonb) to authenticated;

create or replace function private.can_read_asset(asset_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select private.member() and exists(select 1 from public.media_assets a where a.path=asset_path and not a.deleting and (
    (a.owner_id=auth.uid() and a.created_at>now()-interval '1 hour'
      and not exists(select 1 from public.posts p where p.media_path=a.path)
      and not exists(select 1 from public.messages m where m.media_path=a.path)
      and not exists(select 1 from public.circles c where c.image_path=a.path)
      and not exists(select 1 from public.event_photos ep where ep.media_path=a.path)
      and not exists(select 1 from public.album_items ai where ai.media_path=a.path)
      and not exists(select 1 from public.post_media pm where pm.media_path=a.path))
    or exists(select 1 from public.posts p where p.media_path=a.path and private.can_see_post(p.id))
    or exists(select 1 from public.post_media pm where pm.media_path=a.path and private.can_see_post(pm.post_id))
    or exists(select 1 from public.messages m where m.media_path=a.path and (m.sender_id=auth.uid() or m.recipient_id=auth.uid()) and (m.expires_at is null or m.expires_at>now()))
    or exists(select 1 from public.circles c where c.image_path=a.path and private.in_circle(c.id))
    or exists(select 1 from public.event_photos ep where ep.media_path=a.path and private.can_see_event(ep.event_id))
    or exists(select 1 from public.album_items ai where ai.media_path=a.path and private.can_see_post(ai.post_id))
  ))
$$;

create or replace function public.claim_media_cleanup() returns setof text
language sql security invoker set search_path='' as $$
  with candidates as (
    select a.path from public.media_assets a where (a.deleting or a.created_at<now()-interval '1 hour')
      and not exists(select 1 from public.posts p where p.media_path=a.path)
      and not exists(select 1 from public.post_media pm where pm.media_path=a.path)
      and not exists(select 1 from public.messages m where m.media_path=a.path)
      and not exists(select 1 from public.circles c where c.image_path=a.path)
      and not exists(select 1 from public.event_photos ep where ep.media_path=a.path)
      and not exists(select 1 from public.album_items ai where ai.media_path=a.path)
    order by a.deleting desc,a.created_at limit 100 for update skip locked
  ) update public.media_assets set deleting=true where path in(select path from candidates) returning path
$$;
