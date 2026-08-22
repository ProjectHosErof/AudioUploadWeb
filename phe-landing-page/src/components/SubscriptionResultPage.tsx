import { Link, useSearchParams } from 'react-router-dom';
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
  eyebrow: string;
  heading: string;
  body: string;
}

const CONFIRMED: Record<string, Copy> = {
  ok: {
    eyebrow: 'Subscribed',
    heading: 'You’re on the list.',
    body: 'We’ll write when there is something worth telling you about — and not otherwise.',
  },
  unknown: {
    eyebrow: 'Link not recognised',
    heading: 'That link has expired.',
    body: 'It may already have been used, or been cut short by your mail client. Signing up again will send a fresh one.',
  },
  error: {
    eyebrow: 'Something went wrong',
    heading: 'We couldn’t confirm that.',
    body: 'Please try the link again in a moment. If it keeps failing, sign up again and we’ll send a new one.',
  },
};

const UNSUBSCRIBED: Record<string, Copy> = {
  ok: {
    eyebrow: 'Unsubscribed',
    heading: 'You won’t hear from us again.',
    body: 'Your address has been removed from the list. Any recordings you’ve contributed stay exactly as they are.',
  },
  unknown: {
    eyebrow: 'Link not recognised',
    heading: 'Nothing to remove.',
    body: 'That link doesn’t match a subscription — you may already have unsubscribed.',
  },
  error: {
    eyebrow: 'Something went wrong',
    heading: 'We couldn’t remove you.',
    body: 'Please try the link again in a moment.',
  },
};

export function SubscriptionResultPage({ variant }: { variant: 'confirmed' | 'unsubscribed' }) {
  const [params] = useSearchParams();
  const status = params.get('status') ?? 'ok';
  const table = variant === 'confirmed' ? CONFIRMED : UNSUBSCRIBED;
  const copy = table[status] ?? table.ok;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <Nav />

      <main
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
              fontSize: '0.625rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--crimson-label)',
              margin: '0 0 1.25rem',
            }}
          >
            {copy.eyebrow}
          </p>

          <p
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
          </p>

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

          <Link to="/" className="hero-cta" style={{ display: 'inline-block' }}>
            Return to the Archive
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
