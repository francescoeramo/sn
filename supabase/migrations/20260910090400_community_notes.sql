create table public.community_notes (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts on delete cascade,
 author_id uuid not null references public.profiles on delete cascade,
 body text not null check(length(trim(body)) between 20 and 1200),
 sources text[] not null check(cardinality(sources) between 1 and 3 and array_ndims(sources)=1),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 review_reason text not null default '' check(length(review_reason)<=500),
 reviewed_by uuid references public.profiles on delete set null, reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create index notes_post on public.community_notes(post_id,status,created_at);
create index notes_author on public.community_notes(author_id);
create index notes_queue on public.community_notes(created_at) where status='pending';
create unique index notes_one_pending on public.community_notes(post_id,author_id) where status='pending';
alter table public.community_notes enable row level security;
revoke all on public.community_notes from public,anon,authenticated;
grant select on public.community_notes to authenticated;
grant insert(post_id,author_id,body,sources) on public.community_notes to authenticated;
grant all on public.community_notes to service_role;
create policy notes_read on public.community_notes for select to authenticated using(private.member() and (private.can_see_post(post_id) or private.admin()) and (status='approved' or author_id=(select auth.uid()) or private.admin()));
create policy notes_add on public.community_notes for insert to authenticated with check(private.member() and author_id=(select auth.uid()) and private.can_see_post(post_id));
create function private.note_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare source text;
begin
 if new.author_id<>auth.uid() or not private.member() or not private.can_see_post(new.post_id) then raise exception 'Accesso negato'; end if;
 perform private.throttle('community_notes',10);
 foreach source in array new.sources loop
  if source is null or length(source)>500 or source !~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]*(:[0-9]+)?([/?#][^[:space:]]*)?$' then raise exception 'Inserisci fonti HTTPS valide'; end if;
 end loop;
 new.created_at:=now();new.status:='pending';new.review_reason:='';new.reviewed_by:=null;new.reviewed_at:=null;
 return new;
end $$;
revoke all on function private.note_guard() from public,anon,authenticated;
create trigger sn_note_guard before insert on public.community_notes for each row execute function private.note_guard();
create function public.review_community_note(note_id uuid, approve boolean, reason text) returns void language plpgsql security definer set search_path='' as $$
declare note public.community_notes;
begin
 if auth.uid() is null or not private.member() or not private.admin() then raise exception 'Accesso negato'; end if;
 if approve is null or reason is null or length(trim(reason)) not between 10 and 500 then raise exception 'Motiva la decisione (10-500 caratteri)'; end if;
 select * into note from public.community_notes where id=note_id for update;
 if not found or note.status<>'pending' then raise exception 'Nota già esaminata o non disponibile'; end if;
 update public.community_notes set status=case when approve then 'approved' else 'rejected' end,review_reason=trim(reason),reviewed_by=auth.uid(),reviewed_at=now() where id=note_id;
 insert into public.notifications(user_id,actor_id,kind,post_id) values(note.author_id,auth.uid(),case when approve then 'note_approved' else 'note_rejected' end,note.post_id);
end $$;
revoke all on function public.review_community_note(uuid,boolean,text) from public,anon;
grant execute on function public.review_community_note(uuid,boolean,text) to authenticated;
