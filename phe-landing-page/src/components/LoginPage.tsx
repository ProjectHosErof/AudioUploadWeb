import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export function LoginPage() {
  const { session, loading, enabled, signInWithGoogle, signInWithMagicLink } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState('');
  const [linkSent, setLinkSent] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  // Already signed in — don't show the door to someone already inside.
  if (!loading && session) return <Navigate to={from} replace />;

  const handleGoogle = async () => {
    setError('');
    setBusy('google');
    try {
      // Redirects away on success; nothing after this runs in the happy path.
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in.');
      setBusy(null);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setBusy('email');
    try {
      await signInWithMagicLink(email.trim());
      setLinkSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the sign-in link.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--ink)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 55% 45% at 50% 50%, rgba(200,146,42,0.065) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '400px',
        padding: '3.5rem 3rem 3rem',
        backgroundColor: 'var(--ink-soft)',
        border: '1px solid var(--ink-mid)',
        textAlign: 'center',
      }}>
        <span className="codex-corner codex-corner--tl" />
        <span className="codex-corner codex-corner--tr" />
        <span className="codex-corner codex-corner--bl" />
        <span className="codex-corner codex-corner--br" />

        {/* Gold ornament */}
        <p className="anim-1" style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.75rem',
          color: 'var(--gold)',
          letterSpacing: '0.55em',
          margin: '0 0 1.75rem',
        }}>
          ✦ ✦ ✦
        </p>

        {/* Brand mark */}
        <h1 className="anim-2" style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2rem, 5vw, 2.625rem)',
          fontWeight: 300,
          color: 'var(--parchment)',
          lineHeight: 1.15,
          margin: '0 0 1.25rem',
          letterSpacing: '0.02em',
        }}>
          Project Hos Erof
        </h1>

        {/* Crimson rule */}
        <div className="anim-2" style={{
          width: '2.5rem',
          height: '1px',
          background: 'var(--crimson)',
          margin: '0 auto 1.75rem',
        }} />

        {linkSent ? (
          /* --- Magic link sent --- */
          <>
            <p className="anim-3" style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '1rem',
              lineHeight: 1.7,
              color: 'var(--parchment)',
              margin: '0 0 0.75rem',
            }}>
              Check your email
            </p>
            <p className="anim-3" style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.9375rem',
              lineHeight: 1.7,
              color: 'var(--text-muted)',
              margin: '0 0 2rem',
            }}>
              We sent a sign-in link to <span style={{ color: 'var(--gold-light)' }}>{email}</span>.
              It opens your contributions directly.
            </p>
            <button
              onClick={() => { setLinkSent(false); setEmail(''); }}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.6875rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--gold-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Use a different email
            </button>
          </>
        ) : (
          <>
            {/* Tagline */}
            <p className="anim-3" style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '1rem',
              lineHeight: 1.7,
              color: 'var(--text-muted)',
              margin: '0 0 2.5rem',
            }}>
              Sign in to manage your contributions
            </p>

            {/* Google */}
            <button
              className="anim-4"
              onClick={handleGoogle}
              disabled={!enabled || busy !== null}
              style={{
                width: '100%',
                fontFamily: 'var(--font-ui)',
                fontSize: '0.75rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 500,
                color: 'var(--parchment)',
                backgroundColor: 'transparent',
                border: '1px solid var(--gold-muted)',
                padding: '1rem 2rem',
                cursor: !enabled || busy ? 'not-allowed' : 'pointer',
                opacity: !enabled || busy ? 0.6 : 1,
                transition: 'background-color 0.25s, color 0.25s, border-color 0.25s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
              }}
              onMouseEnter={e => {
                if (!enabled || busy) return;
                const b = e.currentTarget;
                b.style.backgroundColor = 'var(--gold-muted)';
                b.style.color = 'var(--ink)';
                b.style.borderColor = 'var(--gold)';
              }}
              onMouseLeave={e => {
                const b = e.currentTarget;
                b.style.backgroundColor = 'transparent';
                b.style.color = 'var(--parchment)';
                b.style.borderColor = 'var(--gold-muted)';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
            </button>

            {/* Divider */}
            <div className="anim-4" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              margin: '1.75rem 0',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--ink-mid)' }} />
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.625rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--gold-muted)',
              }}>
                or
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--ink-mid)' }} />
            </div>

            {/* Magic link */}
            <form className="anim-5" onSubmit={handleMagicLink} style={{ textAlign: 'left' }}>
              <label className="codex-label" htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                className="codex-input"
                placeholder="your.email@example.com"
                autoComplete="email"
                disabled={!enabled || busy !== null}
              />
              <button
                type="submit"
                disabled={!enabled || busy !== null}
                style={{
                  width: '100%',
                  marginTop: '0.875rem',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                  color: 'var(--parchment)',
                  backgroundColor: 'var(--crimson-deep)',
                  border: '1px solid var(--crimson)',
                  padding: '0.9rem 2rem',
                  cursor: !enabled || busy ? 'not-allowed' : 'pointer',
                  opacity: !enabled || busy ? 0.6 : 1,
                  transition: 'background-color 0.25s, border-color 0.25s',
                }}
              >
                {busy === 'email' ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>
          </>
        )}

        {!enabled && (
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.8125rem',
            fontStyle: 'italic',
            color: 'var(--gold-muted)',
            margin: '1.25rem 0 0',
          }}>
            Sign-in isn't configured yet.
          </p>
        )}

        {error && (
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.875rem',
            color: 'var(--crimson-label)',
            margin: '1.25rem 0 0',
          }}>
            {error}
          </p>
        )}

        {/* Heritage note */}
        <p className="anim-5" style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.6875rem',
          fontStyle: 'italic',
          color: 'var(--gold-muted)',
          margin: '1.75rem 0 0',
        }}>
          Your contributions are preserved for the community.
        </p>
      </div>
    </div>
  );
}
