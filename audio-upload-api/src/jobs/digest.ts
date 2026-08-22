import { getSupabase } from '../lib/supabase';
import { sendEmail } from '../lib/email';
import { reviewDigest, type DigestItem } from '../emails/templates';
import { siteUrl } from '../lib/urls';
import { mailPreferenceFor, unsubscribeUrl } from '../lib/mailPreferences';

/**
 * Daily digest of moderation decisions.
 *
 * Decisions are batched per contributor rather than mailed one by one. The
 * arithmetic is the whole argument: somebody who uploads their repertoire in
 * an evening generates one decision per recording, and mailing each of them
 * means forty emails landing on one person the next morning. That is the
 * behaviour that earns unsubscribes.
 *
 * A recording is pending when it has been reviewed (`reviewed_at`) but not yet
 * included in a digest (`notified_at IS NULL`). Sending stamps `notified_at`,
 * so nothing is ever sent twice and a failed run simply retries tomorrow.
 */

/**
 * Ceiling on digests per run.
 *
 * Each digest costs one Resend call, and a Worker invocation is capped on
 * outbound subrequests (50 on the free plan, 1000 on paid). Overshooting would
 * fail the whole run, so we take a bounded slice and log the remainder — a
 * backlog drains over subsequent days rather than breaking today. Raise this
 * once the account is on a paid Workers plan.
 */
const MAX_DIGESTS_PER_RUN = 40;

/** Guards against one contributor's enormous batch crowding out everyone else. */
const MAX_ITEMS_PER_DIGEST = 200;

interface PendingRow {
  id: string;
  hymn_label: string;
  review_status: 'ready' | 'rejected';
  review_reason: string | null;
  submitter_email: string | null;
  contributors: { email: string | null; display_name: string | null } | null;
}

interface Batch {
  recipient: string;
  firstName: string | null;
  items: DigestItem[];
  recordingIds: string[];
}

export async function sendReviewDigests(env: Env, apiOrigin: string): Promise<void> {
  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from('recordings')
    .select(
      'id, hymn_label, review_status, review_reason, submitter_email, contributors(email, display_name)',
    )
    .not('reviewed_at', 'is', null)
    .is('notified_at', null)
    .order('reviewed_at', { ascending: true });

  if (error) {
    console.error('digest query failed', error);
    return;
  }

  const rows = (data ?? []) as unknown as PendingRow[];
  if (rows.length === 0) {
    console.log('digest: nothing pending');
    return;
  }

  const batches = groupByRecipient(rows);
  const reachable = batches.reduce((n, b) => n + b.recordingIds.length, 0);
  const unreachable = rows.length - reachable;
  const slice = batches.slice(0, MAX_DIGESTS_PER_RUN);
  if (batches.length > slice.length) {
    console.warn(
      `digest: ${batches.length} contributors pending, sending ${slice.length} this run — the rest go out tomorrow`,
    );
  }

  const site = siteUrl(env);
  const urls = { dashboard: `${site}/dashboard`, upload: `${site}/#upload` };
  let sent = 0;
  let suppressed = 0;

  for (const batch of slice) {
    // Every recipient needs a token so the message can carry a working
    // unsubscribe link — creating the row is a preferences record, not a
    // subscription (confirmed_at stays null).
    const pref = await mailPreferenceFor(env, batch.recipient, 'digest');
    if (!pref) {
      console.error('digest skipped — could not resolve mail preferences');
      continue;
    }
    if (pref.suppressed) {
      // They asked to stop. Stamp the decisions so we do not reconsider them
      // every night, and say nothing.
      await supabase
        .from('recordings')
        .update({ notified_at: new Date().toISOString() })
        .in('id', batch.recordingIds);
      suppressed += 1;
      continue;
    }

    const built = reviewDigest(batch.items, batch.firstName, urls);
    const ok = await sendEmail(env, {
      to: batch.recipient,
      ...built,
      unsubscribeUrl: unsubscribeUrl(apiOrigin, pref.token),
    });
    if (!ok) {
      // Leave notified_at null so tomorrow's run tries again. Better a late
      // digest than a decision the contributor never hears about.
      console.error('digest send failed, will retry next run');
      continue;
    }

    const stamped = await supabase
      .from('recordings')
      .update({ notified_at: new Date().toISOString() })
      .in('id', batch.recordingIds);
    if (stamped.error) {
      // The mail is already gone. Log loudly: without the stamp the next run
      // would send it again, which is the one duplicate we cannot take back.
      console.error('digest sent but stamping notified_at FAILED', batch.recordingIds, stamped.error);
      continue;
    }
    sent += 1;
  }

  // Unreachable decisions stay pending forever by design — an anonymous upload
  // with no opt-in has no address, and there is nothing to retry. Counting them
  // separately keeps the log from implying a backlog that will never clear.
  console.log(
    `digest: sent ${sent}/${slice.length} covering ${reachable} decision(s)` +
      (suppressed ? `; ${suppressed} recipient(s) have unsubscribed` : '') +
      (unreachable ? `; ${unreachable} decision(s) have no reachable address` : ''),
  );
}

/**
 * Group decisions by the address they should reach. One person may have both a
 * signed-in account and older anonymous uploads, so grouping is by resolved
 * address rather than by contributor row — otherwise they'd get two digests.
 *
 * Recordings with no reachable address are skipped entirely and left unstamped;
 * they are the expected consequence of anonymous uploads (ADR-004), not an
 * error, and there is nothing to retry.
 */
function groupByRecipient(rows: PendingRow[]): Batch[] {
  const batches = new Map<string, Batch>();

  for (const row of rows) {
    const recipient = row.contributors?.email ?? row.submitter_email;
    if (!recipient) continue;

    const key = recipient.toLowerCase();
    let batch = batches.get(key);
    if (!batch) {
      const full = row.contributors?.display_name?.trim();
      batch = {
        recipient,
        firstName: full ? full.split(/\s+/)[0] : null,
        items: [],
        recordingIds: [],
      };
      batches.set(key, batch);
    }

    if (batch.items.length >= MAX_ITEMS_PER_DIGEST) continue;

    batch.items.push({
      hymnLabel: row.hymn_label,
      accepted: row.review_status === 'ready',
      reason: row.review_reason,
    });
    batch.recordingIds.push(row.id);
  }

  return [...batches.values()];
}
