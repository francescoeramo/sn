-- Metadata survives removal of device-only ciphertext, enabling receipts and revisions.
create table public.chat_settings (
 member_a uuid not null references public.profiles on delete cascade,
 member_b uuid not null references public.profiles on delete cascade,
 temporary boolean not null default false,
 duration integer not null default 86400 check(duration in(3600,10800,86400,172800,604800,2592000)),
 updated_at timestamptz not null default now(),
 changed_by uuid not null references public.profiles on delete cascade,
 primary key(member_a,member_b), check(member_a<member_b)
);
create table public.message_states (
 id uuid primary key, sender_id uuid not null references public.profiles on delete cascade,
 recipient_id uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null, expires_at timestamptz,
 revision integer not null default 0 check(revision>=0), packet_hash text,
 retention text not null default 'synced' check(retention in('synced','device')),
 delivered_at timestamptz, read_at timestamptz, edited_at timestamptz, deleted_at timestamptz
);
create index message_states_sender on public.message_states(sender_id,recipient_id,created_at);
create index message_states_recipient on public.message_states(recipient_id,sender_id,created_at);
create table public.hidden_messages (
 user_id uuid not null references public.profiles on delete cascade,
 message_id uuid not null references public.message_states on delete cascade,
 primary key(user_id,message_id)
);
create index hidden_messages_message on public.hidden_messages(message_id);
alter table public.chat_settings enable row level security;
alter table public.message_states enable row level security;
alter table public.hidden_messages enable row level security;
revoke all on public.chat_settings,public.message_states,public.hidden_messages from public,anon,authenticated;
grant select on public.chat_settings,public.message_states,public.hidden_messages to authenticated;
grant all on public.chat_settings,public.message_states,public.hidden_messages to service_role;
create policy settings_read on public.chat_settings for select to authenticated using(private.member() and (select auth.uid()) in(member_a,member_b));
create policy states_read on public.message_states for select to authenticated using(private.member() and (select auth.uid()) in(sender_id,recipient_id));
create policy hidden_read on public.hidden_messages for select to authenticated using(private.member() and user_id=(select auth.uid()));
insert into public.message_states(id,sender_id,recipient_id,created_at,expires_at,packet_hash,retention)
 select id,sender_id,recipient_id,created_at,expires_at,
 case when encrypted is null then 'legacy' else encode(sha256(convert_to(encrypted::text,'UTF8')),'hex') end,
 coalesce(encrypted->'context'->>'retention','synced') from public.messages;
alter table public.messages drop constraint messages_ttl_seconds_check;
alter table public.messages alter column ttl_seconds set default 0;
alter table public.messages add constraint messages_ttl_seconds_check check(ttl_seconds in(0,3600,10800,86400,172800,604800,2592000));

create function public.set_chat_settings(other uuid, temporary boolean, duration integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.can_message(other) then raise exception 'Accesso negato'; end if;
 perform private.throttle('chat_settings',60);
 insert into public.chat_settings(member_a,member_b,temporary,duration,changed_by)
 values(least(auth.uid(),other),greatest(auth.uid(),other),temporary,duration,auth.uid())
 on conflict(member_a,member_b) do update set temporary=excluded.temporary,duration=excluded.duration,changed_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.set_chat_settings(uuid,boolean,integer) from public,anon;
grant execute on function public.set_chat_settings(uuid,boolean,integer) to authenticated;
create or replace function private.message_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare asset public.media_assets; device public.chat_devices; context jsonb; target record; lifecycle public.message_states; cfg public.chat_settings; fresh boolean; expected_ttl integer; hash text; rev integer;
begin
 perform private.throttle('messages',120);
 if new.sender_id<>auth.uid() or not private.can_message(new.recipient_id) then raise exception 'Accesso negato'; end if;
 if new.encrypted is null or new.body<>'' or new.encrypted->>'version'<>'1' or octet_length(new.encrypted::text)>20000 then raise exception 'La chat richiede cifratura end-to-end'; end if;
 context:=new.encrypted->'context';
 if context is null or context->>'id' is distinct from new.id::text or context->>'sender_id' is distinct from new.sender_id::text or context->>'recipient_id' is distinct from new.recipient_id::text or coalesce(context->>'retention','') not in ('synced','device') then raise exception 'Contesto cifrato non valido'; end if;
 select * into device from public.chat_devices where id=(new.encrypted->'sender'->>'id')::uuid and user_id=auth.uid();
 if not found or device.public_key is distinct from new.encrypted->'sender'->'public_key' then raise exception 'Dispositivo non autorizzato'; end if;
 if jsonb_typeof(new.encrypted->'keys') is distinct from 'object' then raise exception 'Chiavi mancanti'; end if;
 for target in select id from public.chat_devices where user_id in(new.sender_id,new.recipient_id) loop
   if not (new.encrypted->'keys' ? target.id::text) then raise exception 'Elenco dispositivi cambiato: riprova'; end if;
 end loop;
 if not exists(select 1 from public.chat_devices where user_id=new.recipient_id) then raise exception 'Il destinatario deve aprire la chat'; end if;
 if exists(select 1 from jsonb_object_keys(new.encrypted->'keys') k where not exists(select 1 from public.chat_devices d where d.id::text=k and d.user_id in(new.sender_id,new.recipient_id))) then raise exception 'Dispositivo estraneo'; end if;
 rev:=coalesce((context->>'revision')::integer,0);
 if rev<0 then raise exception 'Revisione non valida'; end if;
 hash:=encode(sha256(convert_to(new.encrypted::text,'UTF8')),'hex');
 select * into cfg from public.chat_settings where member_a=least(new.sender_id,new.recipient_id) and member_b=greatest(new.sender_id,new.recipient_id) for share;
 insert into public.message_states(id,sender_id,recipient_id,created_at,expires_at)
 values(new.id,new.sender_id,new.recipient_id,now(),(context->>'expires_at')::timestamptz) on conflict do nothing;
 select * into lifecycle from public.message_states where id=new.id for update;
 if lifecycle.sender_id<>auth.uid() or lifecycle.recipient_id<>new.recipient_id or lifecycle.deleted_at is not null then raise exception 'Messaggio non disponibile'; end if;
 fresh:=lifecycle.packet_hash is null;
 if fresh then
   expected_ttl:=case when coalesce(cfg.temporary,false) then cfg.duration else 0 end;
   if new.ttl_seconds<>expected_ttl then raise exception 'Impostazioni chat cambiate: riprova'; end if;
   if rev<>0 then raise exception 'Revisione non valida'; end if;
   new.expires_at:=(context->>'expires_at')::timestamptz;
   if (expected_ttl=0 and new.expires_at is not null) or (expected_ttl<>0 and (new.expires_at is null or abs(extract(epoch from new.expires_at-now())-expected_ttl)>30)) then raise exception 'Scadenza non valida'; end if;
 else
   if lifecycle.expires_at is not null and lifecycle.expires_at<=now() then raise exception 'Messaggio scaduto'; end if;
   if (context->>'expires_at')::timestamptz is distinct from lifecycle.expires_at then raise exception 'Scadenza non modificabile'; end if;
   if rev=lifecycle.revision and hash=lifecycle.packet_hash then
     new.created_at:=lifecycle.created_at; new.expires_at:=lifecycle.expires_at;
     return null; -- Retry already committed: never resurrect ciphertext or attach another blob.
   end if;
   if lifecycle.read_at is not null or now()>=lifecycle.created_at+interval '30 minutes' then raise exception 'Il messaggio è già letto o sono trascorsi 30 minuti'; end if;
   if rev<>lifecycle.revision+1 then raise exception 'Revisione cambiata: ricarica la chat'; end if;
   if context->>'retention' is distinct from lifecycle.retention then raise exception 'Conservazione non modificabile'; end if;
   new.expires_at:=lifecycle.expires_at;
 end if;
 new.created_at:=lifecycle.created_at;
 update public.message_states set revision=rev,packet_hash=hash,retention=context->>'retention',
   edited_at=case when fresh then null else now() end,delivered_at=null,read_at=null where id=new.id;
 if new.media_path is not null then
   select * into asset from public.media_assets where path=new.media_path and owner_id=auth.uid() and not deleting and created_at>now()-interval '1 hour' for update;
   if not found or asset.mime<>'application/octet-stream' or exists(select 1 from public.posts where media_path=new.media_path) or not exists(select 1 from storage.objects where bucket_id='media' and name=new.media_path) then raise exception 'Allegato cifrato non disponibile'; end if;
   new.media_type:=asset.mime;
 else new.media_type:=null; end if;
 return new;
end $$;

-- No direct client deletion can bypass the lifecycle record.
drop policy message_delivered on public.messages;
revoke delete on public.messages from authenticated;
create function public.edit_chat_message(message_id uuid, packet jsonb, media text) returns void language plpgsql security definer set search_path='' as $$
declare s public.message_states;
begin
 select * into s from public.message_states where id=message_id for update;
 if not found or s.sender_id<>auth.uid() or not private.can_message(s.recipient_id) or s.deleted_at is not null then raise exception 'Accesso negato'; end if;
 if s.read_at is not null or now()>=s.created_at+interval '30 minutes' then raise exception 'Il messaggio è già letto o sono trascorsi 30 minuti'; end if;
 if coalesce((packet->'context'->>'revision')::integer,0)<>s.revision+1 then raise exception 'Revisione cambiata: ricarica la chat'; end if;
 -- One transaction: remove old ciphertext and validate replacement through the insert guard.
 delete from public.messages where id=message_id;
 insert into public.messages(id,sender_id,recipient_id,body,encrypted,media_path,ttl_seconds)
 values(message_id,s.sender_id,s.recipient_id,'',packet,media,0);
end $$;
revoke all on function public.edit_chat_message(uuid,jsonb,text) from public,anon;
grant execute on function public.edit_chat_message(uuid,jsonb,text) to authenticated;

create function public.chat_receipt(message_id uuid, expected_revision integer, was_read boolean) returns void language plpgsql security definer set search_path='' as $$
declare s public.message_states;
begin
 select * into s from public.message_states where id=message_id for update;
 if not found or not private.member() or s.recipient_id<>auth.uid() then raise exception 'Accesso negato'; end if;
 if s.revision<>expected_revision or s.deleted_at is not null or (s.expires_at is not null and s.expires_at<=now()) then return; end if;
 update public.message_states set delivered_at=coalesce(delivered_at,now()),read_at=case when was_read then coalesce(read_at,now()) else read_at end where id=message_id;
end $$;
revoke all on function public.chat_receipt(uuid,integer,boolean) from public,anon;
grant execute on function public.chat_receipt(uuid,integer,boolean) to authenticated;

create function public.delete_chat_message(message_id uuid, for_everyone boolean) returns void language plpgsql security definer set search_path='' as $$
declare s public.message_states;
begin
 select * into s from public.message_states where id=message_id for update;
 if not found or not private.member() or auth.uid() not in(s.sender_id,s.recipient_id) then raise exception 'Accesso negato'; end if;
 if for_everyone then
   if auth.uid()<>s.sender_id then raise exception 'Accesso negato'; end if;
   update public.message_states set deleted_at=coalesce(deleted_at,now()) where id=message_id;
   update public.media_assets set deleting=true where path in(select media_path from public.messages where id=message_id);
   delete from public.messages where id=message_id;
 else
   insert into public.hidden_messages(user_id,message_id) values(auth.uid(),message_id) on conflict do nothing;
 end if;
end $$;
revoke all on function public.delete_chat_message(uuid,boolean) from public,anon;
grant execute on function public.delete_chat_message(uuid,boolean) to authenticated;

-- Versioned delivery prevents acknowledgement of an old revision deleting its replacement.
create function public.acknowledge_chat_revision(message_id uuid, expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare s public.message_states;
begin
 perform public.chat_receipt(message_id,expected_revision,false);
 select * into s from public.message_states where id=message_id for update;
 if s.recipient_id=auth.uid() and s.revision=expected_revision and s.retention='device' then
   update public.media_assets set deleting=true where path in(select media_path from public.messages where id=message_id);
   delete from public.messages where id=message_id;
 end if;
end $$;
revoke all on function public.acknowledge_chat_revision(uuid,integer) from public,anon;
grant execute on function public.acknowledge_chat_revision(uuid,integer) to authenticated;
-- Old clients must not acknowledge a revision they have never saved.
revoke execute on function public.acknowledge_messages(uuid[]) from authenticated;
