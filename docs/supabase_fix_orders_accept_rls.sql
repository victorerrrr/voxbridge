-- Run once in Supabase SQL Editor when vocalist Accept fails with:
-- "new row violates row-level security policy for table orders"
--
-- Allows a vocalist to create an order for the producer who sent a pending request.

CREATE POLICY "vocalist_insert_order_on_accept"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vocalist_profiles vp
    INNER JOIN public.vocalist_requests vr
      ON vr.vocalist_profile_id = vp.id
    WHERE vp.owner_id = auth.uid()
      AND vr.vocalist_profile_id = vocalist_profile_id
      AND vr.producer_id = producer_id
      AND vr.status = 'pending'
  )
);

-- Repair orders that were saved with the vocalist as producer_id (old bug):
UPDATE public.orders o
SET producer_id = vr.producer_id
FROM public.vocalist_requests vr
WHERE vr.order_id = o.id
  AND o.producer_id <> vr.producer_id;

-- Producers can leave a review after completing an order they own.
CREATE POLICY "producer_insert_review_on_own_order"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  producer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND o.producer_id = auth.uid()
      AND o.vocalist_profile_id = vocalist_profile_id
      AND o.status = 'completed'
  )
);
