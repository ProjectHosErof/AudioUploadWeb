-- Batch moderation decisions into one digest per contributor.
--
-- Mailing on every decision does not scale per PERSON: a cantor who uploads
-- their whole repertoire in an evening would wake to forty separate emails.
-- notified_at records when a decision was included in a digest.

ALTER TABLE "recordings" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint

-- Backfill every decision made before digests existed. Without this, the first
-- run would mail people about recordings they were already told about — or,
-- worse, about decisions from weeks ago that they never expected to hear of.
UPDATE public.recordings
   SET notified_at = reviewed_at
 WHERE reviewed_at IS NOT NULL
   AND notified_at IS NULL;
--> statement-breakpoint

-- The digest job's one query: decided, but nobody told yet.
CREATE INDEX IF NOT EXISTS recordings_pending_notification_idx
  ON public.recordings (reviewed_at)
  WHERE reviewed_at IS NOT NULL AND notified_at IS NULL;
