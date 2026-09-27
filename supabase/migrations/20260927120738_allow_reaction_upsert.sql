-- PostgREST's UPSERT updates every supplied column on conflict. Let members
-- change only their own reaction, while rechecking visibility of the target.
grant update(user_id,target_type,target_id,emoji) on public.reactions to authenticated;

create policy reactions_update on public.reactions for update to authenticated
using(user_id=(select auth.uid()))
with check(user_id=(select auth.uid()) and private.can_react(target_type,target_id));
