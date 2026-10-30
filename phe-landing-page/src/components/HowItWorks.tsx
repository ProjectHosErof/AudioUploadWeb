import { CommunityCounter } from './CounterSection';

/**
 * Three steps, right after the hero, so a visitor knows what contributing
 * involves before they reach the form — and the collection's progress beside
 * them. Styled like About's numbered list.
 */

const steps = [
  {
    numeral: 'I',
    title: 'Record',
    text: 'Sing or record a hymn on your phone — any quality is welcome.',
  },
  {
    numeral: 'II',
    title: 'Share',
    text: 'Choose the season, service and hymn, then upload. It takes about a minute.',
  },
  {
    numeral: 'III',
    title: 'Preserve',
    text: "A reviewer listens, then it joins the collection. We'll email you when it does.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      style={{
        backgroundColor: 'var(--ink-soft)',
        borderTop: '1px solid var(--ink-mid)',
        borderBottom: '1px solid var(--ink-mid)',
        padding: 'clamp(3.5rem, 7vw, 5.5rem) 2rem',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div className="grid md:grid-cols-2 gap-14 md:gap-24" style={{ alignItems: 'center' }}>

          <div>
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.75rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--crimson-label)',
              margin: '0 0 1.25rem',
            }}>
              How It Works
            </p>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {steps.map((s) => (
                <li key={s.numeral} style={{ borderTop: '1px solid var(--ink-mid)', padding: '1.25rem 0' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.875rem', marginBottom: '0.375rem' }}>
                    <span aria-hidden="true" style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1rem',
                      fontWeight: 300,
                      color: 'var(--crimson-label)',
                      minWidth: '1.5rem',
                      letterSpacing: '0.05em',
                    }}>
                      {s.numeral}
                    </span>
                    <h3 style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.5rem',
                      fontWeight: 400,
                      color: 'var(--parchment)',
                      margin: 0,
                      lineHeight: 1.2,
                    }}>
                      {s.title}
                    </h3>
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '1.0625rem',
                    lineHeight: 1.7,
                    color: 'var(--text-muted)',
                    margin: '0 0 0 2.375rem',
                  }}>
                    {s.text}
                  </p>
                </li>
              ))}
            </ol>
            <div style={{ borderTop: '1px solid var(--ink-mid)' }} />
          </div>

          <CommunityCounter />

        </div>
      </div>
    </section>
  );
}
