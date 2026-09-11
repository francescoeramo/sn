create table public.moderation_audit (
 id uuid primary key default gen_random_uuid(),
 moderator_id uuid references public.profiles on delete set null,
 action text not null check(action in('report_dismissed','post_removed','note_approved','note_rejected')),
 target_type text not null check(target_type in('report','post','community_note')),
 target_id uuid not null,
 created_at timestamptz not null default now()
);
create index moderation_audit_recent on public.moderation_audit(created_at desc);
alter table public.moderation_audit enable row level security;
revoke all on public.moderation_audit from public,anon,authenticated;
grant select on public.moderation_audit to authenticated;
grant all on public.moderation_audit to service_role;
create policy moderation_audit_read on public.moderation_audit for select to authenticated using(private.member() and private.admin());
drop policy if exists reports_edit on public.reports;
revoke update(status) on public.reports from authenticated;

create or replace function public.review_community_note(note_id uuid, approve boolean, reason text) returns void language plpgsql security definer set search_path='' as $$
declare note public.community_notes;
begin
 if auth.uid() is null or not private.member() or not private.admin() then raise exception 'Accesso negato'; end if;
 if approve is null or reason is null or length(trim(reason)) not between 10 and 500 then raise exception 'Motiva la decisione (10-500 caratteri)'; end if;
 select * into note from public.community_notes where id=note_id for update;
 if not found or note.status<>'pending' then raise exception 'Nota già esaminata o non disponibile'; end if;
 update public.community_notes set status=case when approve then 'approved' else 'rejected' end,review_reason=trim(reason),reviewed_by=auth.uid(),reviewed_at=now() where id=note_id;
 insert into public.notifications(user_id,actor_id,kind,post_id) values(note.author_id,auth.uid(),case when approve then 'note_approved' else 'note_rejected' end,note.post_id);
 insert into public.moderation_audit(moderator_id,action,target_type,target_id) values(auth.uid(),case when approve then 'note_approved' else 'note_rejected' end,'community_note',note_id);
end $$;

create function public.moderate_report(report_id uuid, remove_post boolean) returns void language plpgsql security definer set search_path='' as $$
declare item public.reports; target uuid;
begin
 if auth.uid() is null or not private.member() or not private.admin() then raise exception 'Accesso negato'; end if;
 select * into item from public.reports where id=report_id for update;
 if not found or item.status<>'open' then raise exception 'Segnalazione già esaminata o non disponibile'; end if;
 if remove_post and item.post_id is null then raise exception 'Post non disponibile'; end if;
 if remove_post and item.post_id is not null then
   target:=item.post_id;
   delete from public.posts where id=item.post_id;
 else target:=item.id;
 end if;
 update public.reports set status=case when remove_post then 'removed' else 'dismissed' end where id=report_id;
 insert into public.moderation_audit(moderator_id,action,target_type,target_id) values(auth.uid(),case when remove_post then 'post_removed' else 'report_dismissed' end,case when remove_post then 'post' else 'report' end,target);
end $$;
revoke all on function public.moderate_report(uuid,boolean) from public,anon;
grant execute on function public.moderate_report(uuid,boolean) to authenticated;
