export function Footer() {
  return (
    <footer style={{
      backgroundColor: 'var(--ink)',
      borderTop: '1px solid var(--ink-mid)',
      padding: 'clamp(3rem, 6vw, 5rem) 2rem 2rem',
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Ornament */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span style={{ color: 'var(--gold-muted)', fontSize: '0.625rem', letterSpacing: '0.5em' }}>◆ ◆ ◆</span>
        </div>

        {/* Main columns */}
        <div className="grid md:grid-cols-3 gap-12" style={{ marginBottom: '3rem' }}>

          {/* Brand */}
          <div className="md:col-span-2">
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
              fontWeight: 300,
              color: 'var(--parchment)',
              margin: '0 0 0.875rem',
            }}>
              Project Hos Erof
            </p>
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '1.0625rem',
              lineHeight: 1.75,
              color: 'var(--text-muted)',
              margin: 0,
              maxWidth: '460px',
            }}>
              An open initiative to preserve and share the sacred hymns and responses of the Coptic Orthodox tradition — for the community, by the community.
            </p>
          </div>

          {/* Nav links */}
          <div>
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.625rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--crimson-label)',
              marginBottom: '1.25rem',
            }}>
              Navigate
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[
                { label: 'About', href: '#about' },
                { label: 'Upload a Recording', href: '#upload' },
                { label: 'Stay Informed', href: '#notify' },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '1rem',
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--gold)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  {label}
                </a>
              ))}
              <div style={{ borderTop: '1px solid var(--ink-mid)', paddingTop: '0.875rem', marginTop: '0.125rem' }}>
                <p style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.625rem',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--crimson-label)',
                  margin: '0 0 0.625rem',
                }}>
                  Contact
                </p>
                <a
                  href="mailto:contact@projecthoserof.com"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '1rem',
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--gold)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  contact@projecthoserof.com
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: '1px solid var(--ink-mid)',
          paddingTop: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            margin: 0,
            letterSpacing: '0.04em',
          }}>
            © 2026 Project Hos Erof. All rights reserved.
          </p>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.75rem',
            color: 'var(--gold-muted)',
            fontStyle: 'italic',
            margin: 0,
          }}>
            For the glory of God and the preservation of our heritage.
          </p>
        </div>

      </div>
    </footer>
  );
}
