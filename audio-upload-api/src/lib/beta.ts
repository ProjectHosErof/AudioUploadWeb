/**
 * The beta program's rules, kept pure so they can be tested without a
 * database: who may move to which status, who is due the day-7 check-in, and
 * how far each tester has got (computed from existing data, never stored).
 */

export type BetaStatus = 'unconfirmed' | 'pending' | 'accepted' | 'declined' | 'withdrawn';
export type BetaAction = 'confirm' | 'accept' | 'decline' | 'leave';

/** unconfirmed → pending (link followed) → accepted | declined; anyone may leave. */
export function nextStatus(current: BetaStatus, action: BetaAction): BetaStatus | null {
  switch (action) {
    case 'confirm':
      return current === 'unconfirmed' ? 'pending' : null;
    case 'accept':
      return current === 'pending' ? 'accepted' : null;
    case 'decline':
      return current === 'pending' ? 'declined' : null;
    case 'leave':
      return current === 'withdrawn' ? null : 'withdrawn';
  }
}

/** Days after acceptance that the check-in goes out. */
export const CHECKIN_AFTER_DAYS = 7;
/** Emails per daily run, as the review digest (a Worker caps outbound calls). */
export const MAX_EMAILS_PER_RUN = 40;

export interface CheckinCandidate {
  id: string;
  status: BetaStatus;
  decided_at: string | null;
  checkin_sent_at: string | null;
}

/** Accepted testers whose check-in is due and not yet sent, oldest first, capped. */
export function dueForCheckin<T extends CheckinCandidate>(rows: T[], now: Date): T[] {
  const cutoff = now.getTime() - CHECKIN_AFTER_DAYS * 24 * 60 * 60 * 1000;
  return rows
    .filter((r) => r.status === 'accepted' && !r.checkin_sent_at && r.decided_at && Date.parse(r.decided_at) <= cutoff)
    .sort((a, b) => Date.parse(a.decided_at!) - Date.parse(b.decided_at!))
    .slice(0, MAX_EMAILS_PER_RUN);
}

export interface TesterProgress {
  signedIn: boolean;
  uploads: number;
  notListed: number;
  lastUpload: string | null;
}

export interface ProgressContributor {
  id: string;
  email: string | null;
  auth_user_id: string | null;
}

export interface ProgressRecording {
  contributor_id: string | null;
  submitter_email: string | null;
  placement_unlisted: boolean;
  created_at: string;
}

/**
 * How far a tester has got: signed in (an account with their email), and
 * their completed uploads — matched to the account or to the email they typed
 * on the upload form, whichever applies.
 */
export function progressFor(
  email: string,
  contributors: ProgressContributor[],
  recordings: ProgressRecording[],
): TesterProgress {
  const address = email.toLowerCase();
  const account = contributors.find((c) => c.email?.toLowerCase() === address);
  const mine = recordings.filter(
    (r) => (account && r.contributor_id === account.id) || r.submitter_email?.toLowerCase() === address,
  );
  const last = mine.reduce<string | null>((latest, r) => (!latest || r.created_at > latest ? r.created_at : latest), null);
  return {
    signedIn: Boolean(account?.auth_user_id),
    uploads: mine.length,
    notListed: mine.filter((r) => r.placement_unlisted).length,
    lastUpload: last,
  };
}
