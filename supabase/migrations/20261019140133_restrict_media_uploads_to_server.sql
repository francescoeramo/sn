-- A client-controlled reservation is not proof of the uploaded object's size.
-- Only the application server may persist media after measuring the immutable
-- body and reserving its exact bytes through the normal user/RLS client.
drop policy if exists sn_storage_insert on storage.objects;
create policy sn_media_server_upload_only on storage.objects
as restrictive for insert to authenticated
with check(bucket_id <> 'media');
-- Other buckets retain their policies. Reads, immutable paths, reservations,
-- throttling, quota row locks and cleanup remain unchanged.
-- Deploy the server upload change before applying this migration. Rolling the
-- server back afterwards fails uploads closed; do not restore direct insertion.
