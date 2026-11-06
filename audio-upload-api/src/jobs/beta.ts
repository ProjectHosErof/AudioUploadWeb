import { getSupabase } from '../lib/supabase';
import { sendEmail } from '../lib/email';
import { siteUrl } from '../lib/urls';
import { dueForCheckin, type CheckinCandidate } from '../lib/beta';
import { sendBetaCheckin } from '../lib/betaMail';
import { betaWaitingSummary } from '../emails/beta';

/** Unconfirmed requests are dropped after this; declined ones after DECLINED_DAYS. */
const UNCONFIRMED_DAYS = 7;
const DECLINED_DAYS = 30;
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

/**
 * The beta's part of the daily run:
 *  1. the day-7 check-in to testers who are due (stamped per send, so a failed
 *     one simply goes tomorrow);
 *  2. one line to the support inbox when people are waiting for a decision;
 *  3. retention: unconfirmed and declined requests are deleted after a while.
 */
export async function runBetaJobs(env: Env, apiOrigin: string): Promise<void> {
  const supabase = getSupabase(env);

  const accepted = await supabase
    .from('beta_testers')
    .select('id, email, name, token, status, decided_at, checkin_sent_at')
    .eq('status', 'accepted')
    .is('checkin_sent_at', null);
  if (accepted.error) {
    console.error('beta check-in lookup failed', accepted.error);
  } else {
    const due = dueForCheckin(accepted.data as (CheckinCandidate & { email: string; name: string; token: string })[], new Date());
    let sent = 0;
    for (const t of due) {
      if (await sendBetaCheckin(env, apiOrigin, t)) {
        await supabase.from('beta_testers').update({ checkin_sent_at: new Date().toISOString() }).eq('id', t.id);
        sent++;
      }
    }
    if (due.length) console.log(`beta: sent ${sent} of ${due.length} check-in(s)`);
  }

  const waiting = await supabase.from('beta_testers').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  if (waiting.error) {
    console.error('beta waiting count failed', waiting.error);
  } else if (waiting.count) {
    await sendEmail(env, { to: env.SUPPORT_INBOX, ...betaWaitingSummary(waiting.count, `${siteUrl(env)}/admin/beta`) });
  }

  const purgeUnconfirmed = await supabase
    .from('beta_testers')
    .delete()
    .eq('status', 'unconfirmed')
    .lt('created_at', daysAgo(UNCONFIRMED_DAYS));
  const purgeDeclined = await supabase
    .from('beta_testers')
    .delete()
    .eq('status', 'declined')
    .lt('decided_at', daysAgo(DECLINED_DAYS));
  if (purgeUnconfirmed.error || purgeDeclined.error) {
    console.error('beta retention failed', purgeUnconfirmed.error ?? purgeDeclined.error);
  }
}
