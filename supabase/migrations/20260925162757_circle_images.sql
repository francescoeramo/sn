create function private.circle_image_available(asset_path text) returns boolean
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
  )
$$;

drop function public.create_circle(text, text);
create function public.create_circle(
  circle_name text,
  circle_description text default '',
  circle_image text default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare new_circle uuid;
begin
  perform private.throttle('circle_manage',30);
  if circle_name is null or length(trim(circle_name)) not between 1 and 60
    or circle_description is null or length(circle_description)>240 then
    raise exception 'Dati della cerchia non validi';
  end if;
  if not private.circle_image_available(circle_image) then
    raise exception 'Immagine non disponibile';
  end if;
  insert into public.circles(name,description,image_path,created_by)
  values(trim(circle_name),trim(circle_description),circle_image,auth.uid()) returning id into new_circle;
  insert into public.circle_members(circle_id,user_id,role,status,joined_at)
  values(new_circle,auth.uid(),'admin','active',now());
  return new_circle;
end $$;

drop function public.update_circle(uuid, text, text);
create function public.update_circle(
  target_circle uuid,
  circle_name text,
  circle_description text default '',
  circle_image text default null
) returns void
language plpgsql security definer set search_path='' as $$
declare current_image text;
begin
  perform private.throttle('circle_manage',30);
  if not private.admins_circle(target_circle) then raise exception 'Accesso negato'; end if;
  if circle_name is null or length(trim(circle_name)) not between 1 and 60
    or circle_description is null or length(circle_description)>240 then
    raise exception 'Dati della cerchia non validi';
  end if;
  select image_path into current_image from public.circles
  where id=target_circle and archived_at is null for update;
  if not found then raise exception 'Cerchia non disponibile'; end if;
  if circle_image is distinct from current_image and not private.circle_image_available(circle_image) then
    raise exception 'Immagine non disponibile';
  end if;
  update public.circles
  set name=trim(circle_name),description=trim(circle_description),image_path=circle_image,updated_at=now()
  where id=target_circle;
end $$;

create or replace function private.can_read_asset(asset_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select private.member() and exists(select 1 from public.media_assets a where a.path=asset_path and not a.deleting and (
    (a.owner_id=auth.uid() and a.created_at>now()-interval '1 hour'
      and not exists(select 1 from public.posts p where p.media_path=a.path)
      and not exists(select 1 from public.messages m where m.media_path=a.path)
      and not exists(select 1 from public.circles c where c.image_path=a.path))
    or exists(select 1 from public.posts p where p.media_path=a.path and private.can_see_post(p.id))
    or exists(select 1 from public.messages m where m.media_path=a.path
      and (m.sender_id=auth.uid() or m.recipient_id=auth.uid())
      and (m.expires_at is null or m.expires_at>now()))
    or exists(select 1 from public.circles c where c.image_path=a.path and private.in_circle(c.id))
  ))
$$;

create or replace function public.claim_media_cleanup() returns setof text
language sql security invoker set search_path='' as $$
  with candidates as (
    select a.path from public.media_assets a where (a.deleting or a.created_at<now()-interval '1 hour')
      and not exists(select 1 from public.posts p where p.media_path=a.path)
      and not exists(select 1 from public.messages m where m.media_path=a.path)
      and not exists(select 1 from public.circles c where c.image_path=a.path)
    order by a.deleting desc,a.created_at limit 100 for update skip locked
  ) update public.media_assets set deleting=true
  where path in(select path from candidates) returning path
$$;

revoke all on function private.circle_image_available(text) from public,anon,authenticated;
revoke all on function public.create_circle(text,text,text),public.update_circle(uuid,text,text,text) from public,anon;
grant execute on function public.create_circle(text,text,text),public.update_circle(uuid,text,text,text) to authenticated;
