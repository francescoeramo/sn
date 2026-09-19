create function private.federation_queue_ready() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if new.target_url is not null then new.status := 'pending'; end if;
  return new;
end $$;
create trigger sn_federation_queue_ready before insert on private.federation_queue
for each row execute function private.federation_queue_ready();
update private.federation_queue set status='pending' where status='paused' and target_url is not null;

create function public.claim_federation_deliveries(batch_size integer default 4)
returns table(queue_id uuid,activity_id text,actor_id uuid,target_url text,payload jsonb,attempts integer)
language plpgsql security definer set search_path=''
as $$
begin
  if batch_size not between 1 and 10 then raise exception 'Dimensione batch non valida'; end if;
  update private.federation_queue q set status='failed'
  where q.status='pending' and exists(
    select 1 from private.blocked_instances b where b.hostname=q.target_host
  );
  return query
  with candidates as (
    select q.id from private.federation_queue q
    where q.status='pending' and q.available_at<=now()
    order by q.available_at,q.id
    limit batch_size for update skip locked
  )
  update private.federation_queue q
  set attempts=q.attempts+1,available_at=now()+interval '2 minutes'
  from candidates c where q.id=c.id
  returning q.id,q.activity_id,q.actor_id,q.target_url,q.payload,q.attempts;
end $$;

create function public.complete_federation_delivery(
  target_queue uuid,
  outcome text,
  retry_at timestamptz default null
) returns void
language plpgsql security definer set search_path=''
as $$
begin
  if outcome not in ('delivered','retry','failed') then raise exception 'Esito non valido'; end if;
  update private.federation_queue
  set status=case when outcome='retry' then 'pending' else outcome end,
      available_at=case when outcome='retry' then coalesce(retry_at,now()+interval '5 minutes') else available_at end
  where id=target_queue and status='pending';
  if not found then raise exception 'Consegna non disponibile'; end if;
end $$;

revoke all on function public.claim_federation_deliveries(integer),public.complete_federation_delivery(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_federation_deliveries(integer),public.complete_federation_delivery(uuid,text,timestamptz) to service_role;
