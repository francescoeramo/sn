-- Digest scelto dall'utente: preferenze, sorgenti e consegne.
-- Generazione lato server nel rispetto di RLS, blocchi, scadenze e visibilita'.
-- Nessuna cronologia delle aperture: le tabelle conservano solo preferenze e ultimo invio.

create table public.digest_preferences (
  user_id uuid primary key references public.profiles on delete cascade,
  enabled boolean not null default false,
  frequency text not null default 'weekly' check(frequency in('daily','weekly')),
  time_slot smallint not null default 8 check(time_slot between 0 and 23),
  timezone text not null default 'Europe/Rome' check(timezone in('Europe/Rome','UTC')),
  channel text not null default 'in_app' check(channel in('in_app','email')),
  email_consent boolean not null default false,
  email_consent_at timestamptz,
  updated_at timestamptz not null default now(),
  check(channel<>'email' or email_consent),
  check((email_consent and email_consent_at is not null) or (not email_consent and email_consent_at is null))
);

create table public.digest_sources (
  user_id uuid not null references public.profiles on delete cascade,
  source_type text not null check(source_type in('circle','person','topic')),
  source_id text not null check(length(source_id) between 1 and 120),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(user_id,source_type,source_id)
);

create table public.digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  period_key text not null check(length(period_key) between 1 and 32),
  items jsonb not null default '[]'::jsonb check(jsonb_typeof(items)='array'),
  status text not null default 'generated' check(status in('generated','delivered','failed')),
  generated_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique(user_id,period_key)
);

create index digest_deliveries_user_created on public.digest_deliveries(user_id,generated_at desc);
create index digest_sources_user on public.digest_sources(user_id,source_type);

alter table public.digest_preferences enable row level security;
alter table public.digest_sources enable row level security;
alter table public.digest_deliveries enable row level security;

revoke all on public.digest_preferences,public.digest_sources,public.digest_deliveries from public,anon,authenticated;
grant select on public.digest_preferences,public.digest_sources,public.digest_deliveries to authenticated;
grant insert,update,delete on public.digest_preferences,public.digest_sources to authenticated;
grant all on public.digest_preferences,public.digest_sources,public.digest_deliveries to service_role;

create policy digest_preferences_read on public.digest_preferences for select to authenticated
using(user_id=(select auth.uid()));
create policy digest_preferences_add on public.digest_preferences for insert to authenticated
with check(user_id=(select auth.uid()));
create policy digest_preferences_update on public.digest_preferences for update to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy digest_preferences_remove on public.digest_preferences for delete to authenticated
using(user_id=(select auth.uid()));

create policy digest_sources_read on public.digest_sources for select to authenticated
using(user_id=(select auth.uid()));
create policy digest_sources_add on public.digest_sources for insert to authenticated
with check(user_id=(select auth.uid()));
create policy digest_sources_update on public.digest_sources for update to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy digest_sources_remove on public.digest_sources for delete to authenticated
using(user_id=(select auth.uid()));

-- Le consegne si leggono soltanto; le scrive la funzione di generazione.
create policy digest_deliveries_read on public.digest_deliveries for select to authenticated
using(user_id=(select auth.uid()));

-- Generazione idempotente per periodo: la chiave (user_id,period_key) impedisce duplicati.
-- La selezione riusa private.can_see_post, quindi rispetta privacy, blocchi, scadenze e cerchie.
create function public.digest_refresh() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  target uuid := (select auth.uid());
  pref_enabled boolean;
  pref_frequency text;
  pref_timezone text;
  period text;
  window_start timestamptz;
  seen uuid[] := '{}';
  result jsonb := '[]'::jsonb;
  item_count integer := 0;
  candidate record;
begin
  if not private.member() then raise exception 'Accesso negato'; end if;
  select enabled,frequency,timezone into pref_enabled,pref_frequency,pref_timezone
    from public.digest_preferences where user_id=target;
  if pref_enabled is null or not pref_enabled then raise exception 'Digest non attivo'; end if;
  period := case when pref_frequency='weekly'
    then to_char(now() at time zone pref_timezone,'IYYY-"W"IW')
    else to_char(now() at time zone pref_timezone,'YYYY-MM-DD') end;
  window_start := case when pref_frequency='weekly'
    then now()-interval '7 days' else now()-interval '1 day' end;

  select coalesce(array_agg(distinct (entry->>'post_id')::uuid),'{}') into seen
  from public.digest_deliveries d, jsonb_array_elements(d.items) entry
  where d.user_id=target and d.period_key<>period;

  for candidate in
    select p.id, p.created_at, ranked.priority, ranked.reason
    from (
      select cp.post_id as post_id, 1 as priority, 'Cerchia '||c.name as reason
      from public.digest_sources s
      join public.circles c on c.id::text=s.source_id
      join public.circle_posts cp on cp.circle_id=c.id
      where s.user_id=target and s.enabled and s.source_type='circle'
      union all
      select p2.id, 2, 'Da '||pr.display_name
      from public.digest_sources s
      join public.profiles pr on pr.id::text=s.source_id
      join public.posts p2 on p2.author_id=pr.id
      where s.user_id=target and s.enabled and s.source_type='person'
      union all
      select p3.id, 3, 'Argomento '||s.source_id
      from public.digest_sources s
      join public.posts p3 on p3.body ilike '%'||s.source_id||'%'
      where s.user_id=target and s.enabled and s.source_type='topic'
      union all
      select p4.id, 4, 'Da '||pr.display_name
      from public.follows f
      join public.profiles pr on pr.id=f.following_id
      join public.posts p4 on p4.author_id=pr.id
      where f.follower_id=target and f.accepted
    ) ranked
    join public.posts p on p.id=ranked.post_id
    where p.created_at>=window_start
      and p.kind='post'
      and private.can_see_post(p.id)
    order by ranked.priority, p.created_at desc
  loop
    if candidate.id = any(seen) then continue; end if;
    seen := seen || candidate.id;
    result := result || jsonb_build_array(jsonb_build_object(
      'post_id',candidate.id,'reason',candidate.reason,'priority',candidate.priority));
    item_count := item_count+1;
    exit when item_count>=5;
  end loop;

  insert into public.digest_deliveries(user_id,period_key,items,status,generated_at,delivered_at)
  values(target,period,result,'delivered',now(),now())
  on conflict(user_id,period_key) do update
    set items=excluded.items,status='delivered',generated_at=now(),delivered_at=now();
  return result;
end $$;

revoke all on function public.digest_refresh() from public,anon;
grant execute on function public.digest_refresh() to authenticated,service_role;
