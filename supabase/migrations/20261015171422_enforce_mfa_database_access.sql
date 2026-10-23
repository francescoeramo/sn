-- Enforce opt-in MFA in the database, including SECURITY DEFINER RPCs.
-- The caller cannot edit auth.mfa_factors or the signed JWT assurance claim.
create or replace function private.member() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and exists(select 1 from public.profiles
      where id=auth.uid() and not disabled and (banned_until is null or banned_until<=now()))
    and (
      coalesce(auth.jwt()->>'aal','aal1')='aal2'
      or not exists(select 1 from auth.mfa_factors
        where user_id=auth.uid() and status='verified')
    )
$$;

-- Allow only the caller's active profile before MFA: used by the existing
-- web/native MFA challenge endpoints. All profile mutations still require member().
alter policy profiles_read on public.profiles using(
  (private.member() or id=(select auth.uid()))
  and not disabled and (banned_until is null or banned_until<=now())
  and not private.blocked(id)
);

-- Ownership-only policies on preferences/receipts also need the shared account
-- and MFA gate. Restrictive policies AND with existing visibility/ownership rules.
do $$
declare target_table text;
begin
  foreach target_table in array array[
    'chat_group_message_receipts','digest_preferences','digest_sources','digest_deliveries',
    'reactions','mention_preferences','mentions','shares','explore_preferences'
  ] loop
    execute format(
      'create policy account_mfa_required on public.%I as restrictive for all to authenticated using ((select private.member())) with check ((select private.member()))',
      target_table
    );
  end loop;
end $$;

create or replace function public.my_sessions()
returns table(id uuid,created_at timestamptz,last_seen_at timestamptz,is_current boolean)
language sql security definer stable set search_path='' as $$
  select s.id,s.created_at,s.updated_at as last_seen_at,
    s.id=nullif(auth.jwt()->>'session_id','')::uuid as is_current
  from auth.sessions s
  where s.user_id=auth.uid() and private.member()
  order by (s.id=nullif(auth.jwt()->>'session_id','')::uuid) desc,s.updated_at desc;
$$;

create or replace function public.revoke_my_session(target_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare current_id uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
begin
  if auth.uid() is null or not private.member() then raise exception 'Accesso negato'; end if;
  if target_id is null or target_id=current_id then
    raise exception 'La sessione corrente non può essere terminata da qui';
  end if;
  delete from auth.sessions where id=target_id and user_id=auth.uid();
  if not found then raise exception 'Sessione non disponibile'; end if;
end $$;

-- No grants are widened. Existing EXECUTE revocations and function owners remain.
-- Rollback: restore prior member()/session definitions and policies from preceding
-- migrations, retaining ban checks. This would reintroduce the MFA bypass.
