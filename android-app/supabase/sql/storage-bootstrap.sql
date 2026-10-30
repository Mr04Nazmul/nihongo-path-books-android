-- Private bucket. Uploads/readback go through the authenticated admin/entitlement API.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('nihongo-books-audio','nihongo-books-audio',false,20000000,array['audio/mpeg']) on conflict(id) do nothing;
