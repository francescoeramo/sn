-- Preserve the deployed visibility/ban behavior while applying profile blocking to
-- both nested projections. Compatible with the original and timed-ban RPC bodies.
do $$
declare definition text; patched text;
begin
  select pg_get_functiondef('public.profile_connections(uuid)'::regprocedure) into definition;
  patched := replace(definition,
    'where f.following_id=target and f.accepted',
    'where f.following_id=target and f.accepted and not private.blocked(p.id)');
  patched := replace(patched,
    'where f.follower_id=target and f.accepted',
    'where f.follower_id=target and f.accepted and not private.blocked(p.id)');
  if patched=definition then
    raise exception 'Unrecognized profile_connections definition; review before applying';
  end if;
  execute patched;
end $$;
-- Existing owner, SECURITY DEFINER search_path and EXECUTE grants are preserved.
-- Rollback would expose blocked profiles again; keep these predicates when restoring.
