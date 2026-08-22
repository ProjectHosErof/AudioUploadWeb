import { getSupabase } from './supabase';

/**
 * Per-address email preferences, backed by the `subscribers` table.
 *
 * Two columns, orthogonal on purpose:
 *   on the list = confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
 *   suppressed  = unsubscribed_at IS NOT NULL, whatever confirmed_at says
 *
 * So a row can exist purely to record "stop emailing me" for someone who was
 * never on the mailing list — a contributor who uploaded while signed in
 * without ticking the updates box, for instance. They still receive decision
 * digests, so they still need a way to stop them.
 */

export interface MailPreference {
  /** Unguessable capability used by both the confirm and unsubscribe links. */
  token: string;
  suppressed: boolean;
}

/**
 * Find or create the preferences row for an address, returning its token.
 *
 * Creating a row here is not a subscription: confirmed_at stays null, so the
 * address is not mailable as a list member. It exists so every message we send
 * can carry a working unsubscribe link.
 */
export async function mailPreferenceFor(
  env: Env,
  rawEmail: string,
  source: 'landing' | 'upload' | 'digest',
): Promise<MailPreference | null> {
  const email = rawEmail.trim().toLowerCase();
  const supabase = getSupabase(env);

  const existing = await supabase
    .from('subscribers')
    .select('token, unsubscribed_at')
    .eq('email', email)
    .maybeSingle();
  if (existing.error) {
    console.error('mail preference lookup failed', existing.error);
    return null;
  }
  if (existing.data) {
    return {
      token: existing.data.token as string,
      suppressed: Boolean(existing.data.unsubscribed_at),
    };
  }

  const created = await supabase
    .from('subscribers')
    .insert({ email, source })
    .select('token')
    .maybeSingle();
  if (created.error || !created.data) {
    console.error('mail preference insert failed', created.error);
    return null;
  }
  return { token: created.data.token as string, suppressed: false };
}

/** The URL that belongs in List-Unsubscribe for a given token. */
export function unsubscribeUrl(apiOrigin: string, token: string): string {
  return `${apiOrigin}/subscribe/unsubscribe/${token}`;
}
