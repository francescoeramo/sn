-- Post collaborativi e album condivisi.
-- Collaboratori scelti tra contatti reciproci con invito accettato; permessi
-- revocabili dall'autore; album con una sola visibilita' (quella del post).
-- I media restano quelli esistenti: nessun nuovo servizio esterno.

create table public.collaborative_posts (
  post_id uuid primary key references public.posts on delete cascade,
  owner_id uuid not null references public.profiles on delete cascade,
  album_closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.collaborators (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  invited_by uuid references public.profiles on delete set null,
  status text not null default 'invited' check(status in('invited','active')),
  can_media boolean not null default true,
  can_caption boolean not null default true,
  can_update boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);

create table public.album_items (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.collaborative_posts(post_id) on delete cascade,
  media_path text not null unique references public.media_assets(path) on delete cascade,
  caption text not null default '' check(length(caption)<=240),
  added_by uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

create index collaborators_user on public.collaborators(user_id,status);
create index album_items_post_created on public.album_items(post_id,created_at,id);

alter table public.collaborative_posts enable row level security;
alter table public.collaborators enable row level security;
alter table public.album_items enable row level security;
revoke all on public.collaborative_posts,public.collaborators,public.album_items from public,anon,authenticated;
grant select on public.collaborative_posts,public.collaborators,public.album_items to authenticated;
grant all on public.collaborative_posts,public.collaborators,public.album_items to service_role;

create policy collaborative_posts_read on public.collaborative_posts for select to authenticated
using(private.can_see_post(post_id));
create policy collaborators_read on public.collaborators for select to authenticated
using(private.can_see_post(post_id) or user_id=(select auth.uid()));
create policy album_items_read on public.album_items for select to authenticated
using(private.can_see_post(post_id) and not private.blocked(added_by));

-- Un media usato nell'album non deve essere riusato o ripulito mentre e' in uso.
create function private.album_item_available(asset_path text) returns boolean
language sql volatile security definer set search_path='' as $$
  select asset_path is not null and exists(
    select 1 from public.media_assets a
    where a.path=asset_path
      and a.owner_id=(select auth.uid())
      and a.mime in('image/jpeg','image/png','image/webp')
      and not a.deleting
      and a.created_at>now()-interval '1 hour'
      and exists(select 1 from storage.objects o where o.bucket_id='media' and o.name=a.path)
      and not exists(select 1 from public.posts p where p.media_path=a.path)
      and not exists(select 1 from public.messages m where m.media_path=a.path)
      and not exists(select 1 from public.circles c where c.image_path=a.path)
      and not exists(select 1 from public.event_photos ep where ep.media_path=a.path)
      and not exists(select 1 from public.album_items ai where ai.media_path=a.path)
  )
$$;

-- Le funzioni di disponibilita'/pulizia includono ora anche l'album.
create or replace function private.circle_image_available(asset_path text) returns boolean
language sql volatile security definer set search_path='' as $$
  select asset_path is null or exists(
    select 1 from public.media_assets a
    where a.path=asset_path
      and a.owner_id=(select auth.uid())
      and a.mime in('image/jpeg','image/png','image/webp')
      and not a.deleting
      and a.created_at>now()-interval '1 hour'
      and exists(select 1 from storage.objects o where o.bucket_id='media' and o.name=a.path)
      and not exists(select 1 from public.posts p where p.media_path=a.path)
      and not exists(select 1 from public.messages m where m.media_path=a.path)
      and not exists(select 1 from public.circles c where c.image_path=a.path)
      and not exists(select 1 from public.event_photos ep where ep.media_path=a.path)
      and not exists(select 1 from public.album_items ai where ai.media_path=a.path)
  )
$$;

create or replace function private.event_photo_available(asset_path text) returns boolean
language sql volatile security definer set search_path='' as $$
  select asset_path is not null and exists(
    select 1 from public.media_assets a
    where a.path=asset_path
      and a.owner_id=(select auth.uid())
      and a.mime in('image/jpeg','image/png','image/webp')
      and not a.deleting
      and a.created_at>now()-interval '1 hour'
      and exists(select 1 from storage.objects o where o.bucket_id='media' and o.name=a.path)
      and not exists(select 1 from public.posts p where p.media_path=a.path)
      and not exists(select 1 from public.messages m where m.media_path=a.path)
      and not exists(select 1 from public.circles c where c.image_path=a.path)
      and not exists(select 1 from public.event_photos ep where ep.media_path=a.path)
      and not exists(select 1 from public.album_items ai where ai.media_path=a.path)
  )
$$;

create or replace function private.can_read_asset(asset_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select private.member() and exists(select 1 from public.media_assets a where a.path=asset_path and not a.deleting and (
    (a.owner_id=auth.uid() and a.created_at>now()-interval '1 hour'
      and not exists(select 1 from public.posts p where p.media_path=a.path)
      and not exists(select 1 from public.messages m where m.media_path=a.path)
      and not exists(select 1 from public.circles c where c.image_path=a.path)
      and not exists(select 1 from public.event_photos ep where ep.media_path=a.path)
      and not exists(select 1 from public.album_items ai where ai.media_path=a.path))
    or exists(select 1 from public.posts p where p.media_path=a.path and private.can_see_post(p.id))
    or exists(select 1 from public.messages m where m.media_path=a.path
      and (m.sender_id=auth.uid() or m.recipient_id=auth.uid())
      and (m.expires_at is null or m.expires_at>now()))
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
      and not exists(select 1 from public.messages m where m.media_path=a.path)
      and not exists(select 1 from public.circles c where c.image_path=a.path)
      and not exists(select 1 from public.event_photos ep where ep.media_path=a.path)
      and not exists(select 1 from public.album_items ai where ai.media_path=a.path)
    order by a.deleting desc,a.created_at limit 100 for update skip locked
  ) update public.media_assets set deleting=true
  where path in(select path from candidates) returning path
$$;

-- L'autore apre le collaborazioni sul proprio post.
create function public.open_collaboration(target_post uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target public.posts;
begin
  perform private.throttle('collaboration_manage',40);
  select * into target from public.posts where id=target_post;
  if not found or target.author_id<>auth.uid() then raise exception 'Accesso negato'; end if;
  if target.kind<>'post' or (target.expires_at is not null and target.expires_at<=now()) then
    raise exception 'Post non disponibile';
  end if;
  insert into public.collaborative_posts(post_id,owner_id) values(target_post,auth.uid())
  on conflict(post_id) do nothing;
end $$;

create function public.invite_collaborator(target_post uuid, other uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.throttle('collaboration_manage',40);
  if not exists(select 1 from public.collaborative_posts c where c.post_id=target_post and c.owner_id=auth.uid())
    or other=auth.uid() or not private.can_message(other) then
    raise exception 'Invito non disponibile';
  end if;
  insert into public.collaborators(post_id,user_id,invited_by,status)
  values(target_post,other,auth.uid(),'invited')
  on conflict(post_id,user_id) do nothing;
end $$;

create function public.respond_collaboration(target_post uuid, accept_invite boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.throttle('collaboration_manage',40);
  if accept_invite then
    update public.collaborators set status='active'
    where post_id=target_post and user_id=auth.uid() and status='invited';
    if not found then raise exception 'Invito non disponibile'; end if;
  else
    delete from public.collaborators where post_id=target_post and user_id=auth.uid();
  end if;
end $$;

create function public.remove_collaborator(target_post uuid, other uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.throttle('collaboration_manage',40);
  if other<>auth.uid()
    and not exists(select 1 from public.collaborative_posts c where c.post_id=target_post and c.owner_id=auth.uid()) then
    raise exception 'Accesso negato';
  end if;
  delete from public.collaborators where post_id=target_post and user_id=other;
end $$;

create function public.set_collaborator_permission(
  target_post uuid,
  other uuid,
  allow_media boolean,
  allow_caption boolean,
  allow_update boolean
) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.throttle('collaboration_manage',40);
  update public.collaborators set
    can_media=allow_media, can_caption=allow_caption, can_update=allow_update
  where post_id=target_post and user_id=other
    and exists(select 1 from public.collaborative_posts c where c.post_id=target_post and c.owner_id=auth.uid());
  if not found then raise exception 'Accesso negato'; end if;
end $$;

create function public.close_album(target_post uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.throttle('collaboration_manage',40);
  update public.collaborative_posts set album_closed_at=now()
  where post_id=target_post and owner_id=auth.uid() and album_closed_at is null;
  if not found then raise exception 'Accesso negato'; end if;
end $$;

create function public.add_album_item(
  target_post uuid,
  item_path text,
  item_caption text default ''
) returns uuid
language plpgsql security definer set search_path='' as $$
declare album public.collaborative_posts; allowed boolean; new_item uuid;
begin
  perform private.throttle('album_manage',30);
  select * into album from public.collaborative_posts where post_id=target_post for update;
  if not found or album.album_closed_at is not null or not private.can_see_post(target_post)
    or length(coalesce(item_caption,''))>240 or not private.album_item_available(item_path) then
    raise exception 'Album non disponibile';
  end if;
  allowed := album.owner_id=auth.uid() or exists(
    select 1 from public.collaborators c
    where c.post_id=target_post and c.user_id=auth.uid() and c.status='active' and c.can_media);
  if not allowed then raise exception 'Accesso negato'; end if;
  insert into public.album_items(post_id,media_path,caption,added_by)
  values(target_post,item_path,trim(coalesce(item_caption,'')),auth.uid()) returning id into new_item;
  return new_item;
end $$;

create function public.remove_album_item(target_item uuid) returns void
language plpgsql security definer set search_path='' as $$
declare item public.album_items; owner uuid;
begin
  perform private.throttle('album_manage',30);
  select * into item from public.album_items where id=target_item for update;
  if not found then raise exception 'Accesso negato'; end if;
  select owner_id into owner from public.collaborative_posts where post_id=item.post_id;
  if item.added_by<>auth.uid() and owner<>auth.uid() then raise exception 'Accesso negato'; end if;
  delete from public.album_items where id=target_item;
end $$;

revoke all on function private.album_item_available(text) from public,anon,authenticated;
revoke all on function public.open_collaboration(uuid),public.invite_collaborator(uuid,uuid),
  public.respond_collaboration(uuid,boolean),public.remove_collaborator(uuid,uuid),
  public.set_collaborator_permission(uuid,uuid,boolean,boolean,boolean),public.close_album(uuid),
  public.add_album_item(uuid,text,text),public.remove_album_item(uuid) from public,anon;
grant execute on function public.open_collaboration(uuid),public.invite_collaborator(uuid,uuid),
  public.respond_collaboration(uuid,boolean),public.remove_collaborator(uuid,uuid),
  public.set_collaborator_permission(uuid,uuid,boolean,boolean,boolean),public.close_album(uuid),
  public.add_album_item(uuid,text,text),public.remove_album_item(uuid) to authenticated;
