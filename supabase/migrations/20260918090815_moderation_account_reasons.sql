alter table public.moderation_audit
  add column reason text not null default '' check(length(reason)<=500);

drop function public.set_account_disabled(uuid,boolean);
create function public.set_account_disabled(target uuid,next_disabled boolean,decision_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare current_state boolean;
begin
  if auth.uid() is null or not private.member() or not private.admin() or target=auth.uid()
    or exists(select 1 from private.admins where user_id=target) then
    raise exception 'Accesso negato';
  end if;
  if decision_reason is null or length(trim(decision_reason)) not between 10 and 500 then
    raise exception 'Motiva la decisione (10-500 caratteri)';
  end if;
  select disabled into current_state from public.profiles where id=target for update;
  if not found then raise exception 'Account non disponibile'; end if;
  if current_state=next_disabled then raise exception 'Stato account già aggiornato'; end if;
  update public.profiles set disabled=next_disabled where id=target;
  insert into public.moderation_audit(moderator_id,action,target_type,target_id,reason)
    values(auth.uid(),case when next_disabled then 'account_suspended' else 'account_restored' end,'account',target,trim(decision_reason));
end $$;

revoke all on function public.set_account_disabled(uuid,boolean,text) from public,anon;
grant execute on function public.set_account_disabled(uuid,boolean,text) to authenticated;
