create index posts_body_full_text on public.posts using gin(to_tsvector('italian',body));
