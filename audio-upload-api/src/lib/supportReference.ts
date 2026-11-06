/** Letters and digits that can't be misread for each other (no 0/O, 1/I/L). */
export const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * A short reference for a support request, shown to the person and in the
 * email subject, so either side can find the conversation. Random, not
 * sequential: it reveals nothing about how many requests there have been.
 */
export function supportReference(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => REFERENCE_ALPHABET[b % REFERENCE_ALPHABET.length]).join('');
}
