import { useCallback, useEffect, useState } from 'react';
import { Nav } from './Nav';
import { usePageTitle } from '../lib/usePageTitle';
import {
  decideBeta,
  endBeta,
  fetchBeta,
  type BetaApplicant,
  type BetaOverview,
  type BetaTester,
} from '../services/moderation';

const LABELS: Record<string, string> = {
  iphone: 'iPhone', android: 'Android', tablet: 'Tablet', computer: 'Computer',
  chanter: 'Chanter or deacon', choir: 'Choir', parishioner: 'Parishioner', servant: 'Servant or teacher', other: 'Other',
  'under-25': 'Under 25', '25-44': '25–44', '45-64': '45–64', '65-plus': '65+',
};
const label = (v: string | null) => (v ? LABELS[v] ?? v : null);

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** No uploads five days after being accepted: probably stuck. */
const STUCK_AFTER_DAYS = 5;
function isStuck(t: BetaTester, now: number): boolean {
  return t.progress.uploads === 0 && Boolean(t.acceptedAt) && now - Date.parse(t.acceptedAt!) > STUCK_AFTER_DAYS * 86_400_000;
}

const eyebrow: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: '0.75rem', letterSpacing: '0.22em', textTransform: 'uppercase',
  color: 'var(--crimson-label)', margin: '0 0 1rem',
};
const muted: React.CSSProperties = { fontFamily: 'var(--font-ui)', fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 };
const card: React.CSSProperties = { border: '1px solid var(--ink-mid)', backgroundColor: 'var(--ink-soft)', padding: '1.25rem 1.5rem' };
const smallButton: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: '0.75rem', letterSpacing: '0.16em', textTransform: 'uppercase',
  padding: '0.625rem 1.125rem', cursor: 'pointer', background: 'transparent',
};

function WaitingCard({ a, onDecided, onError }: {
  a: BetaApplicant;
  onDecided: (id: string, decision: 'accept' | 'decline', emailed: boolean) => void;
  onError: (m: string) => void;
}) {
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const decide = async (decision: 'accept' | 'decline') => {
    setBusy(true);
    try {
      const { emailed } = await decideBeta(a.id, decision, notify);
      onDecided(a.id, decision, emailed);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not record that.');
      setBusy(false);
    }
  };
  const details = [a.parish, label(a.device), label(a.role), label(a.ageRange)].filter(Boolean).join(' · ');
  return (
    <li style={card}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 400, color: 'var(--parchment)', margin: '0 0 0.25rem' }}>{a.name}</h3>
      <p style={muted}>{a.email}</p>
      <p style={{ ...muted, marginTop: '0.25rem' }}>{details} · asked {formatDate(a.appliedAt)}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
        <button type="button" disabled={busy} onClick={() => decide('accept')} style={{ ...smallButton, color: 'var(--gold)', border: '1px solid var(--gold-muted)' }}>
          Accept
        </button>
        <button type="button" disabled={busy} onClick={() => decide('decline')} style={{ ...smallButton, color: 'var(--text-muted)', border: '1px solid var(--ink-mid)' }}>
          Decline
        </button>
        <label style={{ ...muted, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ accentColor: 'var(--gold)' }} />
          Send a short note if declined
        </label>
      </div>
    </li>
  );
}

function TestersTable({ testers, now }: { testers: BetaTester[]; now: number }) {
  return (
    <>
      {/* Phones: one card each. */}
      <ul className="beta-cards" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.75rem' }}>
        {testers.map((t) => (
          <li key={t.id} style={card}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--parchment)', margin: '0 0 0.25rem' }}>
              {t.name}{isStuck(t, now) && <span className="beta-stuck">May be stuck</span>}
            </p>
            <p style={muted}>{t.email}</p>
            <p style={{ ...muted, marginTop: '0.375rem' }}>
              Accepted {formatDate(t.acceptedAt)} · {t.progress.signedIn ? 'signed in' : 'not signed in'} · {t.progress.uploads} upload{t.progress.uploads === 1 ? '' : 's'}
              {t.progress.notListed > 0 && ` · ${t.progress.notListed} not listed`} · check-in {t.checkinSentAt ? formatDate(t.checkinSentAt) : 'not yet'}
            </p>
          </li>
        ))}
      </ul>
      {/* Wider screens: a table. */}
      <div className="beta-table">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)', fontSize: '0.9375rem', color: 'var(--text-muted)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--ink-mid)', textAlign: 'left' }}>
              {['Tester', 'Accepted', 'Signed in', 'Uploads', 'Not listed', 'Last upload', 'Check-in'].map((h) => (
                <th key={h} style={{ fontSize: '0.75rem', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500, padding: '0 1rem 0.75rem 0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {testers.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--ink-mid)' }}>
                <td style={{ padding: '0.875rem 1rem 0.875rem 0' }}>
                  <span style={{ color: 'var(--parchment)' }}>{t.name}</span>
                  {isStuck(t, now) && <span className="beta-stuck">May be stuck</span>}
                  <br /><span style={{ fontSize: '0.8125rem' }}>{t.email}</span>
                </td>
                <td>{formatDate(t.acceptedAt)}</td>
                <td>{t.progress.signedIn ? '✓' : '—'}</td>
                <td>{t.progress.uploads}</td>
                <td>{t.progress.notListed || '—'}</td>
                <td>{formatDate(t.progress.lastUpload)}</td>
                <td>{t.checkinSentAt ? formatDate(t.checkinSentAt) : 'not yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EndBeta({ testers, onDone }: { testers: BetaTester[]; onDone: () => void }) {
  const unsent = testers.filter((t) => !t.surveySentAt).length;
  const [url, setUrl] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const valid = /^https:\/\/\S+\.\S+/.test(url.trim());

  const send = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { sent, remaining } = await endBeta(url.trim());
      setMessage(remaining
        ? `Sent to ${sent}. ${remaining} still to go — press Send again to continue.`
        : `Sent to ${sent} tester${sent === 1 ? '' : 's'}. Thank you notes are on their way.`);
      setConfirming(false);
      onDone();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not send the survey.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ ...card, marginTop: '2.5rem' }} aria-labelledby="end-beta">
      <h2 id="end-beta" style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 400, color: 'var(--parchment)', margin: '0 0 0.5rem' }}>
        End the beta
      </h2>
      <p style={{ ...muted, marginBottom: '1rem' }}>
        Sends every tester a thank-you with the survey link. {unsent} haven’t had it yet.
      </p>
      <label className="codex-label" htmlFor="survey-url">Survey link</label>
      <input
        id="survey-url" type="url" className="codex-input" placeholder="https://forms.gle/…" value={url}
        onChange={(e) => { setUrl(e.target.value); setConfirming(false); }} style={{ width: '100%', marginBottom: '1rem' }}
      />
      {!confirming ? (
        <button type="button" disabled={!valid || unsent === 0} onClick={() => setConfirming(true)} style={{ ...smallButton, color: 'var(--gold)', border: '1px solid var(--gold-muted)', opacity: valid && unsent ? 1 : 0.5 }}>
          Send survey
        </button>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ ...muted, color: 'var(--parchment)' }}>Send to {unsent} tester{unsent === 1 ? '' : 's'}?</span>
          <button type="button" disabled={busy} onClick={send} style={{ ...smallButton, color: 'var(--gold)', border: '1px solid var(--gold-muted)' }}>
            {busy ? 'Sending…' : 'Yes, send'}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} style={{ ...smallButton, color: 'var(--text-muted)', border: '1px solid var(--ink-mid)' }}>
            Cancel
          </button>
        </div>
      )}
      {url.trim() && !valid && <p style={{ ...muted, color: 'var(--crimson-label)', marginTop: '0.75rem' }}>The link must start with https://</p>}
      {message && <p role="status" style={{ ...muted, color: 'var(--gold)', marginTop: '0.75rem' }}>{message}</p>}
    </section>
  );
}

/** Beta requests to decide, and how each tester is getting on. */
export function BetaAdminPage() {
  usePageTitle('Beta testers');
  const [data, setData] = useState<BetaOverview | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // When the page loaded: the "may be stuck" check compares against it.
  const [now] = useState(() => Date.now());

  /** Refresh after an action (accept, decline, survey sent). */
  const load = useCallback(async () => {
    try {
      setData(await fetchBeta());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the beta list.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchBeta()
      .then((overview) => { if (active) setData(overview); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Could not load the beta list.'); });
    return () => { active = false; };
  }, []);

  const onDecided = (id: string, decision: 'accept' | 'decline', emailed: boolean) => {
    const person = data?.waiting.find((w) => w.id === id)?.name ?? 'They';
    setNotice(decision === 'accept'
      ? `${person} is in.${emailed ? ' Their welcome email is on its way.' : ' The welcome email couldn’t be sent — check the email settings.'}`
      : `${person} was declined.${emailed ? ' A short note was sent.' : ''}`);
    void load();
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ink)' }}>
      <Nav />
      <main id="main" style={{ padding: 'calc(56px + clamp(2.5rem, 6vw, 4rem)) 1.25rem 4rem' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <p style={eyebrow}>Beta</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.25rem, 5vw, 3rem)', fontWeight: 300, color: 'var(--parchment)', lineHeight: 1.1, margin: '0 0 0.75rem' }}>
            Beta testers
          </h1>
          <p style={{ ...muted, fontSize: '1rem', marginBottom: '2rem' }}>
            Share <span style={{ color: 'var(--gold)' }}>hoserof.org/beta</span>. Requests appear here once the person confirms their email.
          </p>

          {error && <p role="alert" style={{ ...muted, color: 'var(--crimson-label)', marginBottom: '1.5rem' }}>{error}</p>}
          {notice && <p role="status" style={{ ...muted, color: 'var(--gold)', marginBottom: '1.5rem' }}>{notice}</p>}

          {!data && !error && <p style={muted}>Loading…</p>}

          {data && (
            <>
              <section aria-labelledby="waiting" style={{ marginBottom: '2.5rem' }}>
                <h2 id="waiting" style={eyebrow}>Waiting · {data.waiting.length}</h2>
                {data.waiting.length === 0 ? (
                  <p style={muted}>No one is waiting.</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.75rem' }}>
                    {data.waiting.map((a) => <WaitingCard key={a.id} a={a} onDecided={onDecided} onError={setError} />)}
                  </ul>
                )}
              </section>

              <section aria-labelledby="testers">
                <h2 id="testers" style={eyebrow}>Testers · {data.testers.length}</h2>
                {data.testers.length === 0 ? <p style={muted}>No testers yet.</p> : <TestersTable testers={data.testers} now={now} />}
              </section>

              <p style={{ ...muted, marginTop: '1.5rem' }}>
                Also: {data.counts.declined} declined · {data.counts.withdrawn} left · {data.counts.unconfirmed} haven’t confirmed their email
              </p>

              {data.testers.length > 0 && <EndBeta testers={data.testers} onDone={load} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
