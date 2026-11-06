import { Link, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '../lib/usePageTitle';
import { Nav } from './Nav';
import { Footer } from './Footer';

/**
 * Where the confirm and unsubscribe links in an email land.
 *
 * Both are reached by clicking a link in a mail client, often on a phone,
 * usually once — so this is a single quiet panel rather than a page with
 * anything to do. The `status` query parameter carries the unhappy paths:
 * `unknown` for a stale or mistyped token, `error` for a server failure.
 */

interface Copy {
  /** Browser tab title: says what happened, like the heading does. */
  title: string;
  eyebrow: string;
  heading: string;
  body: string;
  /** Offer a fresh signup when the link couldn't be used. */
  signUpAgain?: boolean;
}

const CONFIRMED: Record<string, Copy> = {
  ok: {
    title: 'Subscription confirmed',
    eyebrow: 'Subscribed',
    heading: 'You’re on the list.',
    body: 'We’ll write when there is something worth telling you about — and not otherwise.',
  },
  unknown: {
    title: 'Link expired',
    eyebrow: 'Link not recognized',
    heading: 'That link has expired.',
    body: 'It may already have been used, or been cut short by your mail client. Signing up again will send a fresh one.',
    signUpAgain: true,
  },
  error: {
    title: 'Couldn’t confirm',
    eyebrow: 'Something went wrong',
    heading: 'We couldn’t confirm that.',
    body: 'Please try the link again in a moment. If it keeps failing, sign up again and we’ll send a new one.',
    signUpAgain: true,
  },
};

const UNSUBSCRIBED: Record<string, Copy> = {
  ok: {
    title: 'Unsubscribed',
    eyebrow: 'Unsubscribed',
    heading: 'You won’t hear from us again.',
    body: 'Your address has been removed from the list. Any recordings you’ve contributed stay exactly as they are.',
  },
  unknown: {
    title: 'Nothing to remove',
    eyebrow: 'Link not recognized',
    heading: 'Nothing to remove.',
    body: 'That link doesn’t match a subscription — you may already have unsubscribed.',
  },
  error: {
    title: 'Couldn’t unsubscribe',
    eyebrow: 'Something went wrong',
    heading: 'We couldn’t remove you.',
    body: 'Please try the link again in a moment, or write to contact@hoserof.org and we’ll remove you.',
  },
};

const BETA_CONFIRMED: Record<string, Copy> = {
  ok: {
    title: 'Request received',
    eyebrow: 'Beta',
    heading: 'Thank you — we’ve got your request.',
    body: 'We’ll look at it and write within a few days. In the meantime the site is open to you like everyone else.',
  },
  unknown: {
    title: 'Link not recognized',
    eyebrow: 'Link not recognized',
    heading: 'That link didn’t work.',
    body: 'It may have expired or been cut short by your mail client. Asking to join again will send a fresh one.',
    signUpAgain: true,
  },
  error: {
    title: 'Couldn’t confirm',
    eyebrow: 'Something went wrong',
    heading: 'We couldn’t confirm that.',
    body: 'Please try the link again in a moment. If it keeps failing, ask to join again and we’ll send a new one.',
    signUpAgain: true,
  },
};

const BETA_LEFT: Record<string, Copy> = {
  ok: {
    title: 'You’ve left the beta',
    eyebrow: 'Beta',
    heading: 'You’ve left the beta.',
    body: 'We won’t write about it again. Your recordings stay exactly as they are, and the site stays open to you.',
  },
  unknown: {
    title: 'Nothing to leave',
    eyebrow: 'Link not recognized',
    heading: 'Nothing to leave.',
    body: 'That link doesn’t match anyone in the beta — you may already have left.',
  },
  error: {
    title: 'Couldn’t remove you',
    eyebrow: 'Something went wrong',
    heading: 'We couldn’t take you off the beta.',
    body: 'Please try the link again in a moment, or write to support@hoserof.org and we’ll do it for you.',
  },
};

type Variant = 'confirmed' | 'unsubscribed' | 'beta-confirmed' | 'beta-left';
const TABLES: Record<Variant, Record<string, Copy>> = {
  confirmed: CONFIRMED,
  unsubscribed: UNSUBSCRIBED,
  'beta-confirmed': BETA_CONFIRMED,
  'beta-left': BETA_LEFT,
};

export function SubscriptionResultPage({ variant }: { variant: Variant }) {
  const [params] = useSearchParams();
  const status = params.get('status') ?? 'ok';
  const table = TABLES[variant];
  const copy = table[status] ?? table.ok;
  usePageTitle(copy.title);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <Nav />

      <main
        id="main"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'calc(56px + 3rem) 2rem 4rem',
        }}
      >
        <div
          style={{
            position: 'relative',
            maxWidth: '520px',
            width: '100%',
            textAlign: 'center',
            padding: 'clamp(2.5rem, 6vw, 3.5rem) clamp(1.5rem, 4vw, 2.5rem)',
            border: '1px solid var(--ink-mid)',
            backgroundColor: 'var(--ink-soft)',
          }}
        >
          <span className="codex-corner codex-corner--tl" />
          <span className="codex-corner codex-corner--tr" />
          <span className="codex-corner codex-corner--bl" />
          <span className="codex-corner codex-corner--br" />

          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.75rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--crimson-label)',
              margin: '0 0 1.25rem',
            }}
          >
            {copy.eyebrow}
          </p>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.75rem, 4vw, 2.25rem)',
              fontWeight: 300,
              lineHeight: 1.2,
              color: 'var(--parchment)',
              margin: '0 0 1rem',
            }}
          >
            {copy.heading}
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '1rem',
              lineHeight: 1.7,
              color: 'var(--text-muted)',
              margin: '0 0 2rem',
            }}
          >
            {copy.body}
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {copy.signUpAgain && (
              <Link to={variant.startsWith('beta') ? '/beta' : '/#notify'} className="hero-cta" style={{ display: 'inline-block' }}>
                {variant.startsWith('beta') ? 'Ask to join again' : 'Sign up again'}
              </Link>
            )}
            <Link
              to="/"
              className="hero-cta"
              style={{ display: 'inline-block', ...(copy.signUpAgain ? { background: 'transparent' } : {}) }}
            >
              Return to Project Hos Erof
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
