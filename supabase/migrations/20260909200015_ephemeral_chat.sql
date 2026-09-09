-- Extend existing installations without rewriting the initial migration.
alter table public.messages add column media_path text unique references public.media_assets(path), add column media_type text, add column expires_at timestamptz;
alter table public.messages alter column body set default '';
alter table public.messages drop constraint messages_body_check;
alter table public.messages add constraint messages_body_check check(length(body)<=2000), add constraint messages_content_check check(length(trim(body))>0 or media_path is not null);
create index messages_expiry on public.messages(expires_at) where expires_at is not null;
grant insert(media_path) on public.messages to authenticated;
drop trigger sn_message_limit on public.messages;
-- New messages expire according to a database-controlled lifetime. Existing history is preserved.
alter table public.messages add column ttl_seconds integer not null default 86400
  check(ttl_seconds in (3600,10800,86400,172800,604800,2592000));
grant insert(ttl_seconds) on public.messages to authenticated;
create or replace function private.message_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare asset public.media_assets;
begin
  perform private.throttle('messages',120);
  if new.sender_id<>auth.uid() or not private.can_message(new.recipient_id) then raise exception 'Accesso negato'; end if;
  new.created_at:=now();
  new.expires_at:=now()+make_interval(secs=>new.ttl_seconds);
  if new.media_path is not null then
    select * into asset from public.media_assets where path=new.media_path and owner_id=auth.uid() and not deleting and created_at>now()-interval '1 hour' for update;
    if not found or exists(select 1 from public.posts where media_path=new.media_path) or not exists(select 1 from storage.objects where bucket_id='media' and name=new.media_path) then raise exception 'File non disponibile'; end if;
    new.media_type:=asset.mime;
  else new.media_type:=null; end if;
  return new;
end $$;
alter table public.media_assets drop constraint media_assets_mime_check;
alter table public.media_assets add constraint media_assets_mime_check check(mime in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/webm','audio/ogg','audio/mp4'));
alter table public.posts add constraint posts_media_type_check check(media_type is null or media_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm'));
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/webm','audio/ogg','audio/mp4'] where id='media';
-- A blob cannot also be attached to a public post and keep an expired DM readable there.
create function private.exclusive_post_media() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.media_path is not null then
    perform 1 from public.media_assets where path=new.media_path for update;
    if exists(select 1 from public.messages where media_path=new.media_path) then raise exception 'File già usato in chat'; end if;
  end if;
  return new;
end $$;
revoke all on function private.exclusive_post_media() from public,anon,authenticated;
create trigger sn_post_exclusive_media before insert on public.posts for each row execute function private.exclusive_post_media();

create trigger sn_message_guard before insert on public.messages for each row execute function private.message_guard();
revoke all on function private.message_guard() from public,anon,authenticated;
drop policy media_read on public.media_assets;
create policy media_read on public.media_assets for select to authenticated using(private.member() and (owner_id=(select auth.uid()) or exists(select 1 from public.posts where media_path=path and private.can_see_post(id)) or exists(select 1 from public.messages where media_path=path and (sender_id=(select auth.uid()) or recipient_id=(select auth.uid())) and (expires_at is null or expires_at>now()))));
drop policy messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using(private.member() and (sender_id=(select auth.uid()) or recipient_id=(select auth.uid())) and (expires_at is null or expires_at>now()));
create or replace function private.can_read_asset(asset_path text) returns boolean language sql stable security definer set search_path='' as $$
  select private.member() and exists(select 1 from public.media_assets a where a.path=asset_path and not a.deleting and (
    (a.owner_id=auth.uid() and a.created_at>now()-interval '1 hour' and not exists(select 1 from public.posts p where p.media_path=a.path) and not exists(select 1 from public.messages m where m.media_path=a.path))
    or exists(select 1 from public.posts p where p.media_path=a.path and private.can_see_post(p.id))
    or exists(select 1 from public.messages m where m.media_path=a.path and (m.sender_id=auth.uid() or m.recipient_id=auth.uid()) and (m.expires_at is null or m.expires_at>now()))
  ))
$$;
create or replace function public.claim_media_cleanup() returns setof text language sql security invoker set search_path='' as $$
  with candidates as (
    select a.path from public.media_assets a where a.created_at<now()-interval '1 hour'
    and not exists(select 1 from public.posts p where p.media_path=a.path)
    and not exists(select 1 from public.messages m where m.media_path=a.path)
    order by a.created_at limit 100 for update skip locked
  ) update public.media_assets set deleting=true where path in(select path from candidates) returning path
$$;
