create table public.circles (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 60),
 description text not null default '' check(length(description)<=240),
 image_path text references public.media_assets(path) on delete set null,
 created_by uuid references public.profiles on delete set null,
 archived_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.circle_members (
 circle_id uuid not null references public.circles on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 role text not null default 'member' check(role in('admin','member')),
 invited_by uuid references public.profiles on delete set null,
 status text not null default 'invited' check(status in('invited','active')),
 joined_at timestamptz,
 created_at timestamptz not null default now(),
 primary key(circle_id,user_id)
);

create table public.circle_posts (
 circle_id uuid not null references public.circles on delete cascade,
 post_id uuid not null references public.posts on delete cascade,
 added_by uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(),
 primary key(circle_id,post_id)
);

create index circle_members_user_status on public.circle_members(user_id,status,circle_id);
create index circle_members_circle_status on public.circle_members(circle_id,status,user_id);
create index circle_posts_post on public.circle_posts(post_id,circle_id);
create index circle_posts_circle_created on public.circle_posts(circle_id,created_at desc,post_id);

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_posts enable row level security;

revoke all on public.circles,public.circle_members,public.circle_posts from public,anon,authenticated;
grant select on public.circles,public.circle_members,public.circle_posts to authenticated;
grant all on public.circles,public.circle_members,public.circle_posts to service_role;

create function private.in_circle(target_circle uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.member() and exists(
   select 1 from public.circle_members
   where circle_id=target_circle and user_id=(select auth.uid()) and status='active'
 )
$$;

create function private.admins_circle(target_circle uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.member() and exists(
   select 1 from public.circle_members
   where circle_id=target_circle and user_id=(select auth.uid()) and status='active' and role='admin'
 )
$$;

create policy circles_read on public.circles for select to authenticated using(
 private.in_circle(id) or exists(
   select 1 from public.circle_members
   where circle_id=id and user_id=(select auth.uid()) and status='invited'
 )
);
create policy circle_members_read on public.circle_members for select to authenticated using(
 private.in_circle(circle_id) or user_id=(select auth.uid())
);
create policy circle_posts_read on public.circle_posts for select to authenticated using(
 private.in_circle(circle_id)
);

create or replace function private.can_see_post(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.member()
 and exists(
   select 1 from public.posts p
   where p.id=target and (p.expires_at is null or p.expires_at>now())
   and not private.blocked(p.author_id)
   and private.can_see_author(p.author_id)
 )
 and (
   not exists(select 1 from public.circle_posts cp where cp.post_id=target)
   or exists(
     select 1 from public.circle_posts cp
     join public.circle_members cm on cm.circle_id=cp.circle_id
     where cp.post_id=target and cm.user_id=(select auth.uid()) and cm.status='active'
   )
 )
$$;

create function public.create_circle(circle_name text,circle_description text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare new_circle uuid;
begin
 perform private.throttle('circle_manage',30);
 if circle_name is null or length(trim(circle_name)) not between 1 and 60
   or circle_description is null or length(circle_description)>240 then
   raise exception 'Dati della cerchia non validi';
 end if;
 insert into public.circles(name,description,created_by)
 values(trim(circle_name),trim(circle_description),auth.uid()) returning id into new_circle;
 insert into public.circle_members(circle_id,user_id,role,status,joined_at)
 values(new_circle,auth.uid(),'admin','active',now());
 return new_circle;
end $$;

create function public.invite_circle_member(target_circle uuid,other uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.throttle('circle_manage',30);
 if not private.admins_circle(target_circle) or not private.can_message(other) then
   raise exception 'Puoi invitare solo contatti reciproci';
 end if;
 if exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=other) or (blocker_id=other and blocked_id=auth.uid())) then
   raise exception 'Accesso negato';
 end if;
 if (select count(*) from public.circle_members where circle_id=target_circle)>=20 then
   raise exception 'La cerchia ha già 20 persone';
 end if;
 insert into public.circle_members(circle_id,user_id,invited_by,status)
 values(target_circle,other,auth.uid(),'invited')
 on conflict(circle_id,user_id) do update set invited_by=auth.uid(),status='invited',joined_at=null
 where public.circle_members.status<>'active';
end $$;

create function public.respond_circle_invite(target_circle uuid,accept_invite boolean) returns void
language plpgsql security definer set search_path='' as $$
declare inviter uuid;
begin
 perform private.throttle('circle_manage',30);
 select invited_by into inviter from public.circle_members
 where circle_id=target_circle and user_id=auth.uid() and status='invited' for update;
 if not found then raise exception 'Invito non disponibile'; end if;
 if accept_invite then
   perform 1 from public.circles where id=target_circle and archived_at is null for update;
   if not found or not private.can_message(inviter) then raise exception 'Invito non disponibile'; end if;
   update public.circle_members set status='active',joined_at=now()
   where circle_id=target_circle and user_id=auth.uid();
 else
   delete from public.circle_members where circle_id=target_circle and user_id=auth.uid();
 end if;
end $$;

create function public.leave_circle(target_circle uuid) returns void
language plpgsql security definer set search_path='' as $$
declare my_role text; successor uuid;
begin
 perform private.throttle('circle_manage',30);
 select role into my_role from public.circle_members
 where circle_id=target_circle and user_id=auth.uid() and status='active' for update;
 if not found then raise exception 'Accesso negato'; end if;
 if my_role='admin' and (select count(*) from public.circle_members where circle_id=target_circle and status='active' and role='admin')=1 then
   select user_id into successor from public.circle_members
   where circle_id=target_circle and user_id<>auth.uid() and status='active'
   order by joined_at,user_id limit 1 for update;
   if successor is not null then
     update public.circle_members set role='admin' where circle_id=target_circle and user_id=successor;
   end if;
 end if;
 delete from public.circle_members where circle_id=target_circle and user_id=auth.uid();
 if not exists(select 1 from public.circle_members where circle_id=target_circle and status='active') then
   update public.circles set archived_at=now(),updated_at=now() where id=target_circle;
 end if;
end $$;

create function public.archive_circle(target_circle uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.throttle('circle_manage',30);
 if not private.admins_circle(target_circle) then raise exception 'Accesso negato'; end if;
 update public.circles set archived_at=coalesce(archived_at,now()),updated_at=now() where id=target_circle;
end $$;

create function public.create_circle_post(
 target_circles uuid[],post_body text,warning text default '',media text default null,alternative text default ''
) returns uuid language plpgsql security definer set search_path='' as $$
declare new_post uuid; target uuid;
begin
 perform private.throttle('post',20);
 if target_circles is null or cardinality(target_circles) not between 1 and 5
   or cardinality(target_circles)<>(select count(distinct value) from unnest(target_circles) value)
   or post_body is null or length(trim(post_body)) not between 1 and 2200
   or warning is null or length(warning)>180 or alternative is null or length(alternative)>500 then
   raise exception 'Post non valido';
 end if;
 foreach target in array target_circles loop
   if not private.in_circle(target) or exists(select 1 from public.circles where id=target and archived_at is not null) then
     raise exception 'Cerchia non disponibile';
   end if;
 end loop;
 insert into public.posts(author_id,body,content_warning,kind,media_path,alt)
 values(auth.uid(),trim(post_body),trim(warning),'post',media,trim(alternative)) returning id into new_post;
 insert into public.circle_posts(circle_id,post_id,added_by)
 select value,new_post,auth.uid() from unnest(target_circles) value;
 return new_post;
end $$;

revoke all on function private.in_circle(uuid),private.admins_circle(uuid) from public,anon;
grant execute on function private.in_circle(uuid),private.admins_circle(uuid) to authenticated;
revoke all on function public.create_circle(text,text),public.invite_circle_member(uuid,uuid),public.respond_circle_invite(uuid,boolean),public.leave_circle(uuid),public.archive_circle(uuid),public.create_circle_post(uuid[],text,text,text,text) from public,anon;
grant execute on function public.create_circle(text,text),public.invite_circle_member(uuid,uuid),public.respond_circle_invite(uuid,boolean),public.leave_circle(uuid),public.archive_circle(uuid),public.create_circle_post(uuid[],text,text,text,text) to authenticated;
