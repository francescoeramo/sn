-- Restore the author-bound write policy used by the application API.
-- The explicit column grant keeps the database boundary narrow.
drop policy if exists posts_add on public.posts;

create policy posts_add
on public.posts
for insert
to authenticated
with check (
  private.member()
  and author_id = (select auth.uid())
);

grant insert(author_id,body,content_warning,kind,media_path,alt)
on public.posts
to authenticated;
