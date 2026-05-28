export function Nav() {
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
      <a
        href="#"
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
      </a>
      <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
        {[{ label: 'About', href: '#about' }, { label: 'Stay Informed', href: '#notify' }, { label: 'Upload', href: '#upload' }].map(({ label, href }) => (
          <a
            key={label}
            href={href}
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.625rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase' as const,
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
      </div>
    </nav>
  );
}
