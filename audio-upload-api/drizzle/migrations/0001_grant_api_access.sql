-- Custom SQL migration file, put your code below! --

-- Grant the Supabase API roles access to the tables created by drizzle-kit.
-- Tables created outside Supabase's normal flow don't inherit these grants, so
-- supabase-js (service_role) gets "permission denied" without this.

-- The Worker uses the service_role key for all data access.
GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Controlled vocabularies are public reference data; allow the browser-facing
-- roles to read them (used by the future contributor dashboard).
GRANT SELECT ON public.services, public.seasons, public.hymns, public.languages
  TO anon, authenticated;

-- Ensure future tables created by the migration role inherit the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
