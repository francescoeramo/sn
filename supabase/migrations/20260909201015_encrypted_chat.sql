-- Device keys are public only; clients generate and retain non-exportable private keys.
create table public.chat_devices (
 id uuid primary key, user_id uuid not null references public.profiles on delete cascade,
 public_key jsonb not null check(coalesce(public_key->>'kty'='EC' and public_key->>'crv'='P-256' and length(public_key->>'x')=43 and length(public_key->>'y')=43 and not(public_key ? 'd'),false)),
 label text not null check(length(label) between 1 and 60), created_at timestamptz not null default now()
);
create index chat_devices_user on public.chat_devices(user_id);
alter table public.chat_devices enable row level security;
revoke all on public.chat_devices from public,anon,authenticated;
grant select,delete on public.chat_devices to authenticated;
grant insert(id,user_id,public_key,label) on public.chat_devices to authenticated;
grant all on public.chat_devices to service_role;
create policy device_read on public.chat_devices for select to authenticated using(private.member() and (user_id=(select auth.uid()) or private.can_message(user_id)));
create policy device_add on public.chat_devices for insert to authenticated with check(private.member() and user_id=(select auth.uid()));
create policy device_remove on public.chat_devices for delete to authenticated using(private.member() and user_id=(select auth.uid()));
create function private.device_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.user_id<>auth.uid() or not private.member() then raise exception 'Accesso negato'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if (select count(*) from public.chat_devices where user_id=auth.uid())>=5 then raise exception 'Massimo cinque browser autorizzati'; end if;
 perform private.throttle('chat_devices',10);
 return new;
end $$;
revoke all on function private.device_guard() from public,anon,authenticated;
create trigger sn_device_guard before insert on public.chat_devices for each row execute function private.device_guard();
alter table public.messages add column encrypted jsonb;
alter table public.messages drop constraint messages_content_check;
alter table public.messages add constraint messages_content_check check(length(trim(body))>0 or media_path is not null or encrypted is not null);
grant insert(id,encrypted) on public.messages to authenticated;
alter table public.media_assets drop constraint media_assets_mime_check;
alter table public.media_assets add constraint media_assets_mime_check check(mime in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/webm','audio/ogg','audio/mp4','application/octet-stream'));
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/webm','audio/ogg','audio/mp4','application/octet-stream'] where id='media';
-- Preserve the legacy guard for existing history, but require encrypted payloads for every new message.
create or replace function private.message_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare asset public.media_assets; device public.chat_devices; context jsonb; target record;
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
 new.created_at:=now();
 new.expires_at:=(context->>'expires_at')::timestamptz;
 if new.expires_at is null or new.expires_at<=now() or new.expires_at>now()+make_interval(secs=>new.ttl_seconds)+interval '10 seconds' then raise exception 'Scadenza non valida'; end if;
 if new.media_path is not null then
   select * into asset from public.media_assets where path=new.media_path and owner_id=auth.uid() and not deleting and created_at>now()-interval '1 hour' for update;
   if not found or asset.mime<>'application/octet-stream' or exists(select 1 from public.posts where media_path=new.media_path) or not exists(select 1 from storage.objects where bucket_id='media' and name=new.media_path) then raise exception 'Allegato cifrato non disponibile'; end if;
   new.media_type:=asset.mime;
 else new.media_type:=null; end if;
 return new;
end $$;
-- Acknowledgement removes local-only messages only after the recipient saved them locally.
create policy message_delivered on public.messages for delete to authenticated using(private.member() and recipient_id=(select auth.uid()) and encrypted->'context'->>'retention'='device');
grant delete on public.messages to authenticated;
create function public.acknowledge_messages(message_ids uuid[]) returns setof text language plpgsql security definer set search_path='' as $$
declare paths text[];
begin
 if not private.member() or auth.uid() is null or cardinality(message_ids)>100 then raise exception 'Accesso negato'; end if;
 with delivered as (
   delete from public.messages where id=any(message_ids) and recipient_id=auth.uid() and encrypted->'context'->>'retention'='device' returning media_path
 ) select array_agg(media_path) filter(where media_path is not null) into paths from delivered;
 update public.media_assets set deleting=true where path=any(paths);
 return query select unnest(paths);
end $$;
revoke all on function public.acknowledge_messages(uuid[]) from public,anon;
grant execute on function public.acknowledge_messages(uuid[]) to authenticated;
-- A failed blob deletion can be retried immediately by the maintenance job.
create or replace function public.claim_media_cleanup() returns setof text language sql security invoker set search_path='' as $$
 with candidates as (
  select a.path from public.media_assets a where (a.deleting or a.created_at<now()-interval '1 hour')
  and not exists(select 1 from public.posts p where p.media_path=a.path)
  and not exists(select 1 from public.messages m where m.media_path=a.path)
  order by a.created_at limit 100 for update skip locked
 ) update public.media_assets set deleting=true where path in(select path from candidates) returning path
$$;
