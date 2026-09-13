create table public.chat_groups (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 60),
 created_by uuid references public.profiles on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.chat_group_members (
 group_id uuid not null references public.chat_groups on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 role text not null default 'member' check(role in('admin','member')),
 joined_at timestamptz not null default now(),
 primary key(group_id,user_id)
);
create index chat_group_members_user on public.chat_group_members(user_id,joined_at desc);
create table public.chat_group_invites (
 group_id uuid not null references public.chat_groups on delete cascade,
 invitee_id uuid not null references public.profiles on delete cascade,
 inviter_id uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 primary key(group_id,invitee_id)
);
create index chat_group_invites_invitee on public.chat_group_invites(invitee_id,expires_at desc);

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_group_invites enable row level security;
revoke all on public.chat_groups,public.chat_group_members,public.chat_group_invites from public,anon,authenticated;
grant select on public.chat_groups,public.chat_group_members,public.chat_group_invites to authenticated;
grant all on public.chat_groups,public.chat_group_members,public.chat_group_invites to service_role;

create function private.in_chat_group(target_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.member() and exists(select 1 from public.chat_group_members where group_id=target_group and user_id=auth.uid())
$$;
create policy group_read on public.chat_groups for select to authenticated using(
 private.in_chat_group(id)
);
create policy group_members_read on public.chat_group_members for select to authenticated using(
 private.in_chat_group(group_id)
);
create policy group_invites_read on public.chat_group_invites for select to authenticated using(
 private.member() and (invitee_id=(select auth.uid()) or inviter_id=(select auth.uid()))
);

create function public.create_chat_group(group_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare new_group uuid;
begin
 perform private.throttle('group_manage',30);
 if group_name is null or length(trim(group_name)) not between 1 and 60 then raise exception 'Nome del gruppo non valido'; end if;
 insert into public.chat_groups(name,created_by) values(trim(group_name),auth.uid()) returning id into new_group;
 insert into public.chat_group_members(group_id,user_id,role) values(new_group,auth.uid(),'admin');
 return new_group;
end $$;

create function public.invite_chat_group_member(target_group uuid, other uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.throttle('group_manage',30);
 if not exists(select 1 from public.chat_group_members where group_id=target_group and user_id=auth.uid() and role='admin')
   or not private.can_message(other) then raise exception 'Accesso negato'; end if;
 if exists(select 1 from public.chat_group_members where group_id=target_group and user_id=other) then raise exception 'Persona già nel gruppo'; end if;
 if (select count(*) from public.chat_group_members where group_id=target_group)>=20 then raise exception 'Gruppo completo'; end if;
 insert into public.chat_group_invites(group_id,invitee_id,inviter_id) values(target_group,other,auth.uid())
 on conflict(group_id,invitee_id) do update set inviter_id=auth.uid(),created_at=now(),expires_at=now()+interval '7 days';
end $$;

create function public.respond_chat_group_invite(target_group uuid, accept_invite boolean) returns void language plpgsql security definer set search_path='' as $$
declare pending public.chat_group_invites;
begin
 perform private.throttle('group_manage',30);
 select * into pending from public.chat_group_invites where group_id=target_group and invitee_id=auth.uid() and expires_at>now() for update;
 if not found then raise exception 'Invito non disponibile'; end if;
 if accept_invite then
   perform 1 from public.chat_groups where id=target_group for update;
   if (select count(*) from public.chat_group_members where group_id=target_group)>=20 then raise exception 'Gruppo completo'; end if;
   if not private.can_message(pending.inviter_id) then raise exception 'Accesso negato'; end if;
   insert into public.chat_group_members(group_id,user_id) values(target_group,auth.uid()) on conflict do nothing;
 end if;
 delete from public.chat_group_invites where group_id=target_group and invitee_id=auth.uid();
end $$;

create function public.rename_chat_group(target_group uuid, group_name text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.throttle('group_manage',30);
 if group_name is null or length(trim(group_name)) not between 1 and 60 or not exists(select 1 from public.chat_group_members where group_id=target_group and user_id=auth.uid() and role='admin') then raise exception 'Accesso negato'; end if;
 update public.chat_groups set name=trim(group_name),updated_at=now() where id=target_group;
end $$;

create function public.remove_chat_group_member(target_group uuid, member uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.throttle('group_manage',30);
 if member=auth.uid() or not exists(select 1 from public.chat_group_members where group_id=target_group and user_id=auth.uid() and role='admin') then raise exception 'Accesso negato'; end if;
 if exists(select 1 from public.chat_group_members where group_id=target_group and user_id=member and role='admin')
   and (select count(*) from public.chat_group_members where group_id=target_group and role='admin')=1 then raise exception 'Serve almeno un admin'; end if;
 delete from public.chat_group_members where group_id=target_group and user_id=member;
end $$;

create function public.set_chat_group_role(target_group uuid, member uuid, next_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.throttle('group_manage',30);
 if next_role is null or next_role not in('admin','member') or not exists(select 1 from public.chat_group_members where group_id=target_group and user_id=auth.uid() and role='admin') then raise exception 'Accesso negato'; end if;
 if next_role='member' and member=auth.uid() and (select count(*) from public.chat_group_members where group_id=target_group and role='admin')=1 then raise exception 'Serve almeno un admin'; end if;
 update public.chat_group_members set role=next_role where group_id=target_group and user_id=member;
 if not found then raise exception 'Persona non disponibile'; end if;
end $$;

create function public.leave_chat_group(target_group uuid) returns void language plpgsql security definer set search_path='' as $$
declare my_role text; successor uuid;
begin
 perform private.throttle('group_manage',30);
 select role into my_role from public.chat_group_members where group_id=target_group and user_id=auth.uid() for update;
 if not found then raise exception 'Accesso negato'; end if;
 if my_role='admin' and (select count(*) from public.chat_group_members where group_id=target_group and role='admin')=1 then
   select user_id into successor from public.chat_group_members where group_id=target_group and user_id<>auth.uid() order by joined_at,user_id limit 1 for update;
   if successor is not null then update public.chat_group_members set role='admin' where group_id=target_group and user_id=successor; end if;
 end if;
 delete from public.chat_group_members where group_id=target_group and user_id=auth.uid();
 if not exists(select 1 from public.chat_group_members where group_id=target_group) then delete from public.chat_groups where id=target_group; end if;
end $$;

revoke all on function public.create_chat_group(text),public.invite_chat_group_member(uuid,uuid),public.respond_chat_group_invite(uuid,boolean),public.rename_chat_group(uuid,text),public.remove_chat_group_member(uuid,uuid),public.set_chat_group_role(uuid,uuid,text),public.leave_chat_group(uuid) from public,anon;
grant execute on function public.create_chat_group(text),public.invite_chat_group_member(uuid,uuid),public.respond_chat_group_invite(uuid,boolean),public.rename_chat_group(uuid,text),public.remove_chat_group_member(uuid,uuid),public.set_chat_group_role(uuid,uuid,text),public.leave_chat_group(uuid) to authenticated;
