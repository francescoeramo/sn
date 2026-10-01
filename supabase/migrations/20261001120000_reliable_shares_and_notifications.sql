-- Make internal chat shares visible to their recipients and collapse repeated
-- follow-request notifications into one current notification.

drop policy if exists shares_read on public.shares;
create policy shares_read on public.shares for select to authenticated
using(
  user_id=(select auth.uid())
  or (
    destination_type='chat'
    and destination_id=(select auth.uid())
    and private.can_message(user_id)
  )
  or (
    destination_type='circle'
    and private.in_circle(destination_id)
  )
);

-- Keep the newest row before adding the concurrency-safe uniqueness rule.
delete from public.notifications older
using public.notifications newer
where older.user_id=newer.user_id
  and older.actor_id=newer.actor_id
  and older.kind=newer.kind
  and older.post_id is null
  and newer.post_id is null
  and older.kind in ('follow','request')
  and (older.created_at,older.id)<(newer.created_at,newer.id);

create unique index if not exists notifications_unique_connection
on public.notifications(user_id,actor_id,kind)
where post_id is null and kind in ('follow','request');

create or replace function private.notify() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid; actor uuid; post uuid; k text;
begin
  if tg_table_name='follows' then
    target:=new.following_id;
    actor:=new.follower_id;
    k:=case when new.accepted then 'follow' else 'request' end;
  elsif tg_table_name='messages' then
    target:=new.recipient_id; actor:=new.sender_id; k:='message';
  else
    post:=new.post_id;
    select author_id into target from public.posts where id=post;
    k:=tg_table_name;
    actor:=case when tg_table_name='likes' then (to_jsonb(new)->>'user_id')::uuid else (to_jsonb(new)->>'author_id')::uuid end;
  end if;
  if target<>actor then
    if post is null and k in ('follow','request') then
      insert into public.notifications(user_id,actor_id,kind,post_id)
      values(target,actor,k,null)
      on conflict(user_id,actor_id,kind)
      where post_id is null and kind in ('follow','request')
      do update set read=false,created_at=now();
    else
      insert into public.notifications(user_id,actor_id,kind,post_id)
      values(target,actor,k,post);
    end if;
  end if;
  return new;
end $$;

-- Repair accounts created by Auth while the profile trigger was unavailable.
-- Invalid or already-taken usernames stay untouched and remain visible to an
-- administrator instead of receiving a guessed identity.
insert into public.profiles(id,username,display_name)
select u.id,u.raw_user_meta_data->>'username',u.raw_user_meta_data->>'username'
from auth.users u
where not exists(select 1 from public.profiles p where p.id=u.id)
  and coalesce(u.raw_user_meta_data->>'username','') ~ '^[a-z0-9_.]{3,24}$'
  and not exists(
    select 1 from public.profiles p
    where lower(p.username)=lower(u.raw_user_meta_data->>'username')
  )
on conflict do nothing;

create or replace function public.signup_invite_status(candidate_token text,candidate_email text)
returns text
language sql stable security definer set search_path=''
as $$
  select case
    when i.token_hash is null then 'missing'
    when i.used_at is not null then 'used'
    when i.expires_at<=now() then 'expired'
    when lower(i.email)<>lower(candidate_email) then 'email_mismatch'
    else 'valid'
  end
  from (values(1)) as seed(n)
  left join private.invites i
    on i.token_hash=encode(sha256(convert_to(candidate_token,'UTF8')),'hex')
$$;
revoke all on function public.signup_invite_status(text,text) from public,anon,authenticated;
grant execute on function public.signup_invite_status(text,text) to service_role;
