create table public.polls (
  post_id uuid primary key references public.posts on delete cascade,
  closes_at timestamptz
);
create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(post_id) on delete cascade,
  position smallint not null check(position between 0 and 3),
  body text not null check(length(trim(body)) between 1 and 100),
  unique(poll_id,position),unique(poll_id,id)
);
create table public.poll_votes (
  poll_id uuid not null references public.polls(post_id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key(poll_id,user_id),
  foreign key(poll_id,option_id) references public.poll_options(poll_id,id) on delete cascade
);
create index poll_options_order on public.poll_options(poll_id,position);
create index poll_votes_option on public.poll_votes(option_id);
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
revoke all on public.polls,public.poll_options,public.poll_votes from public,anon,authenticated;
grant select on public.polls,public.poll_options to authenticated;
grant all on public.polls,public.poll_options,public.poll_votes to service_role;
create policy polls_read on public.polls for select to authenticated using(private.can_see_post(post_id));
create policy poll_options_read on public.poll_options for select to authenticated using(private.can_see_post(poll_id));

create function public.create_poll(question text,warning text,options text[],duration_seconds integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare post_id uuid:=gen_random_uuid(); item text; position smallint:=0;
begin
  if not private.member() then raise exception 'Accesso negato'; end if;
  if question is null or length(trim(question)) not between 1 and 2200 then raise exception 'Scrivi la domanda'; end if;
  if warning is null or length(trim(warning))>160 then raise exception 'Avviso non valido'; end if;
  if coalesce(array_length(options,1),0) not between 2 and 4 then raise exception 'Scegli da 2 a 4 opzioni'; end if;
  if duration_seconds is not null and duration_seconds not in(3600,86400,259200,604800) then raise exception 'Durata non valida'; end if;
  if (select count(distinct lower(trim(value))) from unnest(options) value)<>array_length(options,1) then raise exception 'Le opzioni devono essere diverse'; end if;
  insert into public.posts(id,author_id,body,kind,content_warning) values(post_id,auth.uid(),trim(question),'post',trim(warning));
  insert into public.polls(post_id,closes_at) values(post_id,case when duration_seconds is null then null else now()+make_interval(secs=>duration_seconds) end);
  foreach item in array options loop
    if length(trim(item)) not between 1 and 100 then raise exception 'Opzione non valida'; end if;
    insert into public.poll_options(poll_id,position,body) values(post_id,position,trim(item));
    position:=position+1;
  end loop;
  return post_id;
end $$;

create function public.vote_poll(target_poll uuid,target_option uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not private.member() or not private.can_see_post(target_poll) then raise exception 'Accesso negato'; end if;
  if not exists(select 1 from public.polls where post_id=target_poll and (closes_at is null or closes_at>now())) then raise exception 'Sondaggio chiuso'; end if;
  if not exists(select 1 from public.poll_options where poll_id=target_poll and id=target_option) then raise exception 'Opzione non valida'; end if;
  insert into public.poll_votes(poll_id,option_id,user_id) values(target_poll,target_option,auth.uid());
exception when unique_violation then raise exception 'Hai già votato';
end $$;

create function public.poll_results(target_polls uuid[])
returns table(poll_id uuid,option_id uuid,votes bigint,selected boolean)
language sql security definer stable set search_path='' as $$
  select o.poll_id,o.id,count(v.user_id),coalesce(bool_or(v.user_id=auth.uid()),false)
  from public.poll_options o
  left join public.poll_votes v on v.poll_id=o.poll_id and v.option_id=o.id
  where o.poll_id=any(target_polls) and private.can_see_post(o.poll_id)
  group by o.poll_id,o.id;
$$;
revoke all on function public.create_poll(text,text,text[],integer),public.vote_poll(uuid,uuid),public.poll_results(uuid[]) from public,anon;
grant execute on function public.create_poll(text,text,text[],integer),public.vote_poll(uuid,uuid),public.poll_results(uuid[]) to authenticated;
