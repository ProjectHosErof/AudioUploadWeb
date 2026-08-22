import type { EmailMessage } from '../lib/email';
import { esc, paragraph, render } from './layout';

/**
 * One function per message. Each returns subject + HTML + plain text so the
 * caller never assembles a message by hand.
 *
 * A note on tone: the recordings here are donated, often by people who are not
 * technical and who sang something meaningful to them. These read like a person
 * wrote them, not like a system emitted them.
 */

interface Built {
  subject: string;
  html: string;
  text: string;
}

/** Confirm a "Stay Informed" signup (double opt-in). */
export function confirmSubscription(confirmUrl: string): Built {
  return {
    subject: 'Confirm your email — Project Hos Erof',
    html: render({
      eyebrow: 'One more step',
      heading: 'Confirm your email',
      body:
        paragraph('Someone — hopefully you — asked to follow Project Hos Erof, an effort to preserve Coptic Orthodox hymns as a living archive.') +
        paragraph('Confirm below and we’ll write when there is something worth telling you about.'),
      cta: { label: 'Confirm', url: confirmUrl },
      footnote:
        'If this wasn’t you, ignore this message — nothing further will be sent, and the address is removed automatically.',
    }),
    text: [
      'Confirm your email — Project Hos Erof',
      '',
      'Someone — hopefully you — asked to follow Project Hos Erof, an effort to',
      'preserve Coptic Orthodox hymns as a living archive.',
      '',
      'Confirm here:',
      confirmUrl,
      '',
      'If this wasn’t you, ignore this message. Nothing further will be sent.',
    ].join('\n'),
  };
}

/** A recording passed moderation and is now part of the corpus. */
export function recordingAccepted(hymnLabel: string, dashboardUrl: string): Built {
  return {
    subject: `Your recording of "${hymnLabel}" is in the collection`,
    html: render({
      eyebrow: 'Your contribution',
      heading: 'It’s in the collection',
      body:
        paragraph(`Your recording of <strong style="color:#F0E8D0;font-weight:normal;">${esc(hymnLabel)}</strong> has been reviewed and added to the archive.`) +
        paragraph('It now sits alongside the other hymns preserved here, and will help teach a system to recognise them. Thank you for singing.'),
      cta: { label: 'View your contributions', url: dashboardUrl },
    }),
    text: [
      'It’s in the collection',
      '',
      `Your recording of "${hymnLabel}" has been reviewed and added to the archive.`,
      '',
      'It now sits alongside the other hymns preserved here, and will help teach a',
      'system to recognise them. Thank you for singing.',
      '',
      dashboardUrl,
    ].join('\n'),
  };
}

/**
 * A recording did not pass. The moderator's reason is shown verbatim — they
 * were told when writing it that the contributor would see it.
 */
export function recordingDeclined(hymnLabel: string, reason: string | null, uploadUrl: string): Built {
  const explanation = reason
    ? paragraph(`<span style="color:#9A8B6E;">Reason given:</span> ${esc(reason)}`)
    : '';

  return {
    subject: `About your recording of "${hymnLabel}"`,
    html: render({
      eyebrow: 'Your contribution',
      heading: 'Not added this time',
      body:
        paragraph(`Your recording of <strong style="color:#F0E8D0;font-weight:normal;">${esc(hymnLabel)}</strong> was reviewed, and it hasn’t been added to the collection.`) +
        explanation +
        paragraph('This is a judgement about one recording, not about you — and you’re very welcome to send another whenever you like.'),
      cta: { label: 'Contribute another', url: uploadUrl },
    }),
    text: [
      'Not added this time',
      '',
      `Your recording of "${hymnLabel}" was reviewed, and it hasn’t been added to`,
      'the collection.',
      ...(reason ? ['', `Reason given: ${reason}`] : []),
      '',
      'This is a judgement about one recording, not about you — and you’re very',
      'welcome to send another whenever you like.',
      '',
      uploadUrl,
    ].join('\n'),
  };
}

/** Convenience: attach a recipient to a built message. */
export function to(recipient: string, built: Built): EmailMessage {
  return { to: recipient, ...built };
}
