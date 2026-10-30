import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Music, CheckCircle2 } from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import Select, { type MultiValue, type SingleValue } from "react-select";
import {
  hymnsFor,
  language_options,
  service_options,
  season_options,
} from "../options.data";
import type { HymnGroup, SelectOption } from "../options.data";
import { TURNSTILE_SITE_KEY } from "../config";
import { TERMS_VERSION } from "../legal/terms";
import { ACCEPTED_AUDIO, ACCEPTED_AUDIO_LABEL, MAX_UPLOAD_BYTES, resolveContentType, uploadRecording, UploadError } from "../services/uploadApi";
import { useAuth } from '../auth/useAuth';

const serviceTypes = [
  'St. Basil / St. Gregory / St. Cyril Divine Liturgy',
  'Matins & Vespers',
  'Vesper Praises',
  'Morning & Midnight Praises',
  'Melodies',
  'Ceremonies (Baptism, Crowning, Ordination)',
  'Venerations',
  'and more',
];

/** Bytes → "12.3 MB". */
function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadForm() {
  const { session } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedService, setSelectedService] = useState<SelectOption | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<SelectOption | null>(null);
  const [selectedHymn, setSelectedHymn] = useState<SelectOption | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<readonly SelectOption[]>([]);
  const [checked, setChecked] = useState(false);
  // Agreement to the Terms + Contributor License; required, and sent with the
  // upload so the recording records which license version it was given under.
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState("");
  // Set after a successful upload; replaces the form with a thank-you panel.
  const [submitted, setSubmitted] = useState<{ reference: string } | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  // Warn before closing the tab mid-upload: the file would be lost.
  useEffect(() => {
    if (!isSubmitting) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isSubmitting]);

  // Move focus to the result so screen-reader and keyboard users hear it.
  useEffect(() => { if (submitted) successRef.current?.focus(); }, [submitted]);

  /** Check type and size as soon as a file is chosen, not after uploading. */
  function chooseFile(f: File | null) {
    setFile(f);
    if (!f) { setFileError(""); return; }
    if (!resolveContentType(f)) {
      setFileError(`That file type isn't supported. Please use ${ACCEPTED_AUDIO_LABEL}.`);
    } else if (f.size > MAX_UPLOAD_BYTES) {
      setFileError(`That file is ${formatSize(f.size)}; the limit is ${formatSize(MAX_UPLOAD_BYTES)}.`);
    } else {
      setFileError("");
    }
  }

  function fail(message: string) {
    setSubmitError(message);
    // Bring the message into view and to screen readers' attention.
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  const isHymnDisabled = !selectedService || !selectedSeason;
  const isLanguageDisabled = !selectedService || !selectedSeason;

  // Only the hymns said in the chosen season + service (the API enforces the
  // same rule), grouped by hymn type.
  const hymnChoices = useMemo(
    () => (selectedSeason && selectedService ? hymnsFor(selectedSeason.value, selectedService.value) : null),
    [selectedSeason, selectedService],
  );

  /** After a season/service change, keep the hymn only if it is still listed. */
  function keepHymnIfListed(season: SelectOption | null, service: SelectOption | null) {
    const stillListed =
      season && service && selectedHymn &&
      hymnsFor(season.value, service.value).groups.some((g) => g.options.some((o) => o.value === selectedHymn.value));
    if (!stillListed) setSelectedHymn(null);
    if (!season || !service) setSelectedLanguage([]);
  }

  function isValidEmail(e: string): boolean {
    if (!e || e.length === 0 || e.length > 254) return false;
    return /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(e);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    // The form is noValidate, so every check happens here, with a message the
    // user can see (a hidden file input can't show the browser's own bubble).
    const missing = [
      !selectedService && "a service",
      !selectedSeason && "a season",
      !selectedHymn && "a hymn",
      selectedLanguage.length === 0 && "at least one language",
      !file && "an audio file",
    ].filter(Boolean);
    if (missing.length) {
      const list = missing.length > 1
        ? `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`
        : missing[0];
      fail(`Please choose ${list}.`);
      return;
    }
    if (fileError) {
      fail(fileError);
      return;
    }
    if (!agreedToTerms) {
      fail("Please confirm you agree to the Terms and Contributor License.");
      return;
    }
    if (checked && (!email || !isValidEmail(email))) {
      setEmailError("Please enter a valid email address.");
      fail("Please enter a valid email address, or untick the updates box.");
      return;
    }
    setEmailError("");

    const contentType = resolveContentType(file!);
    if (!contentType) {
      fail(`That file type isn't supported. Please use ${ACCEPTED_AUDIO_LABEL}.`);
      return;
    }
    if (!TURNSTILE_SITE_KEY) {
      fail("Verification isn't configured yet. Please try again later.");
      return;
    }
    if (!turnstileToken) {
      fail("Please complete the verification check just above the button.");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    try {
      const recordingId = await uploadRecording(
        {
          service_slug: selectedService!.value,
          season_slug: selectedSeason!.value,
          hymn_slug: selectedHymn!.value,
          languages: selectedLanguage.map((l) => l.value),
          content_type: contentType,
          size_bytes: file!.size,
          original_filename: file!.name,
          wants_updates: checked,
          email: checked && email ? email : undefined,
          turnstile_token: turnstileToken,
          accepted_terms_version: TERMS_VERSION,
          file: file!,
        },
        (pct) => setUploadProgress(pct),
      );

      setSelectedService(null);
      setSelectedSeason(null);
      setSelectedHymn(null);
      setSelectedLanguage([]);
      setFile(null);
      setChecked(false);
      setAgreedToTerms(false);
      setEmail("");
      setEmailError("");
      setUploadProgress(null);
      setSubmitted({ reference: recordingId.slice(0, 8).toUpperCase() });
    } catch (err) {
      setUploadProgress(null);
      fail(err instanceof UploadError ? err.message : "Something went wrong. Please try again.");
    } finally {
      // A Turnstile token is single-use — reset the widget for the next attempt.
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      setIsSubmitting(false);
    }
  };

  return (
    <section id="upload" style={{ backgroundColor: 'var(--ink)', padding: 'clamp(4rem, 8vw, 6.5rem) 2rem' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* Section header — h2 size intentionally unchanged */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.75rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--crimson-label)',
            marginBottom: '1.5rem',
          }}>
            Contribute
          </p>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.25rem, 3.5vw, 3.25rem)',
            fontWeight: 300,
            lineHeight: 1.15,
            color: 'var(--parchment)',
            margin: '0 0 1.5rem',
          }}>
            Upload Your Recording
          </h2>
          <div style={{ width: '2.5rem', height: '1px', background: 'var(--crimson)', margin: '0 auto' }} />
        </div>

        {/* What we need — the short version, then the full guidelines on demand */}
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '1.0625rem',
          lineHeight: 1.75,
          color: 'var(--text-muted)',
          textAlign: 'center',
          maxWidth: '36rem',
          margin: '0 auto 1rem',
        }}>
          Short hymns and responses from any season or service — please, not full liturgies.
          Any audio quality is welcome; phone recordings are perfect.
        </p>
        <details className="codex-details" style={{ margin: '0 auto 2.5rem', maxWidth: '36rem' }}>
          <summary>What to record — full guidelines</summary>
          <div style={{ paddingTop: '1rem' }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '1.0625rem', lineHeight: 1.75, color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
              These recordings will form a training dataset for a future platform currently in development for the Coptic Orthodox community.
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '1.0625rem', lineHeight: 1.75, color: 'var(--text-muted)', margin: '0 0 1rem' }}>
              We are looking for hymns and responses across different feasts, seasons, and tunes. Please do{' '}
              <em style={{ color: 'var(--parchment-dim)' }}>not</em> submit entire liturgies or full service recordings.
              Hymns and responses from services such as:
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', listStyle: 'disc' }}>
              {serviceTypes.map((s) => (
                <li key={s} style={{ fontFamily: 'var(--font-ui)', fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-muted)' }}>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </details>

        {/* Form panel with corner accents */}
        <div style={{
          border: '1px solid var(--ink-mid)',
          padding: 'clamp(1.75rem, 4vw, 2.75rem)',
          backgroundColor: 'var(--ink-soft)',
          position: 'relative',
        }}>
          <span className="codex-corner codex-corner--tl" />
          <span className="codex-corner codex-corner--tr" />
          <span className="codex-corner codex-corner--bl" />
          <span className="codex-corner codex-corner--br" />

          {submitted ? (
            <div ref={successRef} tabIndex={-1} role="status" style={{ textAlign: 'center', padding: '1rem 0', outline: 'none' }}>
              <CheckCircle2 aria-hidden="true" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--gold)', margin: '0 auto 1.25rem' }} />
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', fontWeight: 300, color: 'var(--parchment)', margin: '0 0 0.75rem' }}>
                Thank you — your recording is in.
              </p>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '1.0625rem', lineHeight: 1.7, color: 'var(--text-muted)', margin: '0 auto 0.5rem', maxWidth: '34rem' }}>
                A reviewer will listen to it soon. If you gave us your email or are signed in,
                we'll write once it's been reviewed.
              </p>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.875rem', color: 'var(--gold-muted)', margin: '0 0 2rem' }}>
                Reference: <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.08em' }}>{submitted.reference}</span>
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="hero-cta" onClick={() => setSubmitted(null)}>
                  Upload another
                </button>
                <a href={session ? '/dashboard' : '/login'} className="hero-cta" style={{ background: 'transparent' }}>
                  {session ? 'See my contributions' : 'Sign in to track it'}
                </a>
              </div>
            </div>
          ) : (
          <form onSubmit={handleSubmit} noValidate aria-describedby={submitError ? 'upload-error' : undefined}>

            {/* Service & Season */}
            <div className="grid sm:grid-cols-2 gap-4" style={{ marginBottom: '1.5rem' }}>
              <div>
                <label className="codex-label" htmlFor="upload-service">Service *</label>
                <div className="rs-dark">
                  <Select
                    classNamePrefix="react-select"
                    inputId="upload-service"
                    options={service_options}
                    value={selectedService}
                    onChange={(option: SingleValue<SelectOption>) => {
                      setSelectedService(option);
                      keepHymnIfListed(selectedSeason, option);
                    }}
                    placeholder="Select service"
                    isClearable
                  />
                </div>
              </div>
              <div>
                <label className="codex-label" htmlFor="upload-season">Season *</label>
                <div className="rs-dark">
                  <Select
                    classNamePrefix="react-select"
                    inputId="upload-season"
                    options={season_options}
                    value={selectedSeason}
                    onChange={(option: SingleValue<SelectOption>) => {
                      setSelectedSeason(option);
                      keepHymnIfListed(option, selectedService);
                    }}
                    placeholder="Select season"
                    isClearable
                  />
                </div>
              </div>
            </div>

            {/* Hymn & Language */}
            <div className="grid sm:grid-cols-2 gap-4" style={{ marginBottom: isHymnDisabled ? '0.5rem' : '1.5rem' }}>
              <div>
                <label className="codex-label" htmlFor="upload-hymn">Hymn / Response Title *</label>
                <div className="rs-dark">
                  <Select<SelectOption, false, HymnGroup>
                    classNamePrefix="react-select"
                    inputId="upload-hymn"
                    options={hymnChoices?.groups ?? []}
                    value={selectedHymn}
                    onChange={(option: SingleValue<SelectOption>) => setSelectedHymn(option)}
                    placeholder="Select or type a hymn/response"
                    isClearable
                    isDisabled={isHymnDisabled}
                  />
                </div>
              </div>
              <div>
                <label className="codex-label" htmlFor="upload-language">Language *</label>
                <div className="rs-dark">
                  <Select<SelectOption, true>
                    classNamePrefix="react-select"
                    inputId="upload-language"
                    options={language_options}
                    value={selectedLanguage}
                    onChange={(option: MultiValue<SelectOption>) => {
                      setSelectedLanguage(option ?? []);
                    }}
                    placeholder="Select language(s)"
                    isClearable
                    isMulti
                    isDisabled={isLanguageDisabled}
                  />
                </div>
              </div>
            </div>

            {/* How many hymns the season + service unlocked */}
            {hymnChoices && selectedSeason && selectedService && (
              <p style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.75rem',
                letterSpacing: '0.06em',
                fontStyle: 'italic',
                color: 'var(--gold-muted)',
                margin: '-0.75rem 0 1.5rem',
              }}>
                {hymnChoices.filtered
                  ? `Showing ${hymnChoices.count} hymns for ${selectedSeason.label} · ${selectedService.label}.`
                  : `No hymn list for this season and service yet, so all ${hymnChoices.count} hymns are shown.`}
              </p>
            )}

            {/* Locked-field hint */}
            {isHymnDisabled && (
              <p style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.75rem',
                letterSpacing: '0.06em',
                fontStyle: 'italic',
                color: 'var(--gold-muted)',
                margin: '0 0 1.5rem',
              }}>
                Select a service and season to unlock hymn and language fields.
              </p>
            )}

            {/* File drop zone */}
            <div style={{ marginBottom: '1.5rem' }}>
              <span className="codex-label" id="file-label">
                Audio File ({ACCEPTED_AUDIO_LABEL}) *
              </span>
              {/* A real <label> around a visually hidden (not display:none) input:
                  Tab focuses it, Enter/Space opens the picker, screen readers
                  announce it — and drag-and-drop still works. */}
              <label
                htmlFor="file-input"
                className={`file-zone${isDragging ? ' file-zone--active' : ''}`}
                style={{ display: 'block', cursor: 'pointer' }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files[0];
                  if (dropped) chooseFile(dropped);
                }}
              >
                <input
                  type="file"
                  id="file-input"
                  className="sr-only"
                  aria-labelledby="file-label"
                  aria-describedby={fileError ? 'file-error' : undefined}
                  aria-invalid={fileError ? true : undefined}
                  onChange={(e) => chooseFile(e.target.files?.[0] || null)}
                  accept={ACCEPTED_AUDIO}
                />
                {file ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem' }}>
                    <Music style={{ width: '1.125rem', height: '1.125rem', color: 'var(--gold)' }} />
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '1rem', color: 'var(--parchment)', overflowWrap: 'anywhere' }}>
                      {file.name} <span style={{ color: 'var(--text-muted)' }}>· {formatSize(file.size)} · change</span>
                    </span>
                  </div>
                ) : (
                  <>
                    <p style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '1rem',
                      color: 'var(--text-muted)',
                      margin: '0 0 0.4rem',
                    }}>
                      Drop your audio file here, or choose one
                    </p>
                    <p style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.75rem',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      color: 'var(--gold-muted)',
                      margin: 0,
                    }}>
                      M4A · MP3 · WAV · FLAC · AIFF · OGG · WebM
                    </p>
                  </>
                )}
              </label>
              {fileError && (
                <p id="file-error" role="alert" style={{ fontFamily: 'var(--font-ui)', fontSize: '0.9375rem', color: 'var(--crimson-label)', margin: '0.5rem 0 0' }}>
                  {fileError}
                </p>
              )}
            </div>

            {/* Audio quality hint */}
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8125rem',
              fontStyle: 'italic',
              color: 'var(--gold-muted)',
              margin: '-0.75rem 0 1.75rem',
            }}>
              WAV or FLAC are welcome too, but not needed.
            </p>

            {/* Consent: Terms + Contributor License (required) */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label className="codex-checkbox-row">
                <input
                  type="checkbox"
                  className="codex-checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  required
                />
                <div>
                  <p style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '1.0625rem',
                    fontWeight: 500,
                    color: 'var(--parchment)',
                    margin: '0 0 0.3rem',
                  }}>
                    I agree to the{' '}
                    <a href="/terms" target="_blank" rel="noopener" style={{ color: 'var(--gold)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Terms and Contributor License</a> *
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '1.0625rem',
                    color: 'var(--text-muted)',
                    margin: 0,
                  }}>
                    I'm 13 or older, I have the right to share this recording, and everyone who can be heard in it
                    (or a parent, for anyone under 18) agreed to it being used by Project Hos Erof as the Terms describe.
                    See our <a href="/privacy" target="_blank" rel="noopener" style={{ color: 'var(--gold)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Privacy Policy</a>.
                  </p>
                </div>
              </label>
            </div>

            {/* Newsletter opt-in */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label className="codex-checkbox-row">
                <input
                  type="checkbox"
                  className="codex-checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                <div>
                  <p style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '1.0625rem',
                    fontWeight: 500,
                    color: 'var(--parchment)',
                    margin: '0 0 0.3rem',
                  }}>
                    Get Updates & Become a Tester
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '1.0625rem',
                    color: 'var(--text-muted)',
                    margin: '0 0 0.25rem',
                  }}>
                    Hear what happens to your recording, receive project updates, and sign up to become a future tester.
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.875rem',
                    color: 'var(--gold-muted)',
                    fontStyle: 'italic',
                    margin: 0,
                  }}>
                    Already signed up? No need to re-enter your email.
                  </p>
                </div>
              </label>

              {checked && (
                <div style={{ marginTop: '1rem' }}>
                  <label className="codex-label" htmlFor="upload-email">Email Address *</label>
                  <input
                    id="upload-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={emailError ? true : undefined}
                    aria-describedby={emailError ? 'upload-email-error' : undefined}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    onBlur={() => {
                      if (email && !isValidEmail(email)) {
                        setEmailError("Please enter a valid email address.");
                      }
                    }}
                    className={`codex-input${emailError ? ' codex-input--error' : ''}`}
                    placeholder="your.email@example.com"
                    required={checked}
                  />
                  {emailError && (
                    <p id="upload-email-error" role="alert" style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.9375rem',
                      color: 'var(--crimson-label)',
                      margin: '0.5rem 0 0',
                    }}>
                      {emailError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Bot verification */}
            <div style={{ marginBottom: '1.5rem' }}>
              {TURNSTILE_SITE_KEY ? (
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken(null)}
                  onError={() => setTurnstileToken(null)}
                  options={{ theme: 'dark' }}
                />
              ) : (
                <p style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.875rem',
                  fontStyle: 'italic',
                  color: 'var(--gold-muted)',
                  margin: 0,
                }}>
                  Verification isn't configured — set VITE_TURNSTILE_SITE_KEY.
                </p>
              )}
            </div>

            {/* Upload progress */}
            {isSubmitting && uploadProgress !== null && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploadProgress}
                  style={{ height: '2px', background: 'var(--ink-mid)', overflow: 'hidden' }}
                >
                  <div style={{
                    height: '100%',
                    width: `${uploadProgress}%`,
                    background: 'var(--gold)',
                    transition: 'width 0.2s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Submit error */}
            {submitError && (
              <p id="upload-error" ref={errorRef} tabIndex={-1} role="alert" style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.9375rem',
                color: 'var(--crimson-label)',
                margin: '0 0 1rem',
              }}>
                {submitError}
              </p>
            )}

            {/* Submit */}
            <button type="submit" disabled={isSubmitting} className="codex-submit">
              <Upload style={{ width: '0.875rem', height: '0.875rem' }} />
              {isSubmitting
                ? uploadProgress !== null && uploadProgress < 100
                  ? `Uploading… ${uploadProgress}%`
                  : 'Finishing…'
                : 'Share Recording'}
            </button>

          </form>
          )}
        </div>

      </div>
    </section>
  );
}
