-- Storage validates the bucket's allowed MIME types and file-size limit itself.
-- At INSERT time the Storage service may not yet expose its generated metadata
-- consistently to RLS, so authorization must not depend on metadata->size/type.
drop policy if exists sn_storage_insert on storage.objects;

create policy sn_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'media'
  and private.member()
  and exists (
    select 1
    from public.media_assets as asset
    where asset.path = name
      and asset.owner_id = (select auth.uid())
      and not asset.deleting
      and asset.created_at > now() - interval '1 hour'
  )
);
