-- TUS resumable upload needs INSERT + UPDATE on storage.objects (not only INSERT).
-- Run in Supabase SQL Editor after storage_fix.sql and upload_fix.sql.

GRANT EXECUTE ON FUNCTION public.user_can_access_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_upload_order_file(uuid, text) TO authenticated;

-- Participant on the order (producer or vocalist) — used for storage paths:
-- {order_id}/{kind}/{file_id}_{name}
CREATE OR REPLACE FUNCTION public.user_can_access_order_storage_path(object_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    object_path IS NOT NULL
    AND object_path <> ''
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      LEFT JOIN public.vocalist_profiles vp ON vp.id = o.vocalist_profile_id
      WHERE o.id = (split_part(object_path, '/', 1))::uuid
        AND (o.producer_id = auth.uid() OR vp.owner_id = auth.uid())
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_order_storage_path(text) TO authenticated;

DROP POLICY IF EXISTS "order_files_storage_select" ON storage.objects;
CREATE POLICY "order_files_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'order-files'
  AND public.user_can_access_order_storage_path(name)
);

DROP POLICY IF EXISTS "order_files_storage_insert" ON storage.objects;
CREATE POLICY "order_files_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-files'
  AND public.user_can_access_order_storage_path(name)
);

-- Required for TUS chunked upload (PATCH/UPDATE while uploading)
DROP POLICY IF EXISTS "order_files_storage_update" ON storage.objects;
CREATE POLICY "order_files_storage_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'order-files'
  AND public.user_can_access_order_storage_path(name)
)
WITH CHECK (
  bucket_id = 'order-files'
  AND public.user_can_access_order_storage_path(name)
);

DROP POLICY IF EXISTS "order_files_storage_delete" ON storage.objects;
CREATE POLICY "order_files_storage_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'order-files'
  AND public.user_can_access_order_storage_path(name)
);
