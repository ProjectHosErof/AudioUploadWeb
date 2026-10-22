-- Custom SQL migration file, put your code below! --

-- ADR-012 — a read-only login for the nightly corpus backup (pg_dump).
--
-- The backup runs in GitHub Actions, so the credential it holds should be able
-- to read the corpus and nothing else: no writes, no auth schema, no
-- service_role. The password is NOT set here (no secrets in git); set it by
-- hand after applying:
--   ALTER ROLE backup_reader PASSWORD '<generated>';
-- and connect through the session pooler as  backup_reader.<project-ref>.
--
-- Why policies rather than BYPASSRLS: every table in `public` has RLS on
-- (0003), and pg_dump refuses to dump a table RLS applies to unless it runs
-- with --enable-row-security, in which case it dumps only what policies allow.
-- An explicit read-all policy per table gives the backup role exactly the rows
-- it needs, works on every Postgres version Supabase runs (creating a
-- BYPASSRLS role needs superuser before PG16), and is narrower than bypassing
-- RLS wholesale.
--
-- A FUTURE TABLE WITH RLS NEEDS ITS OWN backup_reader POLICY, or it would be
-- backed up empty. scripts/backup/run-backup.sh checks for exactly that and
-- fails the run, so the gap can't go unnoticed.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'backup_reader') THEN
    CREATE ROLE backup_reader LOGIN NOINHERIT;
  END IF;
END
$$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO backup_reader;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_reader;
--> statement-breakpoint
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO backup_reader;
--> statement-breakpoint

-- Tables created later by the migration role are readable too (the policy
-- still has to be added — see above).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_reader;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO backup_reader;
--> statement-breakpoint

-- One read-all policy on every RLS-enabled table that exists today.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format(
      'CREATE POLICY backup_reader_read_all ON public.%I FOR SELECT TO backup_reader USING (true)',
      t
    );
  END LOOP;
END
$$;
