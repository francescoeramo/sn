alter table public.moderation_audit drop constraint moderation_audit_action_check;
alter table public.moderation_audit drop constraint moderation_audit_target_type_check;
alter table public.moderation_audit
  add constraint moderation_audit_action_check check(action in(
    'report_dismissed','post_removed','note_approved','note_rejected',
    'account_suspended','account_restored'
  )),
  add constraint moderation_audit_target_type_check check(target_type in(
    'report','post','community_note','account'
  ));

create function public.moderation_accounts()
returns table(id uuid,username text,display_name text,disabled boolean,is_admin boolean,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.member() or not private.admin() then
    raise exception 'Accesso negato';
  end if;
  return query
    select p.id,p.username,p.display_name,p.disabled,
      exists(select 1 from private.admins a where a.user_id=p.id),p.created_at
    from public.profiles p
    order by p.created_at,p.id;
end $$;

create function public.set_account_disabled(target uuid,next_disabled boolean)
returns void language plpgsql security definer set search_path='' as $$
declare current_state boolean;
begin
  if auth.uid() is null or not private.member() or not private.admin() or target=auth.uid()
    or exists(select 1 from private.admins where user_id=target) then
    raise exception 'Accesso negato';
  end if;
  select disabled into current_state from public.profiles where id=target for update;
  if not found then raise exception 'Account non disponibile'; end if;
  if current_state=next_disabled then raise exception 'Stato account già aggiornato'; end if;
  update public.profiles set disabled=next_disabled where id=target;
  insert into public.moderation_audit(moderator_id,action,target_type,target_id)
    values(auth.uid(),case when next_disabled then 'account_suspended' else 'account_restored' end,'account',target);
end $$;

revoke all on function public.moderation_accounts(),public.set_account_disabled(uuid,boolean) from public,anon;
grant execute on function public.moderation_accounts(),public.set_account_disabled(uuid,boolean) to authenticated;
