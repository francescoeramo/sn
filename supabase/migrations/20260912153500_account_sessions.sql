create function public.my_sessions()
returns table(id uuid,created_at timestamptz,last_seen_at timestamptz,is_current boolean)
language sql security definer stable set search_path='' as $$
  select s.id,s.created_at,s.updated_at as last_seen_at,
    s.id=nullif(auth.jwt()->>'session_id','')::uuid as is_current
  from auth.sessions s
  where s.user_id=auth.uid()
  order by (s.id=nullif(auth.jwt()->>'session_id','')::uuid) desc,s.updated_at desc;
$$;
revoke all on function public.my_sessions() from public,anon;
grant execute on function public.my_sessions() to authenticated;

create function public.revoke_my_session(target_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare current_id uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
begin
  if auth.uid() is null then raise exception 'Accesso negato'; end if;
  if target_id is null or target_id=current_id then
    raise exception 'La sessione corrente non può essere terminata da qui';
  end if;
  delete from auth.sessions where id=target_id and user_id=auth.uid();
  if not found then raise exception 'Sessione non disponibile'; end if;
end $$;
revoke all on function public.revoke_my_session(uuid) from public,anon;
grant execute on function public.revoke_my_session(uuid) to authenticated;
