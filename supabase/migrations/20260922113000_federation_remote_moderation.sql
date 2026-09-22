alter table public.federation_remote_objects
  add column hidden_at timestamptz,
  add column hidden_by uuid references public.profiles(id) on delete set null;

create table public.federation_remote_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  object_id text not null check(object_id ~ '^https://'),
  remote_actor text not null check(remote_actor ~ '^https://'),
  reason text not null check(length(trim(reason)) between 5 and 1000),
  status text not null default 'open' check(status in ('open','dismissed','hidden')),
  created_at timestamptz not null default now(),
  unique(reporter_id,object_id)
);

create index federation_remote_reports_open_idx
  on public.federation_remote_reports(created_at desc)
  where status='open';

alter table public.federation_remote_reports enable row level security;
revoke all on public.federation_remote_reports from public,anon,authenticated;
grant select on public.federation_remote_reports to authenticated;
grant all on public.federation_remote_reports to service_role;
create policy federation_remote_reports_read on public.federation_remote_reports
  for select to authenticated
  using(private.member() and (reporter_id=(select auth.uid()) or private.admin()));

alter table public.moderation_audit drop constraint moderation_audit_action_check;
alter table public.moderation_audit drop constraint moderation_audit_target_type_check;
alter table public.moderation_audit
  add constraint moderation_audit_action_check check(action in(
    'report_dismissed','post_removed','note_approved','note_rejected',
    'account_suspended','account_restored','remote_report_dismissed','remote_object_hidden'
  )),
  add constraint moderation_audit_target_type_check check(target_type in(
    'report','post','community_note','account','remote_report'
  ));

create function public.report_federated_object(target_object text,report_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor text;
begin
  if auth.uid() is null or not private.member() then raise exception 'Accesso negato'; end if;
  if report_reason is null or length(trim(report_reason)) not between 5 and 1000 then
    raise exception 'Descrivi il problema in 5-1000 caratteri';
  end if;
  select remote_actor into actor
  from public.federation_remote_objects
  where local_actor_id=auth.uid() and object_id=target_object
    and deleted_at is null and hidden_at is null;
  if not found then raise exception 'Contenuto federato non disponibile'; end if;
  insert into public.federation_remote_reports(reporter_id,object_id,remote_actor,reason)
    values(auth.uid(),target_object,actor,trim(report_reason))
    on conflict(reporter_id,object_id) do update
      set reason=excluded.reason,status='open',created_at=now()
      where federation_remote_reports.status='dismissed';
  if not found then raise exception 'Hai già segnalato questo contenuto'; end if;
end $$;

create function public.moderate_federated_report(target_report uuid,hide_object boolean)
returns void language plpgsql security definer set search_path='' as $$
declare item public.federation_remote_reports;
begin
  if auth.uid() is null or not private.member() or not private.admin() then
    raise exception 'Accesso negato';
  end if;
  select * into item from public.federation_remote_reports
    where id=target_report for update;
  if not found or item.status<>'open' then
    raise exception 'Segnalazione già esaminata o non disponibile';
  end if;
  if hide_object then
    update public.federation_remote_objects
      set hidden_at=now(),hidden_by=auth.uid()
      where object_id=item.object_id and deleted_at is null and hidden_at is null;
    if not found then raise exception 'Contenuto federato non disponibile'; end if;
  end if;
  update public.federation_remote_reports
    set status=case when hide_object then 'hidden' else 'dismissed' end
    where case when hide_object then federation_remote_reports.object_id=item.object_id else id=target_report end
      and status='open';
  insert into public.moderation_audit(moderator_id,action,target_type,target_id)
    values(
      auth.uid(),
      case when hide_object then 'remote_object_hidden' else 'remote_report_dismissed' end,
      'remote_report',target_report
    );
end $$;

revoke all on function public.report_federated_object(text,text),public.moderate_federated_report(uuid,boolean)
  from public,anon;
grant execute on function public.report_federated_object(text,text),public.moderate_federated_report(uuid,boolean)
  to authenticated;
