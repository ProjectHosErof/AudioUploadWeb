import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { Nav } from './Nav';
import { Footer } from './Footer';
import { usePageTitle } from '../lib/usePageTitle';
import { useAuth } from '../auth/useAuth';
import { TURNSTILE_SITE_KEY } from '../config';
import { HelpError, sendHelpRequest, type HelpTopic } from '../services/help';

const SUPPORT_EMAIL = 'support@hoserof.org';

const TOPICS: { value: HelpTopic; label: string }[] = [
  { value: 'upload', label: 'Problem uploading' },
  { value: 'sign-in', label: 'Trouble signing in' },
  { value: 'remove', label: 'Remove my recording or my data' },
  { value: 'hymn', label: 'A hymn is wrong or missing' },
  { value: 'feedback', label: 'Feedback or an idea' },
  { value: 'other', label: 'Something else' },
];
const isTopic = (v: string | null): v is HelpTopic => TOPICS.some((t) => t.value === v);

const REF_RE = /^[0-9a-f]{8}$/i;
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

const labelStyle: React.CSSProperties = { display: 'block' };
const hintStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '0.8125rem',
  color: 'var(--text-muted)',
  margin: '0.375rem 0 0',
};

/**
 * "Get help": one form for problems, removal requests and feedback. It sends
 * an email to the support inbox and we answer by replying — no tickets, no
 * account needed. Links elsewhere on the site prefill the topic, the page
 * they came from and, after an upload, its reference.
 */
export function HelpPage() {
  usePageTitle('Get help', 'Ask for help with Project Hos Erof, request that a recording be removed, or send feedback.');
  const [params] = useSearchParams();
  const { session } = useAuth();
  const accountEmail = session?.user?.email ?? '';

  const [topic, setTopic] = useState<HelpTopic | null>(() => {
    const t = params.get('topic');
    return isTopic(t) ? t : null;
  });
  const [message, setMessage] = useState('');
  const [emailEdited, setEmailEdited] = useState(false);
  const [emailTyped, setEmailTyped] = useState('');
  const email = emailEdited ? emailTyped : emailTyped || accountEmail;
  const [name, setName] = useState('');
  const [reference, setReference] = useState(() => {
    const r = params.get('ref') ?? '';
    return REF_RE.test(r) ? r.toUpperCase() : '';
  });
  const page = params.get('from') ?? undefined;

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [sending, setSending] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const [sendError, setSendError] = useState('');
  // The email couldn't be sent: offer the address and keep the text to copy.
  const [fallback, setFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<{ reference: string; email: string } | null>(null);

  const errorRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => { if (focusRequest) errorRef.current?.focus(); }, [focusRequest]);
  useEffect(() => { if (sent) successRef.current?.focus(); }, [sent]);

  /** What's still missing, kept current as the form is filled in. */
  const missing = [
    !topic && 'what you need help with',
    message.trim().length < 10 && 'a few words about it',
    !isValidEmail(email.trim()) && 'an email address we can reply to',
  ].filter((m): m is string => Boolean(m));
  const refInvalid = reference !== '' && !REF_RE.test(reference);

  const checkMessage = showChecks && missing.length
    ? `Please add ${missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}` : missing[0]}.`
    : showChecks && refInvalid
      ? 'The recording reference is the 8 letters and numbers shown after an upload — or leave it empty.'
      : '';
  const shownError = checkMessage || sendError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSendError('');
    setFallback(false);
    setShowChecks(true);
    if (missing.length || refInvalid) {
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
      const ref = await sendHelpRequest({
        topic: topic!,
        message: message.trim(),
        email: email.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(reference ? { recording_ref: reference } : {}),
        ...(page ? { page } : {}),
        signed_in: Boolean(session),
        turnstile_token: turnstileToken,
      });
      setSent({ reference: ref, email: email.trim() });
    } catch (err) {
      const status = err instanceof HelpError ? err.status : undefined;
      if (status === undefined || status >= 500) setFallback(true);
      setSendError(err instanceof HelpError ? err.message : "We couldn't send that just now.");
      setFocusRequest((n) => n + 1);
    } finally {
      // Tokens are single-use: reset for a retry.
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      setSending(false);
    }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <Nav />
      <main id="main" style={{ flex: 1, padding: 'calc(56px + clamp(2.5rem, 6vw, 4rem)) 1.25rem clamp(3rem, 8vw, 5rem)' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.75rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--crimson-label)',
            margin: '0 0 1rem',
          }}>
            Support
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.25rem, 5vw, 3rem)',
            fontWeight: 300,
            color: 'var(--parchment)',
            lineHeight: 1.1,
            margin: '0 0 1rem',
          }}>
            Get help
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '1.0625rem', lineHeight: 1.7, color: 'var(--text-muted)', margin: '0 0 2.25rem' }}>
            Something not working, or an idea to share? Tell us here and we'll reply by email — usually
            within two days. You can also write to{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--gold)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>{SUPPORT_EMAIL}</a>.
          </p>

          <div style={{
            position: 'relative',
            border: '1px solid var(--ink-mid)',
            backgroundColor: 'var(--ink-soft)',
            padding: 'clamp(1.5rem, 4vw, 2.5rem)',
          }}>
            <span className="codex-corner codex-corner--tl" />
            <span className="codex-corner codex-corner--tr" />
            <span className="codex-corner codex-corner--bl" />
            <span className="codex-corner codex-corner--br" />

            {sent ? (
              <div ref={successRef} tabIndex={-1} role="status" style={{ textAlign: 'center', outline: 'none', padding: '0.5rem 0' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 4vw, 2.125rem)', fontWeight: 300, color: 'var(--parchment)', margin: '0 0 0.75rem' }}>
                  Thank you — we've got it.
                </p>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '1.0625rem', lineHeight: 1.7, color: 'var(--text-muted)', margin: 0 }}>
                  Your reference is{' '}
                  <span style={{ color: 'var(--gold)', letterSpacing: '0.06em' }}>#{sent.reference}</span>.
                  We'll reply to <span style={{ color: 'var(--parchment)' }}>{sent.email}</span>.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate aria-describedby={shownError ? 'help-error' : undefined}>
                <fieldset style={{ border: 'none', margin: '0 0 1.75rem', padding: 0 }}>
                  <legend className="codex-label" style={{ padding: 0 }}>What do you need help with? *</legend>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {TOPICS.map((t) => (
                      <label key={t.value} className="help-topic">
                        <input
                          type="radio"
                          name="topic"
                          value={t.value}
                          checked={topic === t.value}
                          onChange={() => setTopic(t.value)}
                        />
                        <span>{t.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="codex-label" htmlFor="help-message" style={labelStyle}>Your message *</label>
                  <textarea
                    id="help-message"
                    className="codex-input"
                    rows={6}
                    maxLength={4000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    aria-describedby="help-message-hint"
                    style={{ width: '100%', resize: 'vertical', minHeight: '8rem', lineHeight: 1.6 }}
                  />
                  <p id="help-message-hint" style={hintStyle}>
                    What happened, and what you expected. If it's about a recording, which hymn.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <label className="codex-label" htmlFor="help-email" style={labelStyle}>Email *</label>
                    <input
                      id="help-email"
                      type="email"
                      autoComplete="email"
                      className="codex-input"
                      value={email}
                      onChange={(e) => { setEmailEdited(true); setEmailTyped(e.target.value); }}
                      aria-describedby="help-email-hint"
                      style={{ width: '100%' }}
                    />
                    <p id="help-email-hint" style={hintStyle}>We'll reply here.</p>
                  </div>
                  <div>
                    <label className="codex-label" htmlFor="help-name" style={labelStyle}>Name (optional)</label>
                    <input
                      id="help-name"
                      type="text"
                      autoComplete="name"
                      className="codex-input"
                      maxLength={100}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1.75rem' }}>
                  <label className="codex-label" htmlFor="help-ref" style={labelStyle}>Recording reference (optional)</label>
                  <input
                    id="help-ref"
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="codex-input"
                    maxLength={8}
                    value={reference}
                    onChange={(e) => setReference(e.target.value.trim().toUpperCase())}
                    aria-describedby="help-ref-hint"
                    style={{ width: '100%', maxWidth: '14rem', letterSpacing: '0.08em' }}
                  />
                  <p id="help-ref-hint" style={hintStyle}>Shown on the thank-you screen after an upload, e.g. 0F1E2D3C.</p>
                </div>

                {TURNSTILE_SITE_KEY && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={TURNSTILE_SITE_KEY}
                      onSuccess={(token) => setTurnstileToken(token)}
                      onExpire={() => setTurnstileToken(null)}
                      onError={() => setTurnstileToken(null)}
                      options={{ theme: 'dark', action: 'help' }}
                    />
                  </div>
                )}

                {shownError && (
                  <div style={{ margin: '0 0 1rem' }}>
                    <p id="help-error" ref={errorRef} tabIndex={-1} role="alert" style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.9375rem',
                      color: 'var(--crimson-label)',
                      margin: 0,
                    }}>
                      {shownError}
                      {fallback && !checkMessage && (
                        <>
                          {' '}Please email{' '}
                          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--gold)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>{SUPPORT_EMAIL}</a>{' '}
                          instead — your message is still here to copy.
                        </>
                      )}
                    </p>
                    {fallback && !checkMessage && (
                      <button type="button" onClick={copyMessage} className="help-copy">
                        {copied ? 'Copied' : 'Copy my message'}
                      </button>
                    )}
                  </div>
                )}

                <button type="submit" disabled={sending} className="codex-submit">
                  {sending ? 'Sending…' : 'Send'}
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
