import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase';
import { bearerToken, verifyUser } from '../lib/auth';

export const me = new Hono<{ Bindings: Env }>();

/**
 * POST /me/link
 *
 * Called once right after sign-in. Two jobs:
 *   1. Ensure a `contributors` row exists for this auth user.
 *   2. Claim past uploads submitted anonymously with the same email address,
 *      so a contributor's history is complete the first time they log in.
 *
 * Contributor rows are only ever created here (service_role) — there is no
 * INSERT policy for `authenticated`, so the browser cannot forge one.
 *
 * The email backfill is gated on Supabase having *confirmed* the address.
 * Without that check, an unverified sign-up could claim somebody else's
 * submissions just by typing their email.
 */
me.post('/link', async (c) => {
  const token = bearerToken(c.req.header('authorization'));
  if (!token) return c.json({ error: 'Missing bearer token' }, 401);

  const user = await verifyUser(c.env, token);
  if (!user) return c.json({ error: 'Invalid or expired session' }, 401);

  const supabase = getSupabase(c.env);

  // --- 1. Resolve (or create) the contributor row -------------------------
  const existing = await supabase
    .from('contributors')
    .select('id, email')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (existing.error) {
    console.error('contributor lookup failed', existing.error);
    return c.json({ error: 'Could not load your profile.' }, 500);
  }

  let contributorId = existing.data?.id as string | undefined;

  if (!contributorId && user.email) {
    // A row may already carry this email from an earlier link attempt.
    const byEmail = await supabase
      .from('contributors')
      .select('id, auth_user_id')
      .eq('email', user.email)
      .maybeSingle();
    if (byEmail.error) {
      console.error('contributor email lookup failed', byEmail.error);
      return c.json({ error: 'Could not load your profile.' }, 500);
    }
    if (byEmail.data) {
      if (byEmail.data.auth_user_id && byEmail.data.auth_user_id !== user.id) {
        // Belongs to a different identity — never re-point it.
        return c.json({ error: 'That email is already linked to another account.' }, 409);
      }
      const claim = await supabase
        .from('contributors')
        .update({ auth_user_id: user.id })
        .eq('id', byEmail.data.id)
        .select('id')
        .maybeSingle();
      if (claim.error) {
        console.error('contributor claim failed', claim.error);
        return c.json({ error: 'Could not link your profile.' }, 500);
      }
      contributorId = claim.data?.id as string | undefined;
    }
  }

  if (!contributorId) {
    const created = await supabase
      .from('contributors')
      .insert({ auth_user_id: user.id, email: user.email })
      .select('id')
      .maybeSingle();
    if (created.error || !created.data) {
      console.error('contributor insert failed', created.error);
      return c.json({ error: 'Could not create your profile.' }, 500);
    }
    contributorId = created.data.id as string;
  }

  // --- 2. Claim prior anonymous uploads by verified email -----------------
  let claimedRecordings = 0;
  if (user.email && user.emailVerified) {
    const claimed = await supabase
      .from('recordings')
      .update({ contributor_id: contributorId, updated_at: new Date().toISOString() })
      .eq('submitter_email', user.email)
      .is('contributor_id', null)
      .select('id');
    if (claimed.error) {
      // Non-fatal: the profile exists, history just stays unclaimed for now.
      console.error('recording backfill failed', claimed.error);
    } else {
      claimedRecordings = claimed.data?.length ?? 0;
    }
  }

  return c.json({ contributorId, claimedRecordings });
});
