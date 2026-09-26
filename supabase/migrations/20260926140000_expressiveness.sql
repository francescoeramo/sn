-- Conversazioni più espressive: reazioni private, risposte contestuali,
-- menzioni con preferenza del destinatario e condivisioni interne.
-- Nessuna classifica, contatore pubblico o cascata di repost.

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  target_type text not null check(target_type in('post','comment','message')),
  target_id uuid not null,
  emoji text not null check(emoji in('❤️','😂','👍','🎉','😮','🙏')),
  created_at timestamptz not null default now(),
  unique(user_id,target_type,target_id)
);
create index reactions_target on public.reactions(target_type,target_id);

create table public.mention_preferences (
  user_id uuid primary key references public.profiles on delete cascade,
  mentions_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.mentions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles on delete cascade,
  mentioned_id uuid not null references public.profiles on delete cascade,
  source_type text not null check(source_type in('post','comment')),
  source_id uuid not null,
  post_id uuid not null references public.posts on delete cascade,
  created_at timestamptz not null default now(),
  unique(author_id,mentioned_id,source_type,source_id)
);

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  target_type text not null check(target_type in('post','comment')),
  target_id uuid not null,
  destination_type text not null check(destination_type in('chat','circle')),
  destination_id uuid not null,
  note text not null default '' check(length(note)<=280),
  created_at timestamptz not null default now()
);
create index shares_user_created on public.shares(user_id,created_at desc);

alter table public.comments add column parent_id uuid references public.comments on delete cascade;
alter table public.comments add column quote text not null default '' check(length(quote)<=180);
create index comments_parent on public.comments(parent_id,created_at);

alter table public.reactions enable row level security;
alter table public.mention_preferences enable row level security;
alter table public.mentions enable row level security;
alter table public.shares enable row level security;
revoke all on public.reactions,public.mention_preferences,public.mentions,public.shares from public,anon,authenticated;
grant select,insert,delete on public.reactions to authenticated;
grant select,insert,update on public.mention_preferences to authenticated;
grant select on public.mentions to authenticated;
grant select,insert,delete on public.shares to authenticated;
grant all on public.reactions,public.mention_preferences,public.mentions,public.shares to service_role;

create function private.can_react(target_type text, target_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.member() and case target_type
    when 'post' then private.can_see_post(target_id)
    when 'comment' then exists(select 1 from public.comments c where c.id=target_id and private.can_see_post(c.post_id) and not private.blocked(c.author_id))
    when 'message' then exists(select 1 from public.messages m where m.id=target_id and (m.sender_id=auth.uid() or m.recipient_id=auth.uid()) and (m.expires_at is null or m.expires_at>now()))
    else false end
$$;

create function private.can_share(target_type text, target_id uuid, destination_type text, destination_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.member()
    and case target_type
      when 'post' then private.can_see_post(target_id)
      when 'comment' then exists(select 1 from public.comments c where c.id=target_id and private.can_see_post(c.post_id) and not private.blocked(c.author_id))
      else false end
    and case destination_type
      when 'chat' then private.can_message(destination_id)
      when 'circle' then private.in_circle(destination_id)
      else false end
$$;

-- Reazioni private: ognuno vede solo le proprie, come i salvati.
create policy reactions_read on public.reactions for select to authenticated
using(user_id=(select auth.uid()));
create policy reactions_add on public.reactions for insert to authenticated
with check(user_id=(select auth.uid()) and private.can_react(target_type,target_id));
create policy reactions_remove on public.reactions for delete to authenticated
using(user_id=(select auth.uid()));

create policy mention_preferences_read on public.mention_preferences for select to authenticated
using(user_id=(select auth.uid()));
create policy mention_preferences_add on public.mention_preferences for insert to authenticated
with check(user_id=(select auth.uid()));
create policy mention_preferences_update on public.mention_preferences for update to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create policy mentions_read on public.mentions for select to authenticated
using(author_id=(select auth.uid()) or mentioned_id=(select auth.uid()));

create policy shares_read on public.shares for select to authenticated
using(user_id=(select auth.uid()));
create policy shares_add on public.shares for insert to authenticated
with check(user_id=(select auth.uid()) and private.can_share(target_type,target_id,destination_type,destination_id));
create policy shares_remove on public.shares for delete to authenticated
using(user_id=(select auth.uid()));

grant insert(parent_id,quote) on public.comments to authenticated;

-- Una risposta cita un commento dello stesso post e visibile al rispondente.
create function private.comment_reply_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare parent public.comments;
begin
  if new.parent_id is null then return new; end if;
  select * into parent from public.comments where id=new.parent_id;
  if not found or parent.post_id<>new.post_id or parent.id=new.id
    or not private.can_see_post(parent.post_id) or private.blocked(parent.author_id) then
    raise exception 'Risposta non disponibile';
  end if;
  new.quote := left(coalesce(nullif(trim(new.quote),''),parent.body),180);
  return new;
end $$;
create trigger sn_comment_reply_guard before insert on public.comments
for each row execute function private.comment_reply_guard();

-- Menzioni: rispettano preferenza del destinatario, blocchi e visibilità.
create function private.extract_mentions() returns trigger language plpgsql security definer set search_path='' as $$
declare source_kind text; source uuid; pid uuid; author uuid; body text; handle text; target uuid;
begin
  if tg_table_name='posts' then
    source_kind:='post'; source:=new.id; pid:=new.id; author:=new.author_id; body:=new.body;
  else
    source_kind:='comment'; source:=new.id; pid:=new.post_id; author:=new.author_id; body:=new.body;
  end if;
  for handle in select distinct m[1] from regexp_matches(body,'@([a-zA-Z0-9_]{2,30})','g') as m loop
    select p.id into target from public.profiles p
    where lower(p.username)=lower(handle) and not p.disabled and p.id<>author;
    if target is not null and not private.blocked(target) and private.can_see_post(pid) then
      insert into public.mentions(author_id,mentioned_id,source_type,source_id,post_id)
      values(author,target,source_kind,source,pid)
      on conflict(author_id,mentioned_id,source_type,source_id) do nothing;
      if found and coalesce((select mentions_enabled from public.mention_preferences where user_id=target),true) then
        insert into public.notifications(user_id,actor_id,kind,post_id) values(target,author,'mention',pid);
      end if;
    end if;
  end loop;
  return new;
end $$;
create trigger sn_mentions_post after insert on public.posts
for each row execute function private.extract_mentions();
create trigger sn_mentions_comment after insert on public.comments
for each row execute function private.extract_mentions();
