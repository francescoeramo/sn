create table private.auth_rates (
  identifier_hash text not null check(identifier_hash ~ '^[0-9a-f]{64}$'),
  bucket text not null check(bucket in('login','signup','recover')),
  started_at timestamptz not null default now(),
  hits integer not null default 1,
  primary key(identifier_hash,bucket)
);
alter table private.auth_rates enable row level security;
revoke all on private.auth_rates from public,anon,authenticated;
grant all on private.auth_rates to service_role;

create function public.consume_auth_rate(rate_key text,rate_bucket text,max_hits integer,window_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare current_hits integer;
begin
  if rate_key !~ '^[0-9a-f]{64}$' or rate_bucket not in('login','signup','recover') or max_hits not between 1 and 20 or window_seconds not between 60 and 86400 then
    raise exception 'Parametri non validi';
  end if;
  delete from private.auth_rates where started_at<now()-interval '2 days';
  insert into private.auth_rates(identifier_hash,bucket) values(rate_key,rate_bucket)
  on conflict(identifier_hash,bucket) do update set
    hits=case when private.auth_rates.started_at<now()+make_interval(secs=>-window_seconds) then 1 else private.auth_rates.hits+1 end,
    started_at=case when private.auth_rates.started_at<now()+make_interval(secs=>-window_seconds) then now() else private.auth_rates.started_at end
  returning hits into current_hits;
  return current_hits<=max_hits;
end $$;
revoke all on function public.consume_auth_rate(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_auth_rate(text,text,integer,integer) to service_role;
