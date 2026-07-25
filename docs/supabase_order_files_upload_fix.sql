-- Run once if upload still fails (after storage_fix.sql).
-- Path format: {order_id}/{kind}/{file_id}_{name}

DROP POLICY IF EXISTS "order_files_storage_insert" ON storage.objects;
CREATE POLICY "order_files_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-files'
  AND public.user_can_upload_order_file(
    (split_part(name, '/', 1))::uuid,
    split_part(name, '/', 2)
  )
);

DELETE FROM public.order_files f
WHERE NOT EXISTS (
  SELECT 1 FROM storage.objects o
  WHERE o.bucket_id = 'order-files' AND o.name = f.storage_path
);
