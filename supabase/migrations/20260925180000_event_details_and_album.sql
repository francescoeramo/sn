-- Completa gli eventi locali: modifica dei dettagli da parte dell'organizzatore
-- e album collaborativo disponibile solo dopo l'inizio dell'evento.
-- Migrazione additiva: non modifica migrazioni già applicate.

create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  media_path text not null unique references public.media_assets(path) on delete cascade,
  caption text not null default '' check(length(caption)<=240),
  created_at timestamptz not null default now()
);

create index event_photos_event_created on public.event_photos(event_id,created_at,id);

alter table public.event_photos enable row level security;
revoke all on public.event_photos from public,anon,authenticated;
grant select on public.event_photos to authenticated;
grant all on public.event_photos to service_role;

create policy event_photos_read on public.event_photos for select to authenticated
using(private.can_see_event(event_id) and not private.blocked(author_id));

-- Un asset può essere usato una sola volta, come per post, messaggi e immagini delle cerchie.
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
  )
$$;

create function private.event_photo_available(asset_path text) returns boolean
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
  )
$$;

create or replace function private.can_read_asset(asset_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select private.member() and exists(select 1 from public.media_assets a where a.path=asset_path and not a.deleting and (
    (a.owner_id=auth.uid() and a.created_at>now()-interval '1 hour'
      and not exists(select 1 from public.posts p where p.media_path=a.path)
      and not exists(select 1 from public.messages m where m.media_path=a.path)
      and not exists(select 1 from public.circles c where c.image_path=a.path)
      and not exists(select 1 from public.event_photos ep where ep.media_path=a.path))
    or exists(select 1 from public.posts p where p.media_path=a.path and private.can_see_post(p.id))
    or exists(select 1 from public.messages m where m.media_path=a.path
      and (m.sender_id=auth.uid() or m.recipient_id=auth.uid())
      and (m.expires_at is null or m.expires_at>now()))
    or exists(select 1 from public.circles c where c.image_path=a.path and private.in_circle(c.id))
    or exists(select 1 from public.event_photos ep where ep.media_path=a.path and private.can_see_event(ep.event_id))
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
    order by a.deleting desc,a.created_at limit 100 for update skip locked
  ) update public.media_assets set deleting=true
  where path in(select path from candidates) returning path
$$;

-- Modifica dei dettagli: solo l'organizzatore, con una sola notifica per le
-- variazioni sostanziali di data, fine o luogo. La capienza non può scendere
-- sotto il numero di partecipanti già confermati.
create function public.update_event(
  target_event uuid,
  event_title text,
  event_description text,
  event_location text,
  event_starts_at timestamptz,
  event_ends_at timestamptz default null,
  event_circle uuid default null,
  event_capacity integer default null
) returns void
language plpgsql security definer set search_path='' as $$
declare current public.events; going_count integer;
begin
  perform private.throttle('event_manage',20);
  select * into current from public.events where id=target_event for update;
  if not found or current.organizer_id<>auth.uid() then raise exception 'Accesso negato'; end if;
  if current.cancelled_at is not null then raise exception 'Evento non disponibile'; end if;
  if event_title is null or length(trim(event_title)) not between 1 and 100
    or event_description is null or length(event_description)>1200
    or event_location is null or length(event_location)>160
    or (event_starts_at is distinct from current.starts_at and event_starts_at<now()-interval '5 minutes')
    or (event_ends_at is not null and event_ends_at<=event_starts_at)
    or (event_capacity is not null and event_capacity not between 2 and 100)
    or (event_circle is not null and not private.in_circle(event_circle)) then
    raise exception 'Dati dell''evento non validi';
  end if;
  if event_capacity is not null then
    select count(*) into going_count from public.event_responses
    where event_id=target_event and response='going';
    if going_count>event_capacity then raise exception 'Capienza inferiore ai partecipanti confermati'; end if;
  end if;
  update public.events set
    title=trim(event_title),
    description=trim(event_description),
    location=trim(event_location),
    starts_at=event_starts_at,
    ends_at=event_ends_at,
    circle_id=event_circle,
    capacity=event_capacity,
    updated_at=now()
  where id=target_event;
  if event_starts_at is distinct from current.starts_at
    or event_ends_at is distinct from current.ends_at
    or trim(event_location) is distinct from current.location then
    insert into public.notifications(user_id,actor_id,kind,event_id)
    select r.user_id,auth.uid(),'event_update',target_event
    from public.event_responses r
    where r.event_id=target_event and r.user_id<>auth.uid() and r.response in('going','maybe');
  end if;
end $$;

-- Album collaborativo: disponibile solo dall'inizio dell'evento, per
-- l'organizzatore e per chi ha confermato la partecipazione.
create function public.add_event_photo(
  target_event uuid,
  photo_path text,
  photo_caption text default ''
) returns uuid
language plpgsql security definer set search_path='' as $$
declare target public.events; new_photo uuid;
begin
  perform private.throttle('event_album',30);
  select * into target from public.events where id=target_event;
  if not found or not private.can_see_event(target_event) or target.cancelled_at is not null
    or target.starts_at>now()
    or (target.organizer_id<>auth.uid() and not exists(
      select 1 from public.event_responses r
      where r.event_id=target_event and r.user_id=auth.uid() and r.response='going'))
    or length(coalesce(photo_caption,''))>240
    or not private.event_photo_available(photo_path) then
    raise exception 'Album non disponibile';
  end if;
  insert into public.event_photos(event_id,author_id,media_path,caption)
  values(target_event,auth.uid(),photo_path,trim(coalesce(photo_caption,''))) returning id into new_photo;
  return new_photo;
end $$;

create function public.remove_event_photo(target_photo uuid) returns void
language plpgsql security definer set search_path='' as $$
declare photo_author uuid; event_organizer uuid;
begin
  perform private.throttle('event_album',30);
  select p.author_id,e.organizer_id into photo_author,event_organizer
  from public.event_photos p join public.events e on e.id=p.event_id
  where p.id=target_photo for update of p;
  if not found or (photo_author<>auth.uid() and event_organizer<>auth.uid()) then
    raise exception 'Accesso negato';
  end if;
  delete from public.event_photos where id=target_photo;
end $$;

revoke all on function private.event_photo_available(text) from public,anon,authenticated;
revoke all on function public.update_event(uuid,text,text,text,timestamptz,timestamptz,uuid,integer) from public,anon;
grant execute on function public.update_event(uuid,text,text,text,timestamptz,timestamptz,uuid,integer) to authenticated;
revoke all on function public.add_event_photo(uuid,text,text),public.remove_event_photo(uuid) from public,anon;
grant execute on function public.add_event_photo(uuid,text,text),public.remove_event_photo(uuid) to authenticated;
