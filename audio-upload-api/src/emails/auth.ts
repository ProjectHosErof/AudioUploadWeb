import { paragraph, render } from './layout';

/**
 * The sign-in emails. Supabase sends these (magic link, and "confirm signup"
 * on someone's first email sign-in), so they're pasted into its dashboard
 * rather than sent from here: `npm run emails:supabase` writes them to
 * supabase-templates/ from this file, and `check:emails` keeps those copies
 * current. They use the same layout as every other email.
 *
 * Supabase fills in Go-template variables when it sends, so the link is the
 * literal `{{ .ConfirmationURL }}`; esc() leaves it untouched.
 */

interface Built {
  subject: string;
  html: string;
  text: string;
}

/** Supabase's variable for the sign-in link. */
export const CONFIRMATION_URL = '{{ .ConfirmationURL }}';

const ignoreNote = 'Didn’t ask to sign in? You can ignore this email — nobody can sign in without this link.';

/** Supabase "Magic Link": a returning person asks for a sign-in link. */
export function signInLink(url = CONFIRMATION_URL): Built {
  return {
    subject: 'Your sign-in link for Project Hos Erof',
    html: render({
      preheader: 'Tap to sign in. The link works once.',
      eyebrow: 'Sign in',
      heading: 'Here’s your link',
      body:
        paragraph('Tap the button to sign in to Project Hos Erof.') +
        paragraph('The link works once and expires soon, so use it from this device if you can.'),
      cta: { label: 'Sign in', url },
      footnote: ignoreNote,
    }),
    text: [
      'Your sign-in link for Project Hos Erof',
      '',
      'Open this link to sign in. It works once and expires soon:',
      url,
      '',
      ignoreNote,
    ].join('\n'),
  };
}

/** Supabase "Confirm signup": someone's first sign-in with their email. */
export function confirmSignup(url = CONFIRMATION_URL): Built {
  return {
    subject: 'Confirm your email for Project Hos Erof',
    html: render({
      preheader: 'One tap to confirm it’s you and sign in.',
      eyebrow: 'Welcome',
      heading: 'One tap to finish',
      body:
        paragraph('Welcome to Project Hos Erof. Confirm this is your email and you’ll be signed in.') +
        paragraph('Once you’re in, you can see every recording you’ve shared and whether it has joined the collection.'),
      cta: { label: 'Confirm and sign in', url },
      footnote: ignoreNote,
    }),
    text: [
      'Confirm your email for Project Hos Erof',
      '',
      'Open this link to confirm it’s you and sign in:',
      url,
      '',
      'Once you’re in, you can see every recording you’ve shared and whether it has joined the collection.',
      '',
      ignoreNote,
    ].join('\n'),
  };
}

/** The dashboard templates, by Supabase's tab name and the file they're written to. */
export const SUPABASE_TEMPLATES = [
  { file: 'magic-link.html', tab: 'Magic Link', build: signInLink },
  { file: 'confirm-signup.html', tab: 'Confirm signup', build: confirmSignup },
] as const;
