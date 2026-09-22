alter table private.blocked_instances
  add column blocked_by uuid references public.profiles(id) on delete set null,
  add column created_at timestamptz not null default now(),
  add constraint blocked_instances_hostname_length check(length(hostname) between 1 and 253),
  add constraint blocked_instances_reason_length check(length(trim(reason)) between 10 and 500);

alter table public.moderation_audit
  alter column target_id type text using target_id::text;
alter table public.moderation_audit drop constraint moderation_audit_action_check;
alter table public.moderation_audit drop constraint moderation_audit_target_type_check;
alter table public.moderation_audit
  add constraint moderation_audit_action_check check(action in(
    'report_dismissed','post_removed','note_approved','note_rejected',
    'account_suspended','account_restored','remote_report_dismissed','remote_object_hidden',
    'instance_blocked','instance_unblocked'
  )),
  add constraint moderation_audit_target_type_check check(target_type in(
    'report','post','community_note','account','remote_report','instance'
  ));

create function public.federation_blocked_instances()
returns table(hostname text,reason text,blocked_by uuid,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.member() or not private.admin() then
    raise exception 'Accesso negato';
  end if;
  return query select b.hostname,b.reason,b.blocked_by,b.created_at
    from private.blocked_instances b order by b.created_at desc,b.hostname;
end $$;

create function public.set_federation_instance_blocked(
  candidate text,next_blocked boolean,decision_reason text
) returns void language plpgsql security definer set search_path='' as $$
declare normalized text := lower(trim(trailing '.' from trim(candidate)));
begin
  if auth.uid() is null or not private.member() or not private.admin() then
    raise exception 'Accesso negato';
  end if;
  if normalized !~ '^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' then
    raise exception 'Inserisci un hostname valido';
  end if;
  if decision_reason is null or length(trim(decision_reason)) not between 10 and 500 then
    raise exception 'Motiva la decisione (10-500 caratteri)';
  end if;
  if next_blocked then
    insert into private.blocked_instances(hostname,reason,blocked_by)
      values(normalized,trim(decision_reason),auth.uid());
  else
    delete from private.blocked_instances where hostname=normalized;
    if not found then raise exception 'Istanza non bloccata'; end if;
  end if;
  insert into public.moderation_audit(moderator_id,action,target_type,target_id,reason)
    values(
      auth.uid(),case when next_blocked then 'instance_blocked' else 'instance_unblocked' end,
      'instance',normalized,trim(decision_reason)
    );
exception when unique_violation then
  raise exception 'Istanza già bloccata';
end $$;

revoke all on function public.federation_blocked_instances(),public.set_federation_instance_blocked(text,boolean,text)
  from public,anon;
grant execute on function public.federation_blocked_instances(),public.set_federation_instance_blocked(text,boolean,text)
  to authenticated;
