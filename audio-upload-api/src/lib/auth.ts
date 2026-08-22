import { getSupabase } from './supabase';

/**
 * Supabase Auth helpers for the Worker.
 *
 * Uploads stay anonymous (ADR-004) — these are only used to *attribute* a
 * submission when the caller happens to be signed in, and to link a
 * contributor record after login. The dashboard itself never comes through
 * here: it reads its own rows directly under RLS (ADR-003).
 */

export interface AuthedUser {
  /** auth.users.id */
  id: string;
  email: string | null;
  /** Supabase confirms the address for both magic-link and OAuth sign-ins. */
  emailVerified: boolean;
  /**
   * Name as the identity provider gave it, when there is one. Google supplies
   * this for OAuth sign-ins; magic-link users have none. Used to address
   * people by name in email rather than writing to a stranger.
   */
  displayName: string | null;
}

/** Pull the token out of an `Authorization: Bearer <jwt>` header. */
export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Verify an access token with Supabase and return the user it belongs to.
 * Returns null for a missing, malformed, expired, or revoked token — callers
 * decide whether that means "401" or "carry on anonymously".
 */
export async function verifyUser(env: Env, token: string): Promise<AuthedUser | null> {
  const { data, error } = await getSupabase(env).auth.getUser(token);
  if (error || !data?.user) return null;
  const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const name = metadata.full_name ?? metadata.name;

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    emailVerified: Boolean(data.user.email_confirmed_at),
    displayName: typeof name === 'string' && name.trim() ? name.trim() : null,
  };
}

/**
 * Best-effort identification for endpoints that work signed-in *or* anonymous.
 * Never throws and never rejects the request — an unusable token simply means
 * "anonymous".
 */
export async function optionalUser(env: Env, header: string | undefined): Promise<AuthedUser | null> {
  const token = bearerToken(header);
  if (!token) return null;
  try {
    return await verifyUser(env, token);
  } catch (err) {
    console.error('optional auth check failed', err);
    return null;
  }
}
