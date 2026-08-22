-- Allow a subscribers row to originate from a digest opt-out.
--
-- List-Unsubscribe has to work for everyone we mail, but digest recipients are
-- not necessarily subscribers — a contributor who signed in and uploaded
-- without ticking the updates box gets decision digests and has no row here.
-- Unsubscribing creates one so the opt-out can be recorded.
--
-- Such a row has confirmed_at NULL, so it is a SUPPRESSION record, not a
-- subscription: the two columns are orthogonal.
--   on the list  = confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
--   suppressed   = unsubscribed_at IS NOT NULL, whatever confirmed_at says

ALTER TABLE public.subscribers
  DROP CONSTRAINT IF EXISTS subscribers_source_known;
--> statement-breakpoint

ALTER TABLE public.subscribers
  ADD CONSTRAINT subscribers_source_known
  CHECK (source IN ('landing', 'upload', 'digest'));
