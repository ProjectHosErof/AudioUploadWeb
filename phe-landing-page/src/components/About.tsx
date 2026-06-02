const features = [
  {
    numeral: 'I',
    title: 'Share Your Faith',
    text: 'Upload your hymns and responses to help this project grow and keep our Coptic heritage alive for everyone.',
  },
  {
    numeral: 'II',
    title: 'Join the Community',
    text: 'Your participation strengthens this project and brings our Coptic Orthodox community closer through shared hymnology and tradition.',
  },
  {
    numeral: 'III',
    title: 'Preserve Tradition',
    text: 'Every contribution helps the project develop and ensures our sacred faith continues to grow with the community.',
  },
];

export function About() {
  return (
    <section
      id="about"
      style={{
        backgroundColor: 'var(--ink-soft)',
        borderTop: '1px solid var(--ink-mid)',
        borderBottom: '1px solid var(--ink-mid)',
        padding: 'clamp(4rem, 8vw, 6.5rem) 2rem',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div className="grid md:grid-cols-2 gap-16 md:gap-24">

          {/* Left: Mission statement */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.625rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--crimson-label)',
              marginBottom: '1.5rem',
            }}>
              About
            </p>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.25rem, 3.2vw, 3rem)',
              fontWeight: 300,
              lineHeight: 1.25,
              color: 'var(--parchment)',
              margin: '0 0 1.75rem',
            }}>
              Project Hos Erof
            </h2>
            <div style={{ width: '2.5rem', height: '1px', background: 'var(--crimson)', marginBottom: '1.75rem' }} />
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '1.1875rem',
              lineHeight: 1.85,
              color: 'var(--text-muted)',
              margin: '0 0 0.75em',
            }}>
              An initiative dedicated to preserving and sharing sacred hymns and
              responses from the Coptic Orthodox tradition.
            </p>
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '1.1875rem',
              lineHeight: 1.85,
              color: 'var(--text-muted)',
              margin: '0 0 0.75em',
            }}>
              We are building something special, and we need your support — and your recordings.
            </p>
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '1.1875rem',
              lineHeight: 1.85,
              color: 'var(--text-muted)',
              margin: 0,
            }}>
              This is Phase 1 of a larger initiative — your recordings are building the dataset that will power what comes next.
            </p>
          </div>

          {/* Right: Numbered features */}
          <div>
            {features.map((f) => (
              <div
                key={f.numeral}
                style={{ borderTop: '1px solid var(--ink-mid)', padding: '1.75rem 0' }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.875rem',
                  marginBottom: '0.625rem',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1rem',
                    fontWeight: 300,
                    color: 'var(--crimson-label)',
                    minWidth: '1.5rem',
                    letterSpacing: '0.05em',
                  }}>
                    {f.numeral}
                  </span>
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.5625rem',
                    fontWeight: 400,
                    color: 'var(--parchment)',
                    margin: 0,
                    lineHeight: 1.2,
                  }}>
                    {f.title}
                  </h3>
                </div>
                <p style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '1.1875rem',
                  lineHeight: 1.8,
                  color: 'var(--text-muted)',
                  margin: '0 0 0 2.375rem',
                }}>
                  {f.text}
                </p>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--ink-mid)' }} />
          </div>

        </div>
      </div>
    </section>
  );
}
