-- Custom SQL migration file, put your code below! --

-- A least-privilege login for the hourly enrichment job (GitHub Actions,
-- .github/workflows/enrichment.yml), which runs enrichment/enrich.py.
--
-- The job reads completed recordings, probes their audio, and writes back the
-- technical fields and the dedup verdict. It needs nothing else: no other
-- tables, no auth schema, no inserts or deletes, and only these columns.
-- The password is NOT set here (no secrets in git); set it by hand:
--   ALTER ROLE enrichment_worker PASSWORD '<generated>';
-- and connect through the session pooler as  enrichment_worker.<project-ref>.
--
-- Access goes through explicit RLS policies (recordings has RLS on since 0003),
-- the same approach as backup_reader in 0009.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'enrichment_worker') THEN
    CREATE ROLE enrichment_worker LOGIN NOINHERIT;
  END IF;
END
$$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO enrichment_worker;
--> statement-breakpoint
GRANT SELECT ON public.recordings TO enrichment_worker;
--> statement-breakpoint
-- Only the columns enrich.py writes.
GRANT UPDATE (
  content_hash, duration_seconds, sample_rate_hz, channels, codec,
  review_status, error_message, duplicate_of_id, updated_at
) ON public.recordings TO enrichment_worker;
--> statement-breakpoint

CREATE POLICY enrichment_worker_read ON public.recordings
  FOR SELECT TO enrichment_worker USING (true);
--> statement-breakpoint
CREATE POLICY enrichment_worker_update ON public.recordings
  FOR UPDATE TO enrichment_worker USING (true) WITH CHECK (true);
