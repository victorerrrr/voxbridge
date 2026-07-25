-- VoxBridge — order file uploads (Supabase Storage + order_files table)
-- Run once in Supabase SQL Editor after orders RLS is in place.
--
-- HOW TO RUN (Supabase Dashboard):
--   1. Open SQL Editor → New query
--   2. Copy ALL lines from THIS file (from CREATE FUNCTION… to the end)
--   3. Do NOT paste the path "docs/supabase_order_files_storage.sql" — that is not SQL
--   4. Click Run
--
-- Creates:
--   • storage bucket `order-files` (private)
--   • table `order_files`
--   • RLS for table + storage.objects

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_access_order(target_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    LEFT JOIN public.vocalist_profiles vp ON vp.id = o.vocalist_profile_id
    WHERE o.id = target_order_id
      AND (o.producer_id = auth.uid() OR vp.owner_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_upload_order_file(
  target_order_id uuid,
  target_kind text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN target_kind = 'reference' THEN EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = target_order_id AND o.producer_id = auth.uid()
      )
      WHEN target_kind IN ('preview', 'revision', 'stems') THEN EXISTS (
        SELECT 1
        FROM public.orders o
        INNER JOIN public.vocalist_profiles vp ON vp.id = o.vocalist_profile_id
        WHERE o.id = target_order_id AND vp.owner_id = auth.uid()
      )
      ELSE false
    END;
$$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('reference', 'preview', 'revision', 'stems')),
  storage_path text NOT NULL,
  file_name    text NOT NULL,
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_files_order ON public.order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_kind ON public.order_files(order_id, kind);

ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_files_select_participants" ON public.order_files;
CREATE POLICY "order_files_select_participants"
ON public.order_files
FOR SELECT
TO authenticated
USING (public.user_can_access_order(order_id));

DROP POLICY IF EXISTS "order_files_insert_participants" ON public.order_files;
CREATE POLICY "order_files_insert_participants"
ON public.order_files
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND public.user_can_upload_order_file(order_id, kind)
);

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('order-files', 'order-files', false, 104857600)
ON CONFLICT (id) DO NOTHING;

-- Path layout: {order_id}/{file_id}_{sanitized_name}

GRANT EXECUTE ON FUNCTION public.user_can_access_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_upload_order_file(uuid, text) TO authenticated;

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

DROP POLICY IF EXISTS "order_files_storage_insert" ON storage.objects;
CREATE POLICY "order_files_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-files'
  AND public.user_can_upload_order_file(
    (split_part(name, '/', 1))::uuid,
    (
      SELECT kind FROM public.order_files
      WHERE storage_path = name
      LIMIT 1
    )
  )
);

-- Note: storage INSERT policy above requires a matching order_files row.
-- The app inserts the DB row first with storage_path, then uploads to that path.
