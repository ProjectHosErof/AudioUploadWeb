-- The "Stay Informed" list.
--
-- Kept separate from `contributors` on purpose: subscribing is an interest in
-- the project, contributing is an act of donation. Conflating them would mean
-- an unsubscribe had to reason about somebody's recordings.
--
-- DOUBLE OPT-IN: a row exists from the moment someone submits the form, but is
-- not mailable until confirmed_at is set. Without that gate the public endpoint
-- is a way to send mail to any address an attacker cares to type.

CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"source" varchar(30) DEFAULT 'landing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "subscribers_token_unique" UNIQUE("token")
);
--> statement-breakpoint

-- Addresses are compared case-insensitively, so force lowercase storage —
-- otherwise the UNIQUE index happily accepts both a@b.com and A@B.com and the
-- lookup matches only one of them. Same pattern as `admins` in 0004.
ALTER TABLE public.subscribers
  ADD CONSTRAINT subscribers_email_lowercase CHECK (email = lower(email));
--> statement-breakpoint

-- Only these two values are written today; the constraint keeps the column
-- meaningful rather than letting it drift into free text.
ALTER TABLE public.subscribers
  ADD CONSTRAINT subscribers_source_known CHECK (source IN ('landing', 'upload'));
--> statement-breakpoint

-- The mailing list is internal. RLS on with NO policy = unreachable by anon and
-- authenticated through PostgREST; only the Worker's service_role (BYPASSRLS)
-- can read it. Nobody can enumerate who has subscribed.
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- The one query a broadcast will run: everyone confirmed and not unsubscribed.
CREATE INDEX IF NOT EXISTS subscribers_mailable_idx
  ON public.subscribers (confirmed_at)
  WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL;
