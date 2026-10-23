-- Platform-installed event trigger: never an application RPC.
-- Keep its owner and event trigger intact; only remove client EXECUTE grants.
-- Local/test databases may not have this platform function.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
