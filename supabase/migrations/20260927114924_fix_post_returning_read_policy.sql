-- INSERT ... RETURNING checks SELECT RLS on the new row. The existing
-- private.can_see_post(id) helper queries posts through a STABLE function and
-- cannot see that row in the INSERT statement's snapshot. Allow the author
-- directly while preserving the expiration condition for their own posts.
drop policy if exists posts_read on public.posts;

create policy posts_read
on public.posts
for select
to authenticated
using (
  private.member()
  and (
    (
      author_id = (select auth.uid())
      and (expires_at is null or expires_at > now())
    )
    or private.can_see_post(id)
    or private.admin()
  )
);
