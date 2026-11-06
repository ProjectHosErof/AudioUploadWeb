import { confirmSubscription, reviewDigest, supportRequest } from './templates';
import { betaCheckin, betaConfirm, betaDecline, betaSurvey, betaWaitingSummary, betaWelcome } from './beta';
import { confirmSignup, signInLink } from './auth';

/**
 * Every email the project sends, with realistic sample data, in the order a
 * person meets them. `npm run emails:preview` renders this list into a page;
 * gallery.test.ts fails if a template is added without an entry here.
 */

export interface GalleryEntry {
  id: string;
  /** The template function this shows (checked by the test). */
  template: string;
  name: string;
  when: string;
  recipient: string;
  build: () => { subject: string; html: string; text: string };
}

const SITE = 'https://hoserof.org';
const API = 'https://api.hoserof.org';
const digestUrls = { dashboard: `${SITE}/dashboard`, upload: `${SITE}/#upload` };
const leave = `${API}/beta/leave/sample-token`;

export const GALLERY: GalleryEntry[] = [
  {
    id: 'sign-in-link', template: 'signInLink', name: 'Sign-in link',
    when: 'Someone asks for a sign-in link on /login. Sent by Supabase — paste from supabase-templates/.',
    recipient: 'The person signing in',
    build: () => signInLink(`${SITE}/dashboard#sample-sign-in-link`),
  },
  {
    id: 'confirm-signup', template: 'confirmSignup', name: 'Confirm signup',
    when: 'Someone signs in with their email for the first time. Sent by Supabase — paste from supabase-templates/.',
    recipient: 'A new contributor',
    build: () => confirmSignup(`${SITE}/dashboard#sample-confirm-link`),
  },
  {
    id: 'newsletter-confirm', template: 'confirmSubscription', name: 'Newsletter: confirm your email',
    when: 'Someone joins "Stay Informed" or ticks the updates box when uploading.',
    recipient: 'The subscriber',
    build: () => confirmSubscription(`${API}/subscribe/confirm/sample-token`),
  },
  {
    id: 'digest-accepted', template: 'reviewDigest', name: 'Review digest: accepted',
    when: 'Daily at 16:00 UTC, after a reviewer accepts a recording.',
    recipient: 'The contributor (their email or account)',
    build: () => reviewDigest([{ hymnLabel: 'Tenen (The Song of the Three Saintly Children)', accepted: true, reason: null }], 'Marina', digestUrls),
  },
  {
    id: 'digest-declined', template: 'reviewDigest', name: 'Review digest: declined, with a reason',
    when: 'Daily at 16:00 UTC, after a reviewer declines a recording.',
    recipient: 'The contributor',
    build: () => reviewDigest([{ hymnLabel: 'Golgotha', accepted: false, reason: 'The recording cuts off halfway through the second verse.' }], 'Marina', digestUrls),
  },
  {
    id: 'digest-mixed', template: 'reviewDigest', name: 'Review digest: some accepted, one declined',
    when: 'Daily at 16:00 UTC, after several decisions.',
    recipient: 'The contributor',
    build: () =>
      reviewDigest(
        [
          { hymnLabel: 'Tenen', accepted: true, reason: null },
          { hymnLabel: 'Psalm 150 — Annual', accepted: true, reason: null },
          { hymnLabel: 'Golgotha', accepted: false, reason: 'Heavy background noise from the hall.' },
        ],
        'Marina',
        digestUrls,
      ),
  },
  {
    id: 'beta-confirm', template: 'betaConfirm', name: 'Beta: confirm your request',
    when: 'Someone asks to join at /beta.',
    recipient: 'The applicant',
    build: () => betaConfirm('Marina Gerges', `${API}/beta/confirm/sample-token`),
  },
  {
    id: 'beta-welcome', template: 'betaWelcome', name: 'Beta: welcome, with the five tasks',
    when: 'You press Accept on /admin/beta.',
    recipient: 'The new tester',
    build: () => betaWelcome('Marina Gerges', { site: SITE, help: `${SITE}/help?topic=feedback`, leave }),
  },
  {
    id: 'beta-decline', template: 'betaDecline', name: 'Beta: a kind decline',
    when: 'You press Decline with "Send a short note" ticked.',
    recipient: 'The applicant',
    build: () => betaDecline('Bishoy Fahmy', SITE),
  },
  {
    id: 'beta-checkin', template: 'betaCheckin', name: 'Beta: day-7 check-in',
    when: 'Automatically, 7 days after acceptance (daily job).',
    recipient: 'The tester — replies come to support@',
    build: () => betaCheckin('Marina Gerges', { help: `${SITE}/help?topic=feedback`, leave }),
  },
  {
    id: 'beta-survey', template: 'betaSurvey', name: 'Beta: thank you and the survey',
    when: 'You press End the beta on /admin/beta.',
    recipient: 'Every tester',
    build: () => betaSurvey('Marina Gerges', { survey: 'https://forms.gle/sample', leave }),
  },
  {
    id: 'beta-waiting', template: 'betaWaitingSummary', name: 'Beta: people are waiting',
    when: 'Daily job, only when someone is waiting for a decision.',
    recipient: 'You (support@hoserof.org)',
    build: () => betaWaitingSummary(3, `${SITE}/admin/beta`),
  },
  {
    id: 'support-request', template: 'supportRequest', name: 'Get help request',
    when: 'Someone sends the form at /help. Reply-To is them.',
    recipient: 'You (support@hoserof.org)',
    build: () =>
      supportRequest(
        {
          topic: 'upload',
          message: 'The upload stopped at 40% twice on my iPhone.\nI tried on Wi-Fi too.',
          email: 'marina@example.com',
          name: 'Marina Gerges',
          recording_ref: '0F1E2D3C',
          page: '/',
          signed_in: false,
          turnstile_token: 'sample',
        },
        { reference: 'K7Q2XM', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)', receivedAt: new Date('2026-11-06T20:15:00Z') },
      ),
  },
];
