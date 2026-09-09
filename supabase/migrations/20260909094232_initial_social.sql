-- SN beta: all writes are bounded at the database boundary, including direct REST calls.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table private.settings (
  id boolean primary key default true check(id), max_members integer not null default 20 check(max_members between 1 and 20),
  uploads_enabled boolean not null default true, registrations_enabled boolean not null default true
);
insert into private.settings default values;
create table private.invites (token_hash text primary key, email text not null, expires_at timestamptz not null default now()+interval '7 days', used_at timestamptz);
create table private.admins (user_id uuid primary key references auth.users on delete cascade);
create table private.rates (user_id uuid not null references auth.users on delete cascade, bucket text not null, started_at timestamptz not null default now(), hits integer not null default 1, primary key(user_id,bucket));
create table private.federation_queue (id uuid primary key default gen_random_uuid(), activity_id text unique not null, actor_id uuid references auth.users on delete cascade, target_host text not null, payload jsonb not null, attempts integer not null default 0, available_at timestamptz not null default now(), status text not null default 'paused' check(status in ('paused','pending','delivered','failed')));
create table private.blocked_instances (hostname text primary key, reason text not null);
create index federation_due on private.federation_queue(available_at) where status='pending';

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check(username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check(length(display_name) between 1 and 60), bio text not null default '' check(length(bio)<=300),
  is_private boolean not null default true, color text not null default 'lilac' check(color in ('lilac','peach','green','blue','yellow')),
  created_at timestamptz not null default now(), disabled boolean not null default false,
  actor_key uuid unique not null default gen_random_uuid()
);
create table public.blocks (blocker_id uuid not null references public.profiles on delete cascade, blocked_id uuid not null references public.profiles on delete cascade, primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id));
create index blocks_target on public.blocks(blocked_id);
create table public.follows (follower_id uuid not null references public.profiles on delete cascade, following_id uuid not null references public.profiles on delete cascade, accepted boolean not null default false, primary key(follower_id,following_id), check(follower_id<>following_id));
create index follows_target on public.follows(following_id,accepted);
create table public.media_assets (
  path text primary key, owner_id uuid not null references public.profiles on delete cascade,
  bytes integer not null check(bytes between 1 and 3145728), mime text not null check(mime in ('image/jpeg','image/png','image/webp','video/mp4','video/webm')),
  created_at timestamptz not null default now(), deleting boolean not null default false, check(path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$')
);
create index media_owner on public.media_assets(owner_id);
create table public.posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles on delete cascade,
  body text not null default '' check(length(body)<=2200), kind text not null default 'post' check(kind in ('post','story','reel')),
  media_path text unique references public.media_assets(path), media_type text,
  alt text not null default '' check(length(alt)<=300), created_at timestamptz not null default now(), expires_at timestamptz,
  activity_key uuid unique not null default gen_random_uuid(),
  check(length(trim(body))>0 or media_path is not null), check(kind='post' or media_path is not null)
);
create index posts_feed on public.posts(created_at desc,id);
create index posts_author on public.posts(author_id,created_at desc);
create index posts_expiry on public.posts(expires_at) where expires_at is not null;
create table public.likes (user_id uuid not null references public.profiles on delete cascade, post_id uuid not null references public.posts on delete cascade, primary key(user_id,post_id));
create index likes_post on public.likes(post_id);
create table public.comments (id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles on delete cascade, post_id uuid not null references public.posts on delete cascade, body text not null check(length(trim(body)) between 1 and 1000), created_at timestamptz not null default now());
create index comments_post on public.comments(post_id,created_at);
create index comments_author on public.comments(author_id);
create table public.messages (id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles on delete cascade, recipient_id uuid not null references public.profiles on delete cascade, body text not null check(length(trim(body)) between 1 and 2000), created_at timestamptz not null default now(), check(sender_id<>recipient_id));
create index messages_recipient on public.messages(recipient_id,created_at desc);
create index messages_sender on public.messages(sender_id,created_at desc);
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade, actor_id uuid not null references public.profiles on delete cascade, kind text not null, post_id uuid references public.posts on delete cascade, read boolean not null default false, created_at timestamptz not null default now());
create index notifications_user on public.notifications(user_id,created_at desc);
create index notifications_actor on public.notifications(actor_id);
create index notifications_post on public.notifications(post_id);
create table public.reports (id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles on delete cascade, post_id uuid references public.posts on delete set null, reason text not null check(length(trim(reason)) between 5 and 1000), status text not null default 'open' check(status in ('open','dismissed','removed')), created_at timestamptz not null default now());
create index reports_reporter on public.reports(reporter_id);
create index reports_post on public.reports(post_id);

-- Non-exposed helpers use the caller's identity and a fixed search_path. They avoid recursive policies.
create function private.member() returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and not disabled)
$$;
create function private.admin() returns boolean language sql stable security definer set search_path='' as $$
  select private.member() and exists(select 1 from private.admins where user_id=auth.uid())
$$;
create function private.blocked(other uuid) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is null or exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=other) or (blocked_id=auth.uid() and blocker_id=other))
$$;
create function private.can_see_author(other uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.member() and not private.blocked(other) and exists(select 1 from public.profiles p where p.id=other and not p.disabled and (p.id=auth.uid() or not p.is_private or exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.following_id=p.id and f.accepted)))
$$;
create function private.can_see_post(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.member() and exists(select 1 from public.posts p where p.id=target and (expires_at is null or expires_at>now()) and private.can_see_author(p.author_id))
$$;
create function private.can_message(other uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.member() and not private.blocked(other) and exists(select 1 from public.profiles where id=other and not disabled) and exists(select 1 from public.follows where follower_id=auth.uid() and following_id=other and accepted) and exists(select 1 from public.follows where follower_id=other and following_id=auth.uid() and accepted)
$$;
create function private.throttle(bucket_name text, maximum integer) returns void language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if not private.member() then raise exception 'Accesso negato'; end if;
  insert into private.rates(user_id,bucket) values(auth.uid(),bucket_name)
  on conflict(user_id,bucket) do update set hits=case when private.rates.started_at < now()-interval '1 hour' then 1 else private.rates.hits+1 end,
    started_at=case when private.rates.started_at < now()-interval '1 hour' then now() else private.rates.started_at end returning hits into n;
  if n>maximum then raise exception 'Limite orario raggiunto. Riprova più tardi.'; end if;
end $$;

create function private.before_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare invite_hash text; cfg private.settings;
begin
  select * into cfg from private.settings where id=true for update;
  if not cfg.registrations_enabled or (select count(*) from auth.users)>=cfg.max_members then raise exception 'Registrazioni chiuse'; end if;
  invite_hash := encode(sha256(convert_to(coalesce(new.raw_user_meta_data->>'invite_code',''),'UTF8')),'hex');
  update private.invites set used_at=now() where token_hash=invite_hash and lower(email)=lower(new.email) and used_at is null and expires_at>now();
  if not found then raise exception 'Invito non valido'; end if;
  if coalesce(new.raw_user_meta_data->>'username','') !~ '^[a-z0-9_]{3,24}$' then raise exception 'Nome utente non valido'; end if;
  new.raw_user_meta_data := new.raw_user_meta_data - 'invite_code';
  return new;
end $$;
create trigger sn_invite_guard before insert on auth.users for each row execute function private.before_signup();
create function private.after_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,username,display_name) values(new.id,new.raw_user_meta_data->>'username',new.raw_user_meta_data->>'username');
  return new;
end $$;
create trigger sn_profile after insert on auth.users for each row execute function private.after_signup();

create function private.reserve_media() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.throttle('upload',30);
  perform 1 from private.settings where id=true for update;
  if not (select uploads_enabled from private.settings where id=true) then raise exception 'Upload sospesi'; end if;
  if new.owner_id<>auth.uid() or split_part(new.path,'/',1)<>auth.uid()::text then raise exception 'Accesso negato'; end if;
  if coalesce((select sum(bytes) from public.media_assets),0)+new.bytes>838860800 or coalesce((select sum(bytes) from public.media_assets where owner_id=auth.uid()),0)+new.bytes>41943040 then raise exception 'Spazio esaurito'; end if;
  new.created_at:=now(); return new;
end $$;
create trigger sn_media_limit before insert on public.media_assets for each row execute function private.reserve_media();

create function private.post_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare asset public.media_assets;
begin
  perform private.throttle('post',30);
  if new.author_id<>auth.uid() then raise exception 'Accesso negato'; end if;
  new.created_at:=now(); new.expires_at:=case when new.kind='story' then now()+interval '24 hours' else null end;
  if new.media_path is not null then
    select * into asset from public.media_assets where path=new.media_path and owner_id=auth.uid() and not deleting and created_at>now()-interval '1 hour' for update;
    if not found or not exists(select 1 from storage.objects where bucket_id='media' and name=new.media_path) then raise exception 'File non disponibile'; end if;
    if new.kind='reel' and asset.mime not like 'video/%' then raise exception 'Un reel richiede un video'; end if;
    new.media_type:=asset.mime;
  else new.media_type:=null; end if;
  return new;
end $$;
create trigger sn_post_guard before insert on public.posts for each row execute function private.post_guard();
create function private.follow_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.throttle('follow',60);
  if new.follower_id<>auth.uid() or private.blocked(new.following_id) then raise exception 'Accesso negato'; end if;
  new.accepted := not (select is_private from public.profiles where id=new.following_id);
  return new;
end $$;
create trigger sn_follow_guard before insert on public.follows for each row execute function private.follow_guard();
create function private.write_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.throttle(tg_table_name,case when tg_table_name='messages' then 120 else 60 end);
  if tg_table_name in ('comments','messages','reports') then new.created_at:=now(); end if;
  return new;
end $$;
create trigger sn_comment_limit before insert on public.comments for each row execute function private.write_guard();
create trigger sn_message_limit before insert on public.messages for each row execute function private.write_guard();
create trigger sn_report_limit before insert on public.reports for each row execute function private.write_guard();
create trigger sn_like_limit before insert on public.likes for each row execute function private.write_guard();

create function private.notify() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid; actor uuid; post uuid; k text;
begin
  if tg_table_name='follows' then target:=new.following_id; actor:=new.follower_id; k:=case when new.accepted then 'follow' else 'request' end;
  elsif tg_table_name='messages' then target:=new.recipient_id; actor:=new.sender_id; k:='message';
  else post:=new.post_id; select author_id into target from public.posts where id=post; k:=tg_table_name; actor:=case when tg_table_name='likes' then (to_jsonb(new)->>'user_id')::uuid else (to_jsonb(new)->>'author_id')::uuid end;
  end if;
  if target<>actor then insert into public.notifications(user_id,actor_id,kind,post_id) values(target,actor,k,post); end if;
  return new;
end $$;
create trigger sn_notify_follow after insert on public.follows for each row execute function private.notify();
create trigger sn_notify_like after insert on public.likes for each row execute function private.notify();
create trigger sn_notify_comment after insert on public.comments for each row execute function private.notify();
create trigger sn_notify_message after insert on public.messages for each row execute function private.notify();
create function private.on_block() returns trigger language plpgsql security definer set search_path='' as $$
begin
  delete from public.follows where (follower_id=new.blocker_id and following_id=new.blocked_id) or (follower_id=new.blocked_id and following_id=new.blocker_id);
  return new;
end $$;
create trigger sn_block after insert on public.blocks for each row execute function private.on_block();

-- Enable RLS before grants; no anonymous community access in the invitation-only beta.
do $$ declare t text; begin
  foreach t in array array['profiles','blocks','follows','media_assets','posts','likes','comments','messages','notifications','reports'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
  end loop;
  foreach t in array array['settings','invites','admins','rates','federation_queue','blocked_instances'] loop
    execute format('alter table private.%I enable row level security',t);
  end loop;
end $$;
create policy profiles_read on public.profiles for select to authenticated using(private.member() and not disabled and not private.blocked(id));
create policy profiles_edit on public.profiles for update to authenticated using(private.member() and id=(select auth.uid())) with check(id=(select auth.uid()));
grant select on public.profiles to authenticated;
grant update(display_name,bio,is_private) on public.profiles to authenticated;

create policy blocks_read on public.blocks for select to authenticated using(private.member() and blocker_id=(select auth.uid()));
create policy blocks_add on public.blocks for insert to authenticated with check(private.member() and blocker_id=(select auth.uid()));
create policy blocks_remove on public.blocks for delete to authenticated using(private.member() and blocker_id=(select auth.uid()));
grant select,insert,delete on public.blocks to authenticated;

create policy follows_read on public.follows for select to authenticated using(private.member() and (follower_id=(select auth.uid()) or following_id=(select auth.uid())));
create policy follows_add on public.follows for insert to authenticated with check(private.member() and follower_id=(select auth.uid()) and not private.blocked(following_id));
create policy follows_accept on public.follows for update to authenticated using(private.member() and following_id=(select auth.uid())) with check(following_id=(select auth.uid()) and not private.blocked(follower_id));
create policy follows_remove on public.follows for delete to authenticated using(private.member() and (follower_id=(select auth.uid()) or following_id=(select auth.uid())));
grant select,delete on public.follows to authenticated;
grant insert(follower_id,following_id),update(accepted) on public.follows to authenticated;

create policy media_read on public.media_assets for select to authenticated using(private.member() and (owner_id=(select auth.uid()) or exists(select 1 from public.posts where media_path=path and private.can_see_post(id))));
create policy media_add on public.media_assets for insert to authenticated with check(private.member() and owner_id=(select auth.uid()));
-- Media deletion is done server-side after Storage removal, never releasing a reservation prematurely.
grant select on public.media_assets to authenticated;
grant insert(path,owner_id,bytes,mime) on public.media_assets to authenticated;

create policy posts_read on public.posts for select to authenticated using(private.can_see_post(id) or private.admin());
create policy posts_add on public.posts for insert to authenticated with check(private.member() and author_id=(select auth.uid()));
create policy posts_remove on public.posts for delete to authenticated using(private.member() and (author_id=(select auth.uid()) or private.admin()));
grant select,delete on public.posts to authenticated;
grant insert(author_id,body,kind,media_path,alt) on public.posts to authenticated;
create policy likes_read on public.likes for select to authenticated using(private.can_see_post(post_id));
create policy likes_add on public.likes for insert to authenticated with check(private.member() and user_id=(select auth.uid()) and private.can_see_post(post_id));
create policy likes_remove on public.likes for delete to authenticated using(private.member() and user_id=(select auth.uid()));
grant select,insert,delete on public.likes to authenticated;
create policy comments_read on public.comments for select to authenticated using(private.can_see_post(post_id) and not private.blocked(author_id));
create policy comments_add on public.comments for insert to authenticated with check(private.member() and author_id=(select auth.uid()) and private.can_see_post(post_id));
create policy comments_remove on public.comments for delete to authenticated using(private.member() and (author_id=(select auth.uid()) or private.admin()));
grant select,delete on public.comments to authenticated;
grant insert(author_id,post_id,body) on public.comments to authenticated;
create policy messages_read on public.messages for select to authenticated using(private.member() and (sender_id=(select auth.uid()) or recipient_id=(select auth.uid())));
create policy messages_add on public.messages for insert to authenticated with check(private.member() and sender_id=(select auth.uid()) and private.can_message(recipient_id));
grant select on public.messages to authenticated;
grant insert(sender_id,recipient_id,body) on public.messages to authenticated;
create policy notices_read on public.notifications for select to authenticated using(private.member() and user_id=(select auth.uid()));
create policy notices_edit on public.notifications for update to authenticated using(private.member() and user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,update(read) on public.notifications to authenticated;
create policy reports_read on public.reports for select to authenticated using(private.member() and (reporter_id=(select auth.uid()) or private.admin()));
create policy reports_add on public.reports for insert to authenticated with check(private.member() and reporter_id=(select auth.uid()) and private.can_see_post(post_id));
create policy reports_edit on public.reports for update to authenticated using(private.admin()) with check(private.admin());
grant select,update(status) on public.reports to authenticated;
grant insert(reporter_id,post_id,reason) on public.reports to authenticated;

-- Service-only operational data. All user-facing reads/writes above use the user's token.
grant all on all tables in schema private to service_role;
grant all on all tables in schema public to service_role;
revoke execute on all functions in schema private from public,anon;
grant execute on function private.member(),private.admin(),private.blocked(uuid),private.can_see_author(uuid),private.can_see_post(uuid),private.can_message(uuid) to authenticated;
create function private.usage_stats() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not private.member() then raise exception 'Accesso negato'; end if;
  return jsonb_build_object('bytes',coalesce((select sum(bytes) from public.media_assets where owner_id=auth.uid()),0),'total_bytes',coalesce((select sum(bytes) from public.media_assets),0),'members',(select count(*) from public.profiles),'uploads_enabled',(select uploads_enabled from private.settings where id=true),'isAdmin',private.admin());
end $$;
revoke all on function private.usage_stats() from public,anon;
grant execute on function private.usage_stats() to authenticated;
create function public.my_usage() returns jsonb language sql security invoker set search_path='' as $$ select private.usage_stats() $$;
revoke all on function public.my_usage() from public,anon;
grant execute on function public.my_usage() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('media','media',false,3145728,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']);
create function private.can_read_asset(asset_path text) returns boolean language sql stable security definer set search_path='' as $$
  select private.member() and exists(select 1 from public.media_assets a where a.path=asset_path and not a.deleting and (
    (a.owner_id=auth.uid() and a.created_at>now()-interval '1 hour' and not exists(select 1 from public.posts p where p.media_path=a.path))
    or exists(select 1 from public.posts p where p.media_path=a.path and private.can_see_post(p.id))
  ))
$$;
revoke all on function private.can_read_asset(text) from public,anon;
grant execute on function private.can_read_asset(text) to authenticated;
create policy sn_storage_read on storage.objects for select to authenticated using(bucket_id='media' and private.can_read_asset(name));
create policy sn_storage_insert on storage.objects for insert to authenticated with check(bucket_id='media' and private.member() and exists(select 1 from public.media_assets a where a.path=name and a.owner_id=(select auth.uid()) and a.created_at>now()-interval '1 hour' and (metadata->>'size')::bigint<=a.bytes and metadata->>'mimetype'=a.mime));
-- No overwrite or direct deletion policy: immutable blobs keep quota accounting correct.

-- Claim under a row lock also acquired by post_guard. Reservations continue counting until blobs are removed.
create function public.claim_media_cleanup() returns setof text language sql security invoker set search_path='' as $$
  with candidates as (
    select a.path from public.media_assets a where a.created_at<now()-interval '1 hour'
    and not exists(select 1 from public.posts p where p.media_path=a.path)
    order by a.created_at limit 100 for update skip locked
  ) update public.media_assets set deleting=true where path in(select path from candidates) returning path
$$;
revoke all on function public.claim_media_cleanup() from public,anon,authenticated;
grant execute on function public.claim_media_cleanup() to service_role;
