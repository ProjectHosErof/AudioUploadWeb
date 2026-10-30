import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

/**
 * Site navigation. Wide screens show the links inline; below 1024px they fold
 * into a menu button, because six links (when signed in) need about 980px —
 * on anything narrower they'd push the page sideways.
 *
 * Every page that renders <Nav /> must have a <main id="main"> for the skip
 * link to land on.
 */

const linkStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '0.8125rem',
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  color: 'var(--text-muted)',
  textDecoration: 'none',
  transition: 'color 0.2s',
  background: 'none',
  border: 'none',
  // Pads the hit area to ≥24px tall (WCAG 2.2 target size) without moving text.
  padding: '0.5rem 0',
  cursor: 'pointer',
};

const hoverOn = (color: string) => (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.color = color);

export function Nav() {
  const { session, enabled, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onLanding = location.pathname === '/';
  const [open, setOpen] = useState(false);

  // Links close the menu as they're followed (onClick below); Escape closes it too.
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate('/');
  };

  const current = (path: string) => (location.pathname === path ? 'page' as const : undefined);
  const color = (path: string, base = 'var(--text-muted)') => (location.pathname === path ? 'var(--gold)' : base);

  const links = (
    <>
      {/* Section anchors only resolve on the landing page. */}
      {onLanding &&
        [{ label: 'How It Works', href: '#how-it-works' }, { label: 'Upload', href: '#upload' }, { label: 'About', href: '#about' }].map(({ label, href }) => (
          <a
            key={label}
            href={href}
            onClick={close}
            style={linkStyle}
            onMouseEnter={hoverOn('var(--gold)')}
            onMouseLeave={hoverOn('var(--text-muted)')}
          >
            {label}
          </a>
        ))}

      {enabled && (
        session ? (
          <>
            <Link
              to="/dashboard"
              onClick={close}
              aria-current={current('/dashboard')}
              style={{ ...linkStyle, color: color('/dashboard') }}
              onMouseEnter={hoverOn('var(--gold)')}
              onMouseLeave={hoverOn(color('/dashboard'))}
            >
              My Contributions
            </Link>
            {/* Only rendered for moderators; the Worker is what enforces it. */}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={close}
                aria-current={current('/admin')}
                style={{ ...linkStyle, color: color('/admin', 'var(--crimson-label)') }}
                onMouseEnter={hoverOn('var(--gold)')}
                onMouseLeave={hoverOn(color('/admin', 'var(--crimson-label)'))}
              >
                Review Queue
              </Link>
            )}
            <button
              onClick={handleSignOut}
              style={linkStyle}
              onMouseEnter={hoverOn('var(--gold)')}
              onMouseLeave={hoverOn('var(--text-muted)')}
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link
            to="/login"
            onClick={close}
            aria-current={current('/login')}
            style={{ ...linkStyle, color: color('/login', 'var(--gold-muted)') }}
            onMouseEnter={hoverOn('var(--gold)')}
            onMouseLeave={hoverOn(color('/login', 'var(--gold-muted)'))}
          >
            Sign In
          </Link>
        )
      )}
    </>
  );

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <nav
        aria-label="Main"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(1rem, 4vw, 2rem)',
          backgroundColor: 'rgba(26, 14, 8, 0.88)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--ink-mid)',
        }}
      >
        <Link
          to="/"
          onClick={close}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.1875rem',
            fontWeight: 300,
            letterSpacing: '0.03em',
            color: 'var(--parchment)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Project Hos Erof
        </Link>

        {/* Wide screens: inline. */}
        <div className="nav-links-inline">{links}</div>

        {/* Narrow screens: a menu button and a drop-down panel. */}
        <button
          className="nav-menu-button"
          aria-expanded={open}
          aria-controls="nav-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
        </button>
        {open && (
          <div id="nav-menu" className="nav-menu-panel">
            {links}
          </div>
        )}
      </nav>
    </>
  );
}
