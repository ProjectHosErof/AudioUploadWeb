/**
 * Common questions, as native <details> disclosures: closed by default so they
 * don't push the rest of the page down, keyboard-operable without any script,
 * and announced as expandable by screen readers.
 */

const faqs = [
  {
    q: 'What happens to my recording?',
    a: 'A reviewer listens to it, and once approved it joins the collection. Your recording becomes part of a curated dataset used to develop a future Coptic Orthodox platform — this is Phase 1 of that larger initiative, and contributions made here are its foundation.',
  },
  {
    q: 'Is contributing free?',
    a: 'Completely free — and it always will be. Your recording is a gift to the community.',
  },
  {
    q: 'Will this be used for AI?',
    a: 'In time, the collection will help build a tool that recognises hymns and helps people learn them. Recordings are never sold, never published as a dataset, and never used to identify who is singing — see the Terms.',
  },
  {
    q: 'Will my personal information be shared?',
    a: 'No. We never sell your information or use it for advertising. An email address is only used to tell you about your recording and, if you opt in, for project updates. A few service providers handle it on our behalf — see the Privacy Policy.',
  },
];

export function Faq() {
  return (
    <section id="faq" style={{ backgroundColor: 'var(--ink)', padding: 'clamp(3rem, 6vw, 4.5rem) 2rem' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.75rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--crimson-label)',
          margin: '0 0 1.25rem',
          textAlign: 'center',
        }}>
          Common Questions
        </p>
        {faqs.map((item) => (
          <details key={item.q} className="codex-details codex-details--faq">
            <summary>{item.q}</summary>
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '1.0625rem',
              lineHeight: 1.75,
              color: 'var(--text-muted)',
              margin: '0.75rem 0 0',
            }}>
              {item.a}
            </p>
          </details>
        ))}
        <div style={{ borderTop: '1px solid var(--ink-mid)' }} />
      </div>
    </section>
  );
}
