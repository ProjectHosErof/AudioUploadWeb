/**
 * Whether POST /subscribe should send (or re-send) a confirmation email.
 *
 * Without a cooldown, every submission re-sent the confirmation to an
 * unconfirmed address — so the public form could be used to flood someone's
 * inbox from our domain and burn the email provider's daily quota (which
 * sign-in links and review digests share). One confirmation per address per
 * day is plenty for a person who lost the first one.
 *
 * Kept pure so the decision is unit-testable.
 */

export const CONFIRMATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function shouldSendConfirmation(input: {
  alreadyConfirmed: boolean;
  /** When the last confirmation email went out, if ever. */
  lastSentAt: string | null;
  now: number;
}): boolean {
  if (input.alreadyConfirmed) return false;
  if (!input.lastSentAt) return true;
  const last = Date.parse(input.lastSentAt);
  // An unparseable timestamp shouldn't lock someone out forever.
  if (Number.isNaN(last)) return true;
  return input.now - last >= CONFIRMATION_COOLDOWN_MS;
}
