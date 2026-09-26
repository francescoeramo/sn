-- Scoperta intenzionale e salute del prodotto.
-- Solo percorsi espliciti e spiegabili; metriche aggregate e minimizzate,
-- senza identificativi utente, ranking o profili individuali.

create table public.explore_preferences (
  user_id uuid not null references public.profiles on delete cascade,
  section text not null check(section in('contacts','hashtags','people')),
  hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,section)
);

create table public.product_metrics_daily (
  day date not null,
  metric text not null check(metric in('onboarded_completed','followed_five','replies_received','circle_members','event_going','returning_7','returning_28')),
  bucket text not null default 'all',
  count integer not null default 0,
  computed_at timestamptz not null default now(),
  primary key(day,metric,bucket)
);

alter table public.explore_preferences enable row level security;
alter table public.product_metrics_daily enable row level security;
revoke all on public.explore_preferences,public.product_metrics_daily from public,anon,authenticated;
grant select,insert,update on public.explore_preferences to authenticated;
grant select on public.product_metrics_daily to authenticated;
grant all on public.explore_preferences,public.product_metrics_daily to service_role;

create policy explore_preferences_read on public.explore_preferences for select to authenticated
using(user_id=(select auth.uid()));
create policy explore_preferences_add on public.explore_preferences for insert to authenticated
with check(user_id=(select auth.uid()));
create policy explore_preferences_update on public.explore_preferences for update to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Solo i moderatori leggono gli aggregati; le metriche non contengono user_id.
create policy product_metrics_read on public.product_metrics_daily for select to authenticated
using(private.member() and private.admin());

-- Aggregati del giorno corrente. Nessun identificativo e nessun dato individuale.
create function public.refresh_product_metrics() returns void
language plpgsql security definer set search_path='' as $$
begin
  insert into public.product_metrics_daily(day,metric,bucket,count,computed_at)
  select current_date,'onboarded_completed','all',count(*),now() from public.profiles where onboarded_at is not null
  union all
  select current_date,'followed_five','all',count(*),now() from (
    select follower_id from public.follows where accepted group by follower_id having count(*)>=5) t
  union all
  select current_date,'replies_received','all',count(*),now() from public.comments c
    where exists(select 1 from public.posts p where p.id=c.post_id and p.author_id<>c.author_id)
  union all
  select current_date,'circle_members','active',count(*),now() from public.circle_members where status='active'
  union all
  select current_date,'event_going','going',count(*),now() from public.event_responses where response='going'
  union all
  select current_date,'returning_7','all',count(*),now() from (
    select user_id from auth.sessions group by user_id
    having max(updated_at)>now()-interval '7 days' and min(created_at)<now()-interval '7 days') t
  union all
  select current_date,'returning_28','all',count(*),now() from (
    select user_id from auth.sessions group by user_id
    having max(updated_at)>now()-interval '28 days' and min(created_at)<now()-interval '28 days') t
  on conflict(day,metric,bucket) do update set count=excluded.count,computed_at=now();
end $$;

revoke all on function public.refresh_product_metrics() from public,anon,authenticated;
grant execute on function public.refresh_product_metrics() to service_role;
