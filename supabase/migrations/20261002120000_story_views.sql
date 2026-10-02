-- Track story views without exposing the audience to anyone except the story author.
create table public.story_views (
  story_id uuid not null references public.posts(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(story_id, viewer_id)
);

create index story_views_viewer_time
on public.story_views(viewer_id, viewed_at desc);

create index story_views_story_time
on public.story_views(story_id, viewed_at desc);

alter table public.story_views enable row level security;
revoke all on public.story_views from anon, authenticated;

create policy story_views_read
on public.story_views
for select
to authenticated
using (
  private.member()
  and exists (
    select 1
    from public.posts p
    where p.id=story_id
      and p.kind='story'
      and p.expires_at>now()
      and (
        (
          viewer_id=(select auth.uid())
          and p.author_id<>(select auth.uid())
          and private.can_see_post(p.id)
        )
        or (
          p.author_id=(select auth.uid())
          and not private.blocked(viewer_id)
        )
      )
  )
);

create policy story_views_add
on public.story_views
for insert
to authenticated
with check (
  private.member()
  and viewer_id=(select auth.uid())
  and exists (
    select 1
    from public.posts p
    where p.id=story_id
      and p.kind='story'
      and p.author_id<>(select auth.uid())
      and private.can_see_post(p.id)
  )
);

grant select on public.story_views to authenticated;
grant insert(story_id, viewer_id) on public.story_views to authenticated;
