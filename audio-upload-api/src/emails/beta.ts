import { esc, greeting, paragraph, render } from './layout';

/**
 * The beta program's emails. Same voice as templates.ts: a person writing to
 * someone who offered their time. Every one except the confirmation carries a
 * "leave the beta" link; replies go to the support inbox (set by the sender).
 */

interface Built {
  subject: string;
  html: string;
  text: string;
}

/** The person's first name, for the greeting. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function leaveFootnote(leaveUrl: string): string {
  return `You're getting this because you joined the Project Hos Erof beta. <a href="${esc(leaveUrl)}" style="color:#9A8B6E;">Leave the beta</a> and we'll stop writing about it.`;
}
const leaveText = (leaveUrl: string) => `To leave the beta and stop these emails: ${leaveUrl}`;

/** The tasks, as in the Beta Tester Kit. */
export const BETA_TASKS: { title: string; detail: string }[] = [
  {
    title: 'Upload one hymn from your phone, without signing in.',
    detail: 'Pick the service, season, hymn and language, and choose a recording. Keep the reference on the thank-you screen.',
  },
  {
    title: 'Find a hymn that isn’t in the list.',
    detail: 'If the hymn you want isn’t offered, choose “My hymn isn’t listed” at the bottom of the list, and upload it.',
  },
  {
    title: 'Sign in and look at your contributions.',
    detail: 'Use “Continue with Google” or “Email me a sign-in link”, then open My Contributions.',
  },
  {
    title: 'Upload a second hymn using “Upload another”.',
    detail: 'Is a second upload quicker than the first?',
  },
  {
    title: 'Tell us one thing that confused you.',
    detail: 'Use the gold Beta badge at the top of any page, or hoserof.org/help — even if it’s small.',
  },
];

/** Step one of joining: confirm the address is theirs. */
export function betaConfirm(name: string, confirmUrl: string): Built {
  return {
    subject: 'Confirm you’d like to join the Project Hos Erof beta',
    html: render({
      preheader: 'One click and your request reaches us.',
      eyebrow: 'Beta',
      heading: 'One click to finish',
      body:
        greeting(firstName(name)) +
        paragraph('Thank you for offering to help test Project Hos Erof.') +
        paragraph('Confirm your address below and your request reaches us. We’ll write again once we’ve looked at it — usually within a few days.'),
      cta: { label: 'Confirm my request', url: confirmUrl },
      footnote: 'If you didn’t ask to join, you can ignore this message and we won’t write again.',
    }),
    text: [
      `Dear ${firstName(name)},`,
      '',
      'Thank you for offering to help test Project Hos Erof.',
      'Confirm your address here and your request reaches us:',
      confirmUrl,
      '',
      'If you didn’t ask to join, ignore this message and we won’t write again.',
    ].join('\n'),
  };
}

/** Sent on acceptance: what the beta is, the tasks, and how to reach us. */
export function betaWelcome(name: string, urls: { site: string; help: string; leave: string }): Built {
  const tasksHtml =
    '<ol style="margin:0 0 16px;padding-left:20px;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#C4B490;">' +
    BETA_TASKS.map((t) => `<li style="margin:0 0 10px;"><strong style="color:#F0E8D0;">${esc(t.title)}</strong><br>${esc(t.detail)}</li>`).join('') +
    '</ol>';
  return {
    subject: 'Welcome to the Project Hos Erof beta',
    html: render({
      preheader: 'Five small things to try, and how to tell us what you find.',
      eyebrow: 'Beta',
      heading: 'You’re in — thank you',
      body:
        greeting(firstName(name)) +
        paragraph('Thank you for joining the beta. What you notice over the next few weeks will shape the site before we share it with everyone.') +
        paragraph('<strong style="color:#F0E8D0;">Five things to try, at your own pace:</strong>') +
        tasksHtml +
        paragraph(`<strong style="color:#F0E8D0;">Tell us anything</strong> through the gold Beta badge on any page or <a href="${esc(urls.help)}" style="color:#C8922A;">the help page</a> — or simply reply to this email. We’ll write back, usually within two days.`) +
        paragraph('Your recordings are real contributions: once a reviewer approves them they join the collection, and you can ask us to remove one at any time. In about a week we’ll send three quick questions.'),
      cta: { label: 'Open Project Hos Erof', url: urls.site },
      footnote: leaveFootnote(urls.leave),
    }),
    text: [
      `Dear ${firstName(name)},`,
      '',
      'Thank you for joining the beta. What you notice over the next few weeks will shape the site.',
      '',
      'Five things to try, at your own pace:',
      ...BETA_TASKS.map((t, i) => `${i + 1}. ${t.title}\n   ${t.detail}`),
      '',
      `Tell us anything through the Beta badge, ${urls.help}, or by replying to this email.`,
      'Your recordings are real contributions; you can ask us to remove one at any time.',
      '',
      `Start here: ${urls.site}`,
      '',
      leaveText(urls.leave),
    ].join('\n'),
  };
}

/** Optional note on decline: kind, and the site stays open to them. */
export function betaDecline(name: string, siteUrl: string): Built {
  return {
    subject: 'About the Project Hos Erof beta',
    html: render({
      preheader: 'Thank you for offering — the site is open to you all the same.',
      eyebrow: 'Beta',
      heading: 'Thank you for offering',
      body:
        greeting(firstName(name)) +
        paragraph('Thank you for asking to join the beta. Our testing group is full for now, so we can’t add you this round.') +
        paragraph('The site is open to everyone, and your recordings are just as welcome there. We’d be glad to hear from you whenever you have a hymn to share.'),
      cta: { label: 'Visit Project Hos Erof', url: siteUrl },
      footnote: 'We won’t write about the beta again. This address isn’t added to any mailing list.',
    }),
    text: [
      `Dear ${firstName(name)},`,
      '',
      'Thank you for asking to join the beta. Our testing group is full for now, so we can’t add you this round.',
      'The site is open to everyone, and your recordings are just as welcome there:',
      siteUrl,
    ].join('\n'),
  };
}

/** Day 7: three questions, answered by replying. */
export function betaCheckin(name: string, urls: { help: string; leave: string }): Built {
  const questions = [
    'Have you uploaded a recording yet? If not, what got in the way?',
    'What was the most confusing moment so far?',
    'Is there a hymn your parish sings that you couldn’t find in the list?',
  ];
  return {
    subject: 'Three quick questions about Project Hos Erof',
    html: render({
      preheader: 'Reply with a line or two — it helps more than you’d think.',
      eyebrow: 'Beta · week one',
      heading: 'How is it going?',
      body:
        greeting(firstName(name)) +
        paragraph('Thank you for trying the site this week. Could you reply to this email with a line or two for each?') +
        '<ol style="margin:0 0 16px;padding-left:20px;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#C4B490;">' +
        questions.map((q) => `<li style="margin:0 0 8px;">${esc(q)}</li>`).join('') +
        '</ol>' +
        paragraph(`If something is broken, <a href="${esc(urls.help)}" style="color:#C8922A;">the help page</a> reaches us fastest.`),
      footnote: leaveFootnote(urls.leave),
    }),
    text: [
      `Dear ${firstName(name)},`,
      '',
      'Thank you for trying the site this week. Could you reply with a line or two for each?',
      '',
      ...questions.map((q, i) => `${i + 1}. ${q}`),
      '',
      `If something is broken, ${urls.help} reaches us fastest.`,
      '',
      leaveText(urls.leave),
    ].join('\n'),
  };
}

/** The end of the beta: thank you, and the survey. */
export function betaSurvey(name: string, urls: { survey: string; leave: string }): Built {
  return {
    subject: 'Thank you — one last favour for Project Hos Erof',
    html: render({
      preheader: 'Five minutes, twelve questions, and our thanks.',
      eyebrow: 'Beta · thank you',
      heading: 'Thank you for testing',
      body:
        greeting(firstName(name)) +
        paragraph('The beta is coming to a close, and we’re grateful for every recording, report and reply you sent.') +
        paragraph('One last favour: a short survey — twelve questions, about five minutes. It tells us what to fix before we open to everyone.') +
        paragraph('Your recordings stay in the collection, and the site stays open to you.'),
      cta: { label: 'Take the survey', url: urls.survey },
      footnote: leaveFootnote(urls.leave),
    }),
    text: [
      `Dear ${firstName(name)},`,
      '',
      'The beta is coming to a close, and we’re grateful for every recording, report and reply you sent.',
      'One last favour — a short survey, about five minutes:',
      urls.survey,
      '',
      'Your recordings stay in the collection, and the site stays open to you.',
      '',
      leaveText(urls.leave),
    ].join('\n'),
  };
}

/** For us: how many people are waiting for a decision. */
export function betaWaitingSummary(count: number, adminUrl: string): Built {
  const people = count === 1 ? '1 person is' : `${count} people are`;
  return {
    subject: `${people} waiting to join the beta`,
    html: render({
      preheader: 'Review them in the admin area.',
      eyebrow: 'Beta',
      heading: `${people} waiting`,
      body: paragraph(`${esc(people)} waiting for you to accept or decline them.`),
      cta: { label: 'Review requests', url: adminUrl },
    }),
    text: `${people} waiting for you to accept or decline them:\n${adminUrl}`,
  };
}
