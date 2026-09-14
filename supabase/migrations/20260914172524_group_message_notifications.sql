alter table public.notifications
 add column group_id uuid references public.chat_groups on delete cascade,
 add constraint notifications_single_target check(post_id is null or group_id is null);

create index notifications_group on public.notifications(group_id) where group_id is not null;

create function private.notify_group_message() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.chat_groups set updated_at=new.created_at where id=new.group_id;
 insert into public.notifications(user_id,actor_id,kind,group_id)
 select user_id,new.sender_id,'group_message',new.group_id
 from public.chat_group_members
 where group_id=new.group_id and user_id<>new.sender_id;
 return null;
end $$;
revoke all on function private.notify_group_message() from public,anon,authenticated;
create trigger sn_notify_group_message after insert on public.chat_group_messages
for each row execute function private.notify_group_message();
