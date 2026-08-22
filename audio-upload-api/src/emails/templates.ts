import type { EmailMessage } from '../lib/email';
import { esc, greeting, paragraph, render } from './layout';

/**
 * One function per message.
 *
 * On tone: the recordings here are donated, often by people who are not
 * technical, singing something they were taught by someone they loved. These
 * read like a person wrote them — gratitude first, mechanics second, and never
 * the passive voice of a system reporting a state change.
 *
 * The decline does the hardest work and gets the most care: it thanks the
 * contributor twice, explains without blaming, and makes clear that one
 * recording not making it says nothing about them.
 */

interface Built {
  subject: string;
  html: string;
  text: string;
}

/** Keep subject lines readable when a hymn title is very long. */
function trimTitle(label: string, max = 42): string {
  return label.length <= max ? label : `${label.slice(0, max - 1).trimEnd()}…`;
}

/** Confirm a "Stay Informed" signup (double opt-in). */
export function confirmSubscription(confirmUrl: string): Built {
  return {
    subject: 'Welcome — please confirm your email',
    html: render({
      preheader: 'One click and you’re on the list.',
      eyebrow: 'Welcome',
      heading: 'One click to go',
      body:
        paragraph('Thank you for wanting to follow along.') +
        paragraph('Project Hos Erof is a small effort with a large hope: to gather the hymns of the Coptic Orthodox Church — sung by the people who carry them — and keep them safe for whoever comes next.') +
        paragraph('Confirm your address below and we’ll write only when there’s something genuinely worth sharing. Rarely, in other words.'),
      cta: { label: 'Confirm my email', url: confirmUrl },
      footnote:
        'If you didn’t sign up, you can safely ignore this message — we won’t write again, and the address is removed on its own.',
    }),
    text: [
      'Welcome — please confirm your email',
      '',
      'Thank you for wanting to follow along.',
      '',
      'Project Hos Erof is a small effort with a large hope: to gather the hymns of',
      'the Coptic Orthodox Church — sung by the people who carry them — and keep',
      'them safe for whoever comes next.',
      '',
      'Confirm your address here, and we’ll write only when there’s something',
      'genuinely worth sharing:',
      confirmUrl,
      '',
      'If you didn’t sign up, you can safely ignore this message. We won’t write again.',
    ].join('\n'),
  };
}

/** Convenience: attach a recipient to a built message. */
export function to(recipient: string, built: Built): EmailMessage {
  return { to: recipient, ...built };
}

// ---------------------------------------------------------------------------
// Review digest
// ---------------------------------------------------------------------------

export interface DigestItem {
  hymnLabel: string;
  accepted: boolean;
  /** The moderator's note, shown verbatim on a decline. */
  reason: string | null;
}

const LIST_ITEM = 'margin:0 0 8px;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#C4B490;';

function acceptedList(items: DigestItem[]): string {
  return items
    .map((i) => `<p style="${LIST_ITEM}"><span style="color:#C8922A;">✦</span> <strong style="color:#F0E8D0;font-weight:normal;">${esc(i.hymnLabel)}</strong></p>`)
    .join('');
}

function declinedList(items: DigestItem[]): string {
  return items
    .map((i) => {
      const note = i.reason
        ? `<br><span style="color:#9A8B6E;font-size:14px;">What we noticed: ${esc(i.reason)}</span>`
        : '';
      return `<p style="${LIST_ITEM}"><strong style="color:#F0E8D0;font-weight:normal;">${esc(i.hymnLabel)}</strong>${note}</p>`;
    })
    .join('');
}

/**
 * One message covering every decision made about a contributor's recordings
 * since we last wrote to them.
 *
 * The copy has to read naturally at any size — a digest of one should sound
 * like a note about that recording, not like a report with a single row — so
 * the singular and plural cases are written out rather than pluralised
 * mechanically.
 */
export function reviewDigest(
  items: DigestItem[],
  firstName: string | null,
  urls: { dashboard: string; upload: string },
): Built {
  const accepted = items.filter((i) => i.accepted);
  const declined = items.filter((i) => !i.accepted);
  const onlyOne = items.length === 1;

  // --- Subject and heading, by shape of the news -------------------------
  let subject: string;
  let heading: string;
  let preheader: string;

  if (declined.length === 0) {
    subject = onlyOne
      ? `Thank you — “${trimTitle(accepted[0].hymnLabel)}” is now in the collection`
      : `Thank you — ${accepted.length} of your recordings are in the collection`;
    heading = onlyOne ? 'Your recording is in' : 'Your recordings are in';
    preheader = 'We listened, and your singing is now part of the archive.';
  } else if (accepted.length === 0) {
    subject = onlyOne
      ? `About your recording of “${trimTitle(declined[0].hymnLabel)}”`
      : `About ${declined.length} of your recordings`;
    heading = onlyOne ? 'Not this one — but thank you' : 'Not these ones — but thank you';
    preheader = 'We couldn’t add these — but please do send more.';
  } else {
    subject = `${accepted.length} of your recordings are in the collection`;
    heading = 'Your recordings have been reviewed';
    preheader = `${accepted.length} added to the archive, ${declined.length} we couldn’t use.`;
  }

  // --- Body ---------------------------------------------------------------
  const parts: string[] = [greeting(firstName)];

  if (accepted.length > 0) {
    parts.push(
      paragraph(
        onlyOne && declined.length === 0
          ? 'We listened to your recording, and it is now part of the archive:'
          : `We listened to everything you sent. ${accepted.length === 1 ? 'This one is' : 'These are'} now part of the archive:`,
      ),
      acceptedList(accepted),
      paragraph('That might sound like a small thing. It isn’t. Hymns like these have travelled from voice to voice for generations, mostly without ever being written down — and yours will help teach a system to recognise them, so that one day someone who hears one can simply ask what it is.'),
    );
  }

  if (declined.length > 0) {
    parts.push(
      paragraph(
        accepted.length > 0
          ? `We weren’t able to add ${declined.length === 1 ? 'one other recording' : `${declined.length} others`}:`
          : `We weren’t able to add ${declined.length === 1 ? 'this one' : 'these'} to the collection:`,
      ),
      declinedList(declined),
      paragraph('Please don’t let that discourage you. Nearly every recording we can’t use comes down to the room, the microphone, or a moment of noise passing through — rarely the singing itself. A quieter space or a phone held a little closer often makes all the difference.'),
    );
  }

  parts.push(paragraph('Thank you for taking the time to record and send these. We’d be very glad to hear from you again.'));

  // --- Plain text ---------------------------------------------------------
  const text = [
    heading,
    '',
    ...(firstName ? [`Dear ${firstName},`, ''] : []),
    ...(accepted.length
      ? [
          accepted.length === 1 && declined.length === 0
            ? 'We listened to your recording, and it is now part of the archive:'
            : 'We listened to everything you sent. Now part of the archive:',
          ...accepted.map((i) => `  * ${i.hymnLabel}`),
          '',
        ]
      : []),
    ...(declined.length
      ? [
          'We weren’t able to add:',
          ...declined.flatMap((i) => [
            `  * ${i.hymnLabel}`,
            ...(i.reason ? [`      What we noticed: ${i.reason}`] : []),
          ]),
          '',
          'Please don’t let that discourage you. Nearly every recording we can’t use',
          'comes down to the room, the microphone, or a moment of noise passing',
          'through — rarely the singing itself.',
          '',
        ]
      : []),
    'Thank you for taking the time to record and send these.',
    '',
    accepted.length > 0 ? urls.dashboard : urls.upload,
  ].join('\n');

  return {
    subject,
    html: render({
      preheader,
      eyebrow: accepted.length > 0 ? 'Thank you' : 'About your recordings',
      heading,
      body: parts.join(''),
      cta:
        accepted.length > 0
          ? { label: 'See your contributions', url: urls.dashboard }
          : { label: 'Try another recording', url: urls.upload },
    }),
    text,
  };
}
