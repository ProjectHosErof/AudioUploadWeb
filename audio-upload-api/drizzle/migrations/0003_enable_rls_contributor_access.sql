-- Custom SQL migration file, put your code below! --

-- Phase 3 / Pillar A — contributor identity + Row-Level Security.
--
-- ADR-003: the contributor dashboard reads a user's OWN rows directly from the
-- browser via supabase-js, governed by RLS. The Worker keeps using the
-- service_role key for every write and for moderation; service_role has the
-- BYPASSRLS attribute in Supabase, so NONE of the policies below affect the
-- existing upload pipeline.
--
-- Every table in `public` is reachable through PostgREST, so we enable RLS on
-- all of them and state access explicitly rather than relying on the absence of
-- a GRANT. Enabling RLS with no policy = deny-all for anon/authenticated.

-- ---------------------------------------------------------------------------
-- 1. Link contributors to Supabase Auth users.
--    ON DELETE SET NULL: if an auth user is deleted we keep the contribution
--    record (it belongs to the community corpus) but drop the identity link.
-- ---------------------------------------------------------------------------
ALTER TABLE public.contributors
  ADD CONSTRAINT contributors_auth_user_id_fkey
  FOREIGN KEY (auth_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 2. Reference vocabulary: public read-only data. RLS on + an explicit
--    read-all policy preserves the SELECT granted in 0001.
-- ---------------------------------------------------------------------------
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hymns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY services_read_all ON public.services
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY seasons_read_all ON public.seasons
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY hymns_read_all ON public.hymns
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY languages_read_all ON public.languages
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 3. Contributors: a signed-in user may read (and lightly update) only their
--    own profile row. Rows are CREATED by the Worker (service_role) on first
--    login — there is deliberately no INSERT policy here.
-- ---------------------------------------------------------------------------
ALTER TABLE public.contributors ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.contributors TO authenticated;

CREATE POLICY contributors_select_own ON public.contributors
  FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

-- Display name is the only self-service field; the WITH CHECK clause stops a
-- user from re-pointing their row at somebody else's auth id.
CREATE POLICY contributors_update_own ON public.contributors
  FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid()))
  WITH CHECK (auth_user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Recordings: a signed-in user may read only the recordings attributed to
--    them. Read-only — all writes stay in the Worker (service_role), so no
--    INSERT/UPDATE/DELETE policy exists. Anonymous uploads (contributor_id
--    IS NULL) are visible to nobody through this path.
-- ---------------------------------------------------------------------------
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.recordings TO authenticated;

CREATE POLICY recordings_select_own ON public.recordings
  FOR SELECT TO authenticated
  USING (
    contributor_id IN (
      SELECT id FROM public.contributors WHERE auth_user_id = (SELECT auth.uid())
    )
  );

-- Supports the policy's contributor lookup.
CREATE INDEX IF NOT EXISTS contributors_auth_user_id_idx
  ON public.contributors (auth_user_id);

-- ---------------------------------------------------------------------------
-- 5. ML feature artifacts: internal ML output. RLS on with no policy =
--    unreachable by anon/authenticated; only service_role (BYPASSRLS) sees it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.ml_feature_artifacts ENABLE ROW LEVEL SECURITY;
