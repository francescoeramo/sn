create function public.update_circle(
  target_circle uuid,
  circle_name text,
  circle_description text default ''
) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.throttle('circle_manage',30);
  if not private.admins_circle(target_circle) then raise exception 'Accesso negato'; end if;
  if circle_name is null or length(trim(circle_name)) not between 1 and 60
    or circle_description is null or length(circle_description)>240 then
    raise exception 'Dati della cerchia non validi';
  end if;
  update public.circles
  set name=trim(circle_name),description=trim(circle_description),updated_at=now()
  where id=target_circle and archived_at is null;
  if not found then raise exception 'Cerchia non disponibile'; end if;
end $$;

create function public.set_circle_member_role(
  target_circle uuid,
  other uuid,
  new_role text
) returns void
language plpgsql security definer set search_path='' as $$
declare current_role text;
begin
  perform private.throttle('circle_manage',30);
  if not private.admins_circle(target_circle) or other=auth.uid() or new_role not in('admin','member') then
    raise exception 'Accesso negato';
  end if;
  select role into current_role from public.circle_members
  where circle_id=target_circle and user_id=other and status='active' for update;
  if not found then raise exception 'Persona non disponibile'; end if;
  if current_role='admin' and new_role='member'
    and (select count(*) from public.circle_members
         where circle_id=target_circle and status='active' and role='admin')=1 then
    raise exception 'La cerchia deve avere almeno un admin';
  end if;
  update public.circle_members set role=new_role
  where circle_id=target_circle and user_id=other;
end $$;

create function public.remove_circle_member(target_circle uuid,other uuid) returns void
language plpgsql security definer set search_path='' as $$
declare member_role text; member_status text;
begin
  perform private.throttle('circle_manage',30);
  if not private.admins_circle(target_circle) or other=auth.uid() then
    raise exception 'Accesso negato';
  end if;
  select role,status into member_role,member_status from public.circle_members
  where circle_id=target_circle and user_id=other for update;
  if not found then raise exception 'Persona non disponibile'; end if;
  if member_status='active' and member_role='admin'
    and (select count(*) from public.circle_members
         where circle_id=target_circle and status='active' and role='admin')=1 then
    raise exception 'La cerchia deve avere almeno un admin';
  end if;
  delete from public.circle_members where circle_id=target_circle and user_id=other;
end $$;

create function public.create_circle_poll(
  target_circles uuid[],
  question text,
  warning text,
  options text[],
  duration_seconds integer
) returns uuid
language plpgsql security definer set search_path='' as $$
declare new_post uuid; target uuid;
begin
  perform private.throttle('post',20);
  if target_circles is null or cardinality(target_circles) not between 1 and 5
    or cardinality(target_circles)<>(select count(distinct value) from unnest(target_circles) value) then
    raise exception 'Scegli da una a cinque cerchie';
  end if;
  foreach target in array target_circles loop
    if not private.in_circle(target)
      or exists(select 1 from public.circles where id=target and archived_at is not null) then
      raise exception 'Cerchia non disponibile';
    end if;
  end loop;
  new_post:=public.create_poll(question,warning,options,duration_seconds);
  insert into public.circle_posts(circle_id,post_id,added_by)
  select value,new_post,auth.uid() from unnest(target_circles) value;
  return new_post;
end $$;

create function public.delete_circle(target_circle uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.throttle('circle_manage',30);
  if not private.admins_circle(target_circle) then raise exception 'Accesso negato'; end if;
  delete from public.posts p
  where exists(
    select 1 from public.circle_posts own_link
    where own_link.post_id=p.id and own_link.circle_id=target_circle
  ) and not exists(
    select 1 from public.circle_posts other_link
    where other_link.post_id=p.id and other_link.circle_id<>target_circle
  );
  delete from public.circles where id=target_circle;
  if not found then raise exception 'Cerchia non disponibile'; end if;
end $$;

revoke all on function public.update_circle(uuid,text,text),public.set_circle_member_role(uuid,uuid,text),public.remove_circle_member(uuid,uuid),public.create_circle_poll(uuid[],text,text,text[],integer),public.delete_circle(uuid) from public,anon;
grant execute on function public.update_circle(uuid,text,text),public.set_circle_member_role(uuid,uuid,text),public.remove_circle_member(uuid,uuid),public.create_circle_poll(uuid[],text,text,text[],integer),public.delete_circle(uuid) to authenticated;
