import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Nav } from './Nav';
import { Footer } from './Footer';
import { usePageTitle } from '../lib/usePageTitle';

/**
 * Unknown URLs. Previously these silently showed the home page, so a broken
 * link gave no hint anything was wrong and search engines could index the
 * bad address as a copy of the home page.
 *
 * Cloudflare Pages serves index.html with HTTP 200 for every app route, so
 * the "not found" signal to crawlers is the noindex tag added here.
 */
export function NotFoundPage() {
  usePageTitle('Page not found');

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

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
          padding: 'calc(56px + 3rem) 1rem 4rem',
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

          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.75rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--crimson-label)',
            margin: '0 0 1.25rem',
          }}>
            404
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.75rem, 4vw, 2.25rem)',
            fontWeight: 300,
            lineHeight: 1.2,
            color: 'var(--parchment)',
            margin: '0 0 1rem',
          }}>
            Page not found
          </h1>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '1rem',
            lineHeight: 1.7,
            color: 'var(--text-muted)',
            margin: '0 0 2rem',
          }}>
            That link may be mistyped or out of date.
          </p>
          <Link to="/" className="hero-cta" style={{ display: 'inline-block' }}>
            Return to Project Hos Erof
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
