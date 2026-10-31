export function Hero() {
  return (
    <section
      style={{
        backgroundColor: 'var(--ink)',
        background: 'radial-gradient(ellipse at 50% -5%, rgba(200, 146, 42, 0.07) 0%, transparent 62%), var(--ink)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: '56px',
      }}
    >
      {/* Top accent rule */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, transparent 0%, var(--gold) 30%, var(--gold) 70%, transparent 100%)',
      }} />

      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: 'clamp(2.5rem, 7vh, 8rem) 1.5rem',
        width: '100%',
        position: 'relative',
      }}>

        {/* Phase label */}
        <div className="anim-1" style={{ textAlign: 'center', marginBottom: 'clamp(1.75rem, 5vh, 3.5rem)' }}>
          <span style={{
            display: 'inline-block',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.75rem',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            border: '1px solid var(--gold-muted)',
            padding: '0.4rem 1.25rem',
          }}>
            Phase 1 · Now collecting recordings
          </span>
        </div>

        {/* Title block */}
        <div className="anim-2" style={{ textAlign: 'center' }}>
          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, var(--ink-mid) 15%, var(--gold-muted) 50%, var(--ink-mid) 85%, transparent 100%)',
            marginBottom: 'clamp(1.25rem, 4vh, 2.5rem)',
          }} />

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(3rem, 7.5vw, 6.25rem)',
            fontWeight: 300,
            letterSpacing: '-0.01em',
            lineHeight: 1.05,
            color: 'var(--parchment)',
            margin: 0,
          }}>
            Project Hos Erof
          </h1>

          {/* The name, in Coptic, and what it means: the refrain sung after
              every verse of the Psalmody canticles. */}
          <p style={{ margin: '1rem 0 0', fontSize: 'clamp(1.125rem, 2.4vw, 1.375rem)', color: 'var(--gold)' }}>
            <span lang="cop" style={{ fontFamily: "'Noto Sans Coptic', var(--font-display)", letterSpacing: '0.04em' }}>
              ϩⲱⲥ ⲉⲣⲟϥ
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--gold-muted)' }}>
              {' · '}Praise Him
            </span>
          </p>

          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, var(--ink-mid) 15%, var(--crimson) 50%, var(--ink-mid) 85%, transparent 100%)',
            marginTop: 'clamp(1.25rem, 4vh, 2.5rem)',
          }} />
        </div>

        {/* Ornament */}
        <div className="anim-3" style={{ textAlign: 'center', margin: 'clamp(1rem, 3vh, 1.75rem) 0' }}>
          <span aria-hidden="true" style={{
            color: 'var(--gold)',
            fontSize: '0.8125rem',
            letterSpacing: '0.5em',
          }}>◆ ◆ ◆</span>
        </div>

        {/* Subtitle */}
        <div className="anim-4" style={{ textAlign: 'center', marginBottom: 'clamp(2rem, 5vh, 3.75rem)' }}>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.9375rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            margin: 0,
          }}>
            Every voice keeps the tradition alive
          </p>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '1.0625rem',
            lineHeight: 1.75,
            color: 'var(--text-muted)',
            maxWidth: '34rem',
            margin: '1.5rem auto 0',
          }}>
            Our hymns have been handed down from voice to voice for centuries. Record one on your
            phone — yourself, your choir, or your parish's cantor, with their blessing — and help
            preserve it for the next generation.
          </p>
        </div>

        {/* CTA */}
        <div className="anim-5" style={{ textAlign: 'center' }}>
          <a href="#upload" className="hero-cta">
            Add Your Voice
          </a>
          <div style={{ marginTop: '1.5rem' }}>
            <a
              href="#how-it-works"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.9375rem',
                letterSpacing: '0.04em',
                color: 'var(--parchment-dim)',
                textDecoration: 'underline',
                textUnderlineOffset: '4px',
                display: 'inline-block',
                padding: '0.5rem 0.25rem',
              }}
            >
              How it works →
            </a>
          </div>
        </div>

      </div>

      {/* Bottom accent rule */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, var(--ink-mid), transparent)',
      }} />
    </section>
  );
}
