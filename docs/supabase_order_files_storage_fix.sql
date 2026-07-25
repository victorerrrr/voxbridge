-- Fix broken file uploads: storage INSERT + allow DELETE rollback + cleanup orphans.
-- Run in Supabase SQL Editor (copy file contents, NOT the path).

GRANT EXECUTE ON FUNCTION public.user_can_access_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_upload_order_file(uuid, text) TO authenticated;

-- order_files: allow uploader to delete (needed when storage upload fails)
DROP POLICY IF EXISTS "order_files_delete_own" ON public.order_files;
CREATE POLICY "order_files_delete_own"
ON public.order_files
FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid());

-- storage SELECT (via order_files join)
DROP POLICY IF EXISTS "order_files_storage_select" ON storage.objects;
CREATE POLICY "order_files_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'order-files'
  AND EXISTS (
    SELECT 1
    FROM public.order_files f
    WHERE f.storage_path = name
      AND public.user_can_access_order(f.order_id)
  )
);

-- storage INSERT: row must exist in order_files (app inserts DB row first)
DROP POLICY IF EXISTS "order_files_storage_insert" ON storage.objects;
CREATE POLICY "order_files_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-files'
  AND EXISTS (
    SELECT 1
    FROM public.order_files f
    WHERE f.storage_path = name
      AND f.uploaded_by = auth.uid()
  )
);

-- storage DELETE: uploader can remove their file
DROP POLICY IF EXISTS "order_files_storage_delete" ON storage.objects;
CREATE POLICY "order_files_storage_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'order-files'
  AND EXISTS (
    SELECT 1
    FROM public.order_files f
    WHERE f.storage_path = name
      AND f.uploaded_by = auth.uid()
  )
);

-- Optional: remove orphan DB rows (file in DB but missing in storage).
-- Safe to run — only deletes rows with no storage object.
DELETE FROM public.order_files f
WHERE NOT EXISTS (
  SELECT 1 FROM storage.objects o
  WHERE o.bucket_id = 'order-files' AND o.name = f.storage_path
);
