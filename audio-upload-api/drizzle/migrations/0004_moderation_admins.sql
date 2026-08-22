-- Phase 3 / Pillar C — moderation.
--
-- ADR-008 (promote-gate): a recording waits at review_status='processing'
-- until a human promotes it to 'ready'. Nothing reaches the training corpus
-- without a decision, and every decision is attributable.
--
-- ADR-010: admin authorization is a TABLE the Worker checks, not a custom JWT
-- claim — adding a moderator is an INSERT, not a deploy.

CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"auth_user_id" uuid,
	"note" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email"),
	CONSTRAINT "admins_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "duplicate_of_id" uuid;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 1. Admins: email is the invite key, auth_user_id is resolved on first use.
--
--    Emails are compared case-insensitively everywhere, so force storage to
--    lowercase — otherwise the UNIQUE index would happily accept both
--    'a@b.com' and 'A@B.com' and the lookup would match only one of them.
-- ---------------------------------------------------------------------------
ALTER TABLE public.admins
  ADD CONSTRAINT admins_email_lowercase CHECK (email = lower(email));
--> statement-breakpoint

-- ON DELETE SET NULL, not CASCADE: deleting a Supabase auth user must not
-- silently revoke the invitation. The row survives keyed on its email and
-- re-resolves if that person signs in again.
ALTER TABLE public.admins
  ADD CONSTRAINT admins_auth_user_id_fkey
  FOREIGN KEY (auth_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;
--> statement-breakpoint

-- The allowlist is internal. RLS on with NO policy = unreachable by anon and
-- authenticated through PostgREST; only the Worker's service_role (BYPASSRLS)
-- can read it. Nobody can enumerate who the moderators are.
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Moderation audit trail on recordings.
-- ---------------------------------------------------------------------------

-- Keep the decision record even if the reviewer's auth user is later deleted;
-- reviewed_at/review_reason remain, which is the point of an audit column.
ALTER TABLE public.recordings
  ADD CONSTRAINT recordings_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users (id) ON DELETE SET NULL;
--> statement-breakpoint

-- Structured successor to the "duplicate of <id>" text in error_message.
-- ON DELETE SET NULL so removing the surviving copy can't cascade-delete the
-- duplicates that point at it.
ALTER TABLE public.recordings
  ADD CONSTRAINT recordings_duplicate_of_id_fkey
  FOREIGN KEY (duplicate_of_id) REFERENCES public.recordings (id) ON DELETE SET NULL;
--> statement-breakpoint

-- A recording can never be its own duplicate.
ALTER TABLE public.recordings
  ADD CONSTRAINT recordings_duplicate_not_self CHECK (duplicate_of_id <> id);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Moderation queue index.
--    The queue is exactly "uploaded, enriched or not, awaiting a decision,
--    oldest first" — a partial index keeps it small and keyed to that query
--    instead of leaning on the separate review_status/upload_status indexes.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS recordings_moderation_queue_idx
  ON public.recordings (created_at)
  WHERE review_status = 'processing' AND upload_status = 'completed';
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Contributors keep reading their own rows only (policy from 0003 is
--    unchanged and already covers the new columns — a SELECT policy is
--    row-scoped, not column-scoped). review_reason is therefore visible to
--    the contributor who owns the recording, which is intended: a rejection
--    should be explainable to the person who submitted it.
-- ---------------------------------------------------------------------------
