-- Content warnings are presentation preferences, never authorization boundaries.
alter table public.posts add column content_warning text not null default ''
  check (char_length(content_warning) <= 160);
grant insert(content_warning) on public.posts to authenticated;

create table public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index bookmarks_post on public.bookmarks(post_id);
create index bookmarks_saved_order on public.bookmarks(user_id, created_at desc, post_id desc);
alter table public.bookmarks enable row level security;
revoke all on public.bookmarks from public, anon, authenticated;
grant select, delete on public.bookmarks to authenticated;
grant insert(user_id, post_id) on public.bookmarks to authenticated;
grant all on public.bookmarks to service_role;

-- Even moderators only see their own collection; saving never preserves revoked access.
create policy bookmarks_read on public.bookmarks for select to authenticated
  using (user_id = (select auth.uid()) and private.can_see_post(post_id));
create policy bookmarks_add on public.bookmarks for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_see_post(post_id)
    and exists (select 1 from public.posts where id = post_id and kind <> 'story'));
create policy bookmarks_remove on public.bookmarks for delete to authenticated
  using (user_id = (select auth.uid()) and private.member());
-- Use the existing per-member hourly throttle; do not send notifications for bookmarks.
create trigger sn_bookmark_limit before insert on public.bookmarks
  for each row execute function private.write_guard();
