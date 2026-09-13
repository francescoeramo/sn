create table public.chat_group_messages (
 id uuid primary key, group_id uuid not null references public.chat_groups on delete cascade,
 sender_id uuid not null references public.profiles on delete cascade, encrypted jsonb not null,
 created_at timestamptz not null default now()
);
create index chat_group_messages_group on public.chat_group_messages(group_id,created_at desc,id);
create table public.chat_group_message_receipts (
 message_id uuid not null references public.chat_group_messages on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 delivered_at timestamptz, read_at timestamptz, primary key(message_id,user_id)
);
create index chat_group_receipts_user on public.chat_group_message_receipts(user_id,message_id);
alter table public.chat_group_messages enable row level security;
alter table public.chat_group_message_receipts enable row level security;
revoke all on public.chat_group_messages,public.chat_group_message_receipts from public,anon,authenticated;
grant select on public.chat_group_messages,public.chat_group_message_receipts to authenticated;
grant insert(id,group_id,sender_id,encrypted) on public.chat_group_messages to authenticated;
grant all on public.chat_group_messages,public.chat_group_message_receipts to service_role;
create policy group_messages_read on public.chat_group_messages for select to authenticated using(private.in_chat_group(group_id));
create policy group_messages_add on public.chat_group_messages for insert to authenticated with check(private.in_chat_group(group_id) and sender_id=(select auth.uid()));
create policy group_receipts_read on public.chat_group_message_receipts for select to authenticated using(
 user_id=(select auth.uid()) or exists(select 1 from public.chat_group_messages m where m.id=message_id and m.sender_id=(select auth.uid()))
);

create or replace function private.shares_chat_group(other uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.member() and exists(
  select 1 from public.chat_group_members mine join public.chat_group_members theirs using(group_id)
  where mine.user_id=auth.uid() and theirs.user_id=other
 )
$$;
drop policy device_read on public.chat_devices;
create policy device_read on public.chat_devices for select to authenticated using(
 private.member() and (user_id=(select auth.uid()) or private.can_message(user_id) or private.shares_chat_group(user_id))
);

create function private.group_message_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare context jsonb; device public.chat_devices; target record; members text[]; packet_members text[]; packet_count integer; distinct_count integer;
begin
 perform private.throttle('messages',120);
 if new.sender_id<>auth.uid() or not private.in_chat_group(new.group_id) then raise exception 'Accesso negato'; end if;
 if new.encrypted->>'version'<>'2' or octet_length(new.encrypted::text)>50000 then raise exception 'La chat richiede cifratura end-to-end'; end if;
 context:=new.encrypted->'context';
 if context is null or context->>'id' is distinct from new.id::text or context->>'sender_id' is distinct from new.sender_id::text or context->>'group_id' is distinct from new.group_id::text or context->'expires_at'<>'null'::jsonb or coalesce((context->>'revision')::integer,0)<>0 then raise exception 'Contesto cifrato non valido'; end if;
 if jsonb_typeof(context->'recipient_ids') is distinct from 'array' or jsonb_typeof(new.encrypted->'keys') is distinct from 'object' then raise exception 'Chiavi mancanti'; end if;
 select coalesce(array_agg(user_id::text order by user_id::text),array[]::text[]) into members from public.chat_group_members where group_id=new.group_id;
 select coalesce(array_agg(value order by value),array[]::text[]),count(*),count(distinct value) into packet_members,packet_count,distinct_count from jsonb_array_elements_text(context->'recipient_ids');
 if packet_members is distinct from members or packet_count<>distinct_count then raise exception 'Elenco partecipanti cambiato: riprova'; end if;
 select * into device from public.chat_devices where id=(new.encrypted->'sender'->>'id')::uuid and user_id=auth.uid();
 if not found or device.public_key is distinct from new.encrypted->'sender'->'public_key' then raise exception 'Dispositivo non autorizzato'; end if;
 if exists(select 1 from public.chat_group_members m where m.group_id=new.group_id and not exists(select 1 from public.chat_devices d where d.user_id=m.user_id)) then raise exception 'Ogni membro deve aprire prima una chat'; end if;
 for target in select d.id from public.chat_devices d join public.chat_group_members m on m.user_id=d.user_id where m.group_id=new.group_id loop
  if not (new.encrypted->'keys' ? target.id::text) then raise exception 'Elenco dispositivi cambiato: riprova'; end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(new.encrypted->'keys') k where not exists(select 1 from public.chat_devices d join public.chat_group_members m on m.user_id=d.user_id where d.id::text=k and m.group_id=new.group_id)) then raise exception 'Dispositivo estraneo'; end if;
 new.created_at:=now(); return new;
end $$;
revoke all on function private.group_message_guard() from public,anon,authenticated;
create trigger sn_group_message_guard before insert on public.chat_group_messages for each row execute function private.group_message_guard();

create function private.create_group_receipts() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.chat_group_message_receipts(message_id,user_id)
 select new.id,user_id from public.chat_group_members where group_id=new.group_id and user_id<>new.sender_id;
 return null;
end $$;
revoke all on function private.create_group_receipts() from public,anon,authenticated;
create trigger sn_group_message_receipts after insert on public.chat_group_messages for each row execute function private.create_group_receipts();

create function public.acknowledge_group_message(target_message uuid, mark_read boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.throttle('message_receipts',600);
 update public.chat_group_message_receipts set delivered_at=coalesce(delivered_at,now()),read_at=case when mark_read then coalesce(read_at,now()) else read_at end where message_id=target_message and user_id=auth.uid();
 if not found then raise exception 'Messaggio non disponibile'; end if;
end $$;
revoke all on function public.acknowledge_group_message(uuid,boolean) from public,anon;
grant execute on function public.acknowledge_group_message(uuid,boolean) to authenticated;
