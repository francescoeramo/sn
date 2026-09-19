alter table private.federation_queue drop constraint if exists federation_queue_activity_id_key;
alter table private.federation_queue
  add constraint federation_queue_activity_target_unique unique(activity_id,target_url);

create function public.enqueue_federated_activity(
  target_actor uuid,
  outgoing_id text,
  outgoing jsonb
) returns integer
language plpgsql security definer set search_path=''
as $$
declare inserted integer;
begin
  if outgoing_id !~ '^https://' or outgoing->>'id'<>outgoing_id then
    raise exception 'Attività in uscita non valida';
  end if;
  if not exists(
    select 1 from public.profiles
    where id=target_actor and federation_enabled and not is_private and not disabled
  ) then return 0; end if;
  insert into private.federation_queue(activity_id,actor_id,target_host,target_url,payload,status)
  select outgoing_id,target_actor,
    lower(split_part(split_part(f.remote_inbox,'://',2),'/',1)),
    f.remote_inbox,outgoing,'paused'
  from public.federation_remote_follows f
  where f.local_actor_id=target_actor
    and not exists(
      select 1 from private.blocked_instances b
      where b.hostname=lower(split_part(split_part(f.remote_inbox,'://',2),'/',1))
    )
  on conflict(activity_id,target_url) do nothing;
  get diagnostics inserted=row_count;
  return inserted;
end $$;

revoke all on function public.enqueue_federated_activity(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.enqueue_federated_activity(uuid,text,jsonb) to service_role;
