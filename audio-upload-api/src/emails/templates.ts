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

/** A recording passed moderation and is now part of the corpus. */
export function recordingAccepted(
  hymnLabel: string,
  dashboardUrl: string,
  firstName: string | null,
): Built {
  return {
    subject: `Thank you — “${trimTitle(hymnLabel)}” is now in the collection`,
    html: render({
      preheader: 'We listened, and your recording has been added to the archive.',
      eyebrow: 'Thank you',
      heading: 'Your recording is in',
      body:
        greeting(firstName) +
        paragraph(`We listened to your recording of <strong style="color:#F0E8D0;font-weight:normal;">${esc(hymnLabel)}</strong>, and it is now part of the archive.`) +
        paragraph('That might sound like a small thing. It isn’t. Hymns like this one have travelled from voice to voice for generations, mostly without ever being written down. Yours is now among the recordings that will hold on to it — and that will teach a system to recognise it, so that one day someone who hears it can simply ask what it is.') +
        paragraph('Thank you for taking the time to record it, and for trusting us with it.'),
      cta: { label: 'See your contributions', url: dashboardUrl },
    }),
    text: [
      'Your recording is in',
      '',
      ...(firstName ? [`Dear ${firstName},`, ''] : []),
      `We listened to your recording of "${hymnLabel}", and it is now part of the`,
      'archive.',
      '',
      'That might sound like a small thing. It isn’t. Hymns like this one have',
      'travelled from voice to voice for generations, mostly without ever being',
      'written down. Yours is now among the recordings that will hold on to it —',
      'and that will teach a system to recognise it, so that one day someone who',
      'hears it can simply ask what it is.',
      '',
      'Thank you for taking the time to record it, and for trusting us with it.',
      '',
      dashboardUrl,
    ].join('\n'),
  };
}

/**
 * A recording did not pass. The moderator's reason is shown verbatim — they
 * were told when writing it that the contributor would see it.
 */
export function recordingDeclined(
  hymnLabel: string,
  reason: string | null,
  uploadUrl: string,
  firstName: string | null,
): Built {
  // Framed as an observation rather than a verdict: "what we noticed" invites
  // a second attempt in a way that "reason given" does not.
  const noted = reason
    ? paragraph(`<span style="color:#9A8B6E;">What we noticed:</span> ${esc(reason)}`)
    : '';

  return {
    subject: `About your recording of “${trimTitle(hymnLabel)}”`,
    html: render({
      preheader: 'We couldn’t add this one — but please do send another.',
      eyebrow: 'About your recording',
      heading: 'Not this one — but thank you',
      body:
        greeting(firstName) +
        paragraph(`We listened to your recording of <strong style="color:#F0E8D0;font-weight:normal;">${esc(hymnLabel)}</strong>. After review, we weren’t able to add this one to the collection.`) +
        noted +
        paragraph('Please don’t let that discourage you. Nearly every recording we can’t use comes down to the room, the microphone, or a moment of noise passing through — rarely the singing itself. A quieter space or a phone held a little closer often makes all the difference.') +
        paragraph('Thank you for taking the time to record and send it. We’d be very glad to hear from you again.'),
      cta: { label: 'Try another recording', url: uploadUrl },
    }),
    text: [
      'Not this one — but thank you',
      '',
      ...(firstName ? [`Dear ${firstName},`, ''] : []),
      `We listened to your recording of "${hymnLabel}". After review, we weren’t`,
      'able to add this one to the collection.',
      ...(reason ? ['', `What we noticed: ${reason}`] : []),
      '',
      'Please don’t let that discourage you. Nearly every recording we can’t use',
      'comes down to the room, the microphone, or a moment of noise passing',
      'through — rarely the singing itself. A quieter space or a phone held a',
      'little closer often makes all the difference.',
      '',
      'Thank you for taking the time to record and send it. We’d be very glad to',
      'hear from you again.',
      '',
      uploadUrl,
    ].join('\n'),
  };
}

/** Convenience: attach a recipient to a built message. */
export function to(recipient: string, built: Built): EmailMessage {
  return { to: recipient, ...built };
}
