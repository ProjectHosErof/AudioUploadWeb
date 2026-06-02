import { useState } from 'react';

export function NotifySection() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setSubmitted(true);
  };

  return (
    <section id="notify" style={{
      backgroundColor: 'var(--ink-soft)',
      borderTop: '1px solid var(--ink-mid)',
      borderBottom: '1px solid var(--ink-mid)',
      padding: 'clamp(4rem, 8vw, 6rem) 2rem',
    }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>

        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.625rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--crimson-label)',
          marginBottom: '1.5rem',
        }}>
          Stay Informed
        </p>

        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2rem, 3vw, 2.75rem)',
          fontWeight: 300,
          lineHeight: 1.2,
          color: 'var(--parchment)',
          margin: '0 0 1.25rem',
        }}>
          Follow the Project
        </h2>

        <div style={{ width: '2.5rem', height: '1px', background: 'var(--crimson)', margin: '0 auto 1.75rem' }} />

        {submitted ? (
          <div style={{ padding: '2rem', border: '1px solid var(--ink-mid)', backgroundColor: 'var(--ink-soft)' }}>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              fontWeight: 300,
              color: 'var(--parchment)',
              margin: '0 0 0.5rem',
            }}>
              You're on the list.
            </p>
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '1.0625rem',
              color: 'var(--text-muted)',
              margin: 0,
            }}>
              We'll be in touch as the project grows.
            </p>
          </div>
        ) : (
          <>
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '1.0625rem',
              lineHeight: 1.8,
              color: 'var(--text-muted)',
              margin: '0 0 2.5rem',
            }}>
              Don't have a recording to share yet? Enter your email and we'll keep you updated as the project grows.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: error ? '0.5rem' : 0 }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                  className={`codex-input${error ? ' codex-input--error' : ''}`}
                  placeholder="your.email@example.com"
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="notify-cta"
                >
                  Notify Me
                </button>
              </div>
              {error && (
                <p style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.875rem',
                  color: 'var(--crimson-label)',
                  margin: '0 0 0',
                  textAlign: 'left',
                }}>
                  {error}
                </p>
              )}
            </form>

            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.75rem',
              color: 'var(--gold-muted)',
              fontStyle: 'italic',
              margin: '1.25rem 0 0',
            }}>
              No spam — project updates only.
            </p>
          </>
        )}

      </div>
    </section>
  );
}
