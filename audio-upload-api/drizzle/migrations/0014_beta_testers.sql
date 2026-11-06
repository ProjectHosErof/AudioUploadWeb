-- The beta program: people who asked to join through the open link.
--
-- DOUBLE OPT-IN, as on subscribers: a row exists from the moment the form is
-- sent but reaches the admin list only once its confirmation link is followed
-- (status 'pending'). Without that gate the form could put anyone's address
-- on the list and mail them.

CREATE TABLE "beta_testers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"parish" varchar(120),
	"device" varchar(20) NOT NULL,
	"age_range" varchar(10),
	"role" varchar(20),
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"status" varchar(12) DEFAULT 'unconfirmed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmation_sent_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decided_by" varchar(255),
	"checkin_sent_at" timestamp with time zone,
	"survey_sent_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	CONSTRAINT "beta_testers_email_unique" UNIQUE("email"),
	CONSTRAINT "beta_testers_token_unique" UNIQUE("token")
);

--> statement-breakpoint

-- Compared case-insensitively, so stored lowercase (as subscribers, admins).
ALTER TABLE public.beta_testers
  ADD CONSTRAINT beta_testers_email_lowercase CHECK (email = lower(email));
--> statement-breakpoint

-- The lifecycle in src/lib/beta.ts, and the form's closed choices.
ALTER TABLE public.beta_testers
  ADD CONSTRAINT beta_testers_status_known
  CHECK (status IN ('unconfirmed', 'pending', 'accepted', 'declined', 'withdrawn'));
--> statement-breakpoint
ALTER TABLE public.beta_testers
  ADD CONSTRAINT beta_testers_device_known CHECK (device IN ('iphone', 'android', 'tablet', 'computer'));
--> statement-breakpoint
ALTER TABLE public.beta_testers
  ADD CONSTRAINT beta_testers_role_known
  CHECK (role IS NULL OR role IN ('chanter', 'choir', 'parishioner', 'servant', 'other'));
--> statement-breakpoint
ALTER TABLE public.beta_testers
  ADD CONSTRAINT beta_testers_age_known
  CHECK (age_range IS NULL OR age_range IN ('under-25', '25-44', '45-64', '65-plus'));
--> statement-breakpoint

-- Internal, like the mailing list: RLS on with NO policy = unreachable through
-- PostgREST by anon or authenticated; only the Worker's service_role reads it.
ALTER TABLE public.beta_testers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- The daily job's lookups: who is due a check-in, who is waiting, what to purge.
CREATE INDEX IF NOT EXISTS beta_testers_status_idx ON public.beta_testers (status, checkin_sent_at);
