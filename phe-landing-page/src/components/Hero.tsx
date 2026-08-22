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
        padding: 'clamp(5rem, 10vh, 8rem) 2rem',
        width: '100%',
        position: 'relative',
      }}>

        {/* Coming Soon label */}
        <div className="anim-1" style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <span style={{
            display: 'inline-block',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.5875rem',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            border: '1px solid var(--gold-muted)',
            padding: '0.4rem 1.25rem',
          }}>
            Coming Soon
          </span>
        </div>

        {/* Title block */}
        <div className="anim-2" style={{ textAlign: 'center' }}>
          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, var(--ink-mid) 15%, var(--gold-muted) 50%, var(--ink-mid) 85%, transparent 100%)',
            marginBottom: '2.5rem',
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

          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, var(--ink-mid) 15%, var(--crimson) 50%, var(--ink-mid) 85%, transparent 100%)',
            marginTop: '2.5rem',
          }} />
        </div>

        {/* Ornament */}
        <div className="anim-3" style={{ textAlign: 'center', margin: '1.75rem 0' }}>
          <span style={{
            color: 'var(--gold)',
            fontSize: '0.8125rem',
            letterSpacing: '0.5em',
          }}>◆ ◆ ◆</span>
        </div>

        {/* Subtitle */}
        <div className="anim-4" style={{ textAlign: 'center', marginBottom: '3.75rem' }}>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.9375rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            margin: 0,
          }}>
            Paving the future of Coptic Orthodox hymnology
          </p>
        </div>

        {/* CTA */}
        <div className="anim-5" style={{ textAlign: 'center' }}>
          <a href="#upload" className="hero-cta">
            Upload Your Hymn Recording
          </a>
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
