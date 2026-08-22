import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

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
  padding: 0,
  cursor: 'pointer',
};

export function Nav() {
  const { session, enabled, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onLanding = location.pathname === '/';

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2rem',
      backgroundColor: 'rgba(26, 14, 8, 0.88)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--ink-mid)',
    }}>
      <Link
        to="/"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.1875rem',
          fontWeight: 300,
          letterSpacing: '0.03em',
          color: 'var(--parchment)',
          textDecoration: 'none',
        }}
      >
        Project Hos Erof
      </Link>
      <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
        {/* Section anchors only resolve on the landing page. */}
        {onLanding &&
          [{ label: 'About', href: '#about' }, { label: 'Stay Informed', href: '#notify' }, { label: 'Upload', href: '#upload' }].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              style={linkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--gold)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {label}
            </a>
          ))}

        {enabled && (
          session ? (
            <>
              <Link
                to="/dashboard"
                style={linkStyle}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--gold)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                My Contributions
              </Link>
              {/* Only rendered for moderators; the Worker is what enforces it. */}
              {isAdmin && (
                <Link
                  to="/admin"
                  style={{ ...linkStyle, color: 'var(--crimson-label)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--gold)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--crimson-label)')}
                >
                  Review Queue
                </Link>
              )}
              <button
                onClick={handleSignOut}
                style={linkStyle}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--gold)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              style={{ ...linkStyle, color: 'var(--gold-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--gold)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--gold-muted)')}
            >
              Sign In
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
