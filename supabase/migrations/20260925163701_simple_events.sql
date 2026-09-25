create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles on delete cascade,
  circle_id uuid references public.circles on delete cascade,
  title text not null check(length(trim(title)) between 1 and 100),
  description text not null default '' check(length(description)<=1200),
  location text not null default '' check(length(location)<=160),
  starts_at timestamptz not null,
  ends_at timestamptz check(ends_at is null or ends_at>starts_at),
  capacity integer check(capacity between 2 and 100),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notifications add column event_id uuid references public.events on delete cascade;

create table public.event_responses (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  response text not null check(response in('going','maybe','declined')),
  updated_at timestamptz not null default now(),
  primary key(event_id,user_id)
);

create table public.event_updates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  kind text not null check(kind in('comment','update')),
  body text not null check(length(trim(body)) between 1 and 1200),
  created_at timestamptz not null default now()
);

create index events_start on public.events(starts_at,id);
create index events_circle_start on public.events(circle_id,starts_at);
create index event_responses_user on public.event_responses(user_id,event_id);
create index event_updates_event_created on public.event_updates(event_id,created_at,id);

alter table public.events enable row level security;
alter table public.event_responses enable row level security;
alter table public.event_updates enable row level security;
revoke all on public.events,public.event_responses,public.event_updates from public,anon,authenticated;
grant select on public.events,public.event_responses,public.event_updates to authenticated;
grant all on public.events,public.event_responses,public.event_updates to service_role;

create function private.can_see_event(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.member() and exists(
    select 1 from public.events e
    where e.id=target and not private.blocked(e.organizer_id) and (
      e.organizer_id=(select auth.uid())
      or (e.circle_id is not null and private.in_circle(e.circle_id))
      or (e.circle_id is null and exists(
        select 1 from public.follows f
        where f.follower_id=(select auth.uid()) and f.following_id=e.organizer_id and f.accepted
      ))
    )
  )
$$;

create policy events_read on public.events for select to authenticated using(private.can_see_event(id));
create policy event_responses_read on public.event_responses for select to authenticated
using(private.can_see_event(event_id) and not private.blocked(user_id));
create policy event_updates_read on public.event_updates for select to authenticated
using(private.can_see_event(event_id) and not private.blocked(author_id));

create function public.create_event(
  event_title text,
  event_description text,
  event_location text,
  event_starts_at timestamptz,
  event_ends_at timestamptz default null,
  event_circle uuid default null,
  event_capacity integer default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare new_event uuid;
begin
  perform private.throttle('event_manage',20);
  if event_title is null or length(trim(event_title)) not between 1 and 100
    or event_description is null or length(event_description)>1200
    or event_location is null or length(event_location)>160
    or event_starts_at<now()-interval '5 minutes'
    or (event_ends_at is not null and event_ends_at<=event_starts_at)
    or (event_capacity is not null and event_capacity not between 2 and 100)
    or (event_circle is not null and not private.in_circle(event_circle)) then
    raise exception 'Dati dell''evento non validi';
  end if;
  insert into public.events(organizer_id,circle_id,title,description,location,starts_at,ends_at,capacity)
  values(auth.uid(),event_circle,trim(event_title),trim(event_description),trim(event_location),event_starts_at,event_ends_at,event_capacity)
  returning id into new_event;
  insert into public.event_responses(event_id,user_id,response) values(new_event,auth.uid(),'going');
  return new_event;
end $$;

create function public.respond_event(target_event uuid,next_response text) returns void
language plpgsql security definer set search_path='' as $$
declare target public.events; going_count integer;
begin
  perform private.throttle('event_response',60);
  if next_response not in('going','maybe','declined') or not private.can_see_event(target_event) then
    raise exception 'Evento non disponibile';
  end if;
  select * into target from public.events where id=target_event for update;
  if target.cancelled_at is not null or target.starts_at<now()-interval '12 hours' then
    raise exception 'Le risposte sono chiuse';
  end if;
  if next_response='going' and target.capacity is not null then
    select count(*) into going_count from public.event_responses
    where event_id=target_event and response='going' and user_id<>auth.uid();
    if going_count>=target.capacity then raise exception 'Non ci sono più posti disponibili'; end if;
  end if;
  insert into public.event_responses(event_id,user_id,response,updated_at)
  values(target_event,auth.uid(),next_response,now())
  on conflict(event_id,user_id) do update set response=excluded.response,updated_at=now();
end $$;

create function public.cancel_event(target_event uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.throttle('event_manage',20);
  update public.events set cancelled_at=coalesce(cancelled_at,now()),updated_at=now()
  where id=target_event and organizer_id=auth.uid();
  if not found then raise exception 'Accesso negato'; end if;
  insert into public.notifications(user_id,actor_id,kind,event_id)
  select r.user_id,auth.uid(),'event_cancelled',target_event
  from public.event_responses r
  where r.event_id=target_event and r.user_id<>auth.uid() and r.response in('going','maybe');
end $$;

create function public.create_event_update(target_event uuid,update_kind text,update_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare target public.events; new_update uuid;
begin
  perform private.throttle('event_update',60);
  select * into target from public.events where id=target_event;
  if not found or not private.can_see_event(target_event) or target.cancelled_at is not null
    or update_kind not in('comment','update') or length(trim(update_body)) not between 1 and 1200
    or (update_kind='update' and target.organizer_id<>auth.uid()) then
    raise exception 'Aggiornamento non disponibile';
  end if;
  insert into public.event_updates(event_id,author_id,kind,body)
  values(target_event,auth.uid(),update_kind,trim(update_body)) returning id into new_update;
  if update_kind='update' then
    insert into public.notifications(user_id,actor_id,kind,event_id)
    select r.user_id,auth.uid(),'event_update',target_event
    from public.event_responses r
    where r.event_id=target_event and r.user_id<>auth.uid() and r.response in('going','maybe');
  end if;
  return new_update;
end $$;

revoke all on function private.can_see_event(uuid) from public,anon;
grant execute on function private.can_see_event(uuid) to authenticated;
revoke all on function public.create_event(text,text,text,timestamptz,timestamptz,uuid,integer),public.respond_event(uuid,text),public.cancel_event(uuid) from public,anon;
grant execute on function public.create_event(text,text,text,timestamptz,timestamptz,uuid,integer),public.respond_event(uuid,text),public.cancel_event(uuid) to authenticated;
revoke all on function public.create_event_update(uuid,text,text) from public,anon;
grant execute on function public.create_event_update(uuid,text,text) to authenticated;
