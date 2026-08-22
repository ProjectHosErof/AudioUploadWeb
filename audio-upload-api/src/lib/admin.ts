import type { MiddlewareHandler } from 'hono';
import { getSupabase } from './supabase';
import { bearerToken, verifyUser, type AuthedUser } from './auth';

/**
 * Admin authorization (ADR-010).
 *
 * The allowlist is a table, not a JWT claim, so promoting a moderator is an
 * INSERT rather than a deploy. Rows are keyed on EMAIL because auth.users has
 * no row for someone who has never signed in — you can invite first and the
 * identity resolves later.
 *
 * Matching order:
 *   1. auth_user_id — the stable identifier, used once it has been resolved.
 *   2. verified email — the invite path, and ONLY for an address Supabase has
 *      confirmed. Without that gate, signing up with an unverified address
 *      somebody else was invited under would hand over the moderation queue.
 *
 * A successful email match backfills auth_user_id, so it is a one-time path
 * per admin.
 */

export interface AdminIdentity {
  user: AuthedUser;
  adminId: string;
}

/** Short by design: this is also how fast a revoked admin actually loses access. */
const TTL_MS = 60_000;

interface CacheEntry {
  adminId: string | null; // null = confirmed NOT an admin (negative caching)
  expiresAt: number;
}

// Keyed by auth user id. Per-isolate, like the vocab cache.
const cache = new Map<string, CacheEntry>();

function cached(userId: string): CacheEntry | null {
  const hit = cache.get(userId);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    cache.delete(userId);
    return null;
  }
  return hit;
}

function remember(userId: string, adminId: string | null): void {
  cache.set(userId, { adminId, expiresAt: Date.now() + TTL_MS });
}

/**
 * Resolve a verified user to an admin row, or null if they aren't one.
 * Exported for GET /admin/me, which needs the answer without the 403.
 */
export async function resolveAdmin(env: Env, user: AuthedUser): Promise<string | null> {
  const hit = cached(user.id);
  if (hit) return hit.adminId;

  const supabase = getSupabase(env);

  // 1. Already-linked identity.
  const byId = await supabase
    .from('admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (byId.error) throw new Error(`admin lookup failed: ${byId.error.message}`);
  if (byId.data) {
    remember(user.id, byId.data.id as string);
    return byId.data.id as string;
  }

  // 2. Invite by verified email.
  if (!user.email || !user.emailVerified) {
    remember(user.id, null);
    return null;
  }

  const byEmail = await supabase
    .from('admins')
    .select('id, auth_user_id')
    .eq('email', user.email.toLowerCase())
    .maybeSingle();
  if (byEmail.error) throw new Error(`admin lookup failed: ${byEmail.error.message}`);

  // An invite already claimed by a different identity is not ours to take.
  if (!byEmail.data || (byEmail.data.auth_user_id && byEmail.data.auth_user_id !== user.id)) {
    remember(user.id, null);
    return null;
  }

  const adminId = byEmail.data.id as string;

  // Backfill so every later check takes the id path. Non-fatal if it loses a
  // race with a concurrent request — the email path would just run again.
  const claim = await supabase
    .from('admins')
    .update({ auth_user_id: user.id })
    .eq('id', adminId)
    .is('auth_user_id', null);
  if (claim.error) console.error('admin auth_user_id backfill failed', claim.error);

  remember(user.id, adminId);
  return adminId;
}

/**
 * Gate a route on admin membership. 401 for "we don't know who you are",
 * 403 for "we do, and you may not" — the distinction matters to the client,
 * which should send an expired session back to sign-in but not a valid one.
 *
 * The resolved identity is stashed on the context for handlers to record in
 * the audit trail.
 */
export function requireAdmin(): MiddlewareHandler<{
  Bindings: Env;
  Variables: { admin: AdminIdentity };
}> {
  return async (c, next) => {
    const token = bearerToken(c.req.header('authorization'));
    if (!token) return c.json({ error: 'Missing bearer token' }, 401);

    const user = await verifyUser(c.env, token);
    if (!user) return c.json({ error: 'Invalid or expired session' }, 401);

    let adminId: string | null;
    try {
      adminId = await resolveAdmin(c.env, user);
    } catch (err) {
      console.error('admin check failed', err);
      return c.json({ error: 'Could not verify your access.' }, 500);
    }

    // Deliberately vague: an admin-only surface shouldn't confirm it exists.
    if (!adminId) return c.json({ error: 'Not found' }, 403);

    c.set('admin', { user, adminId });
    await next();
  };
}
