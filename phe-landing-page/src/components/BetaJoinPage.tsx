import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { Nav } from './Nav';
import { Footer } from './Footer';
import { usePageTitle } from '../lib/usePageTitle';
import { useAuth } from '../auth/useAuth';
import { TURNSTILE_SITE_KEY } from '../config';
import { applyForBeta, BetaError, type BetaAge, type BetaDevice, type BetaRole } from '../services/beta';

const DEVICES: { value: BetaDevice; label: string }[] = [
  { value: 'iphone', label: 'iPhone' },
  { value: 'android', label: 'Android phone' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'computer', label: 'Computer' },
];
const ROLES: { value: BetaRole; label: string }[] = [
  { value: 'chanter', label: 'Chanter or deacon' },
  { value: 'choir', label: 'Choir member' },
  { value: 'parishioner', label: 'Parishioner' },
  { value: 'servant', label: 'Servant or teacher' },
  { value: 'other', label: 'Something else' },
];
const AGES: { value: BetaAge; label: string }[] = [
  { value: 'under-25', label: 'Under 25' },
  { value: '25-44', label: '25–44' },
  { value: '45-64', label: '45–64' },
  { value: '65-plus', label: '65 or over' },
];

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
const hint: React.CSSProperties = { fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.375rem 0 0' };

/** A labelled group of radio rows (the help page's topic style). */
function Choices<T extends string>(props: {
  legend: string;
  name: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset style={{ border: 'none', margin: '0 0 1.75rem', padding: 0 }}>
      <legend className="codex-label" style={{ padding: 0 }}>{props.legend}</legend>
      <div className="grid sm:grid-cols-2 gap-2">
        {props.options.map((o) => (
          <label key={o.value} className="help-topic">
            <input type="radio" name={props.name} value={o.value} checked={props.value === o.value} onChange={() => props.onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * "Join the beta": the open link shared in parish groups. The request is
 * confirmed by email, then reviewed; accepted testers get a welcome with five
 * things to try. The site stays open to everyone either way.
 */
export function BetaJoinPage() {
  usePageTitle('Join the beta', 'Help test Project Hos Erof before it opens to everyone: five small tasks and two short surveys.');
  const { session } = useAuth();
  const accountEmail = session?.user?.email ?? '';

  const [name, setName] = useState('');
  const [emailEdited, setEmailEdited] = useState(false);
  const [emailTyped, setEmailTyped] = useState('');
  const email = emailEdited ? emailTyped : emailTyped || accountEmail;
  const [parish, setParish] = useState('');
  const [device, setDevice] = useState<BetaDevice | null>(null);
  const [role, setRole] = useState<BetaRole | null>(null);
  const [age, setAge] = useState<BetaAge | null>(null);
  const [consent, setConsent] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [sending, setSending] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  const errorRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => { if (focusRequest) errorRef.current?.focus(); }, [focusRequest]);
  useEffect(() => { if (sent) successRef.current?.focus(); }, [sent]);

  const missing = [
    !name.trim() && 'your name',
    !isValidEmail(email.trim()) && 'an email address',
    !device && 'the device you’ll mostly use',
    !consent && 'your OK to email you about the beta',
  ].filter((m): m is string => Boolean(m));
  const checkMessage = showChecks && missing.length
    ? `Please add ${missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}` : missing[0]}.`
    : '';
  const shownError = checkMessage || sendError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSendError('');
    setShowChecks(true);
    if (missing.length) {
      setFocusRequest((n) => n + 1);
      return;
    }
    if (!TURNSTILE_SITE_KEY || !turnstileToken) {
      setSendError('Please complete the verification check just above the button.');
      setFocusRequest((n) => n + 1);
      return;
    }
    setSending(true);
    try {
      await applyForBeta({
        name: name.trim(),
        email: email.trim(),
        ...(parish.trim() ? { parish: parish.trim() } : {}),
        device: device!,
        ...(role ? { role } : {}),
        ...(age ? { age_range: age } : {}),
        consent: true,
        turnstile_token: turnstileToken,
      });
      setSent(email.trim());
    } catch (err) {
      setSendError(err instanceof BetaError ? err.message : 'We couldn’t send your request just now. Please try again in a moment.');
      setFocusRequest((n) => n + 1);
    } finally {
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      setSending(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <Nav />
      <main id="main" style={{ flex: 1, padding: 'calc(56px + clamp(2.5rem, 6vw, 4rem)) 1.25rem clamp(3rem, 8vw, 5rem)' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--crimson-label)', margin: '0 0 1rem' }}>
            Beta
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.25rem, 5vw, 3rem)', fontWeight: 300, color: 'var(--parchment)', lineHeight: 1.1, margin: '0 0 1rem' }}>
            Join the beta
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '1.0625rem', lineHeight: 1.7, color: 'var(--text-muted)', margin: '0 0 1rem' }}>
            Help us test Project Hos Erof before it opens to everyone. Over about three weeks you’ll try
            five small things — like uploading a hymn from your phone — and answer two short surveys.
          </p>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '1.0625rem', lineHeight: 1.7, color: 'var(--text-muted)', margin: '0 0 2.25rem' }}>
            The site stays open to everyone whether or not you join —{' '}
            <Link to="/#upload" style={{ color: 'var(--gold)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>you can share a recording now</Link>.
          </p>

          <div style={{ position: 'relative', border: '1px solid var(--ink-mid)', backgroundColor: 'var(--ink-soft)', padding: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
            <span className="codex-corner codex-corner--tl" />
            <span className="codex-corner codex-corner--tr" />
            <span className="codex-corner codex-corner--bl" />
            <span className="codex-corner codex-corner--br" />

            {sent ? (
              <div ref={successRef} tabIndex={-1} role="status" style={{ textAlign: 'center', outline: 'none', padding: '0.5rem 0' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 4vw, 2.125rem)', fontWeight: 300, color: 'var(--parchment)', margin: '0 0 0.75rem' }}>
                  Check your email.
                </p>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '1.0625rem', lineHeight: 1.7, color: 'var(--text-muted)', margin: 0 }}>
                  We sent a link to <span style={{ color: 'var(--parchment)' }}>{sent}</span>. Follow it to confirm your
                  request, and we’ll be in touch within a few days.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate aria-describedby={shownError ? 'beta-error' : undefined}>
                <div className="grid sm:grid-cols-2 gap-4" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <label className="codex-label" htmlFor="beta-name">Name *</label>
                    <input id="beta-name" type="text" autoComplete="name" className="codex-input" maxLength={100}
                      value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label className="codex-label" htmlFor="beta-email">Email *</label>
                    <input id="beta-email" type="email" autoComplete="email" className="codex-input"
                      value={email} onChange={(e) => { setEmailEdited(true); setEmailTyped(e.target.value); }} style={{ width: '100%' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '1.75rem' }}>
                  <label className="codex-label" htmlFor="beta-parish">Parish or city (optional)</label>
                  <input id="beta-parish" type="text" className="codex-input" maxLength={120}
                    value={parish} onChange={(e) => setParish(e.target.value)} aria-describedby="beta-parish-hint" style={{ width: '100%' }} />
                  <p id="beta-parish-hint" style={hint}>Helps us include testers from different parishes.</p>
                </div>

                <Choices legend="Which device will you mostly use? *" name="device" options={DEVICES} value={device} onChange={setDevice} />
                <Choices legend="How are you involved? (optional)" name="role" options={ROLES} value={role} onChange={setRole} />
                <Choices legend="Age range (optional)" name="age" options={AGES} value={age} onChange={setAge} />

                <label className="codex-checkbox-row" style={{ marginBottom: '1.5rem' }}>
                  <input type="checkbox" className="codex-checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <div>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: '1.0625rem', fontWeight: 500, color: 'var(--parchment)', margin: '0 0 0.3rem' }}>
                      Email me about the beta *
                    </p>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>
                      A welcome with what to try, a check-in after a week, and a survey at the end. I can leave any
                      time. See the{' '}
                      <Link to="/privacy" style={{ color: 'var(--gold)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Privacy Policy</Link>.
                    </p>
                  </div>
                </label>

                {TURNSTILE_SITE_KEY && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <Turnstile ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY}
                      onSuccess={(token) => setTurnstileToken(token)} onExpire={() => setTurnstileToken(null)} onError={() => setTurnstileToken(null)}
                      options={{ theme: 'dark', action: 'beta' }} />
                  </div>
                )}

                {shownError && (
                  <p id="beta-error" ref={errorRef} tabIndex={-1} role="alert"
                    style={{ fontFamily: 'var(--font-ui)', fontSize: '0.9375rem', color: 'var(--crimson-label)', margin: '0 0 1rem' }}>
                    {shownError}
                  </p>
                )}

                <button type="submit" disabled={sending} className="codex-submit">
                  {sending ? 'Sending…' : 'Ask to join'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
