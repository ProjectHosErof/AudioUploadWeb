import { useRef, useState } from "react";
import { Upload, Music } from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import type { AudioFile } from "../App";
import Select, { type MultiValue, type SingleValue } from "react-select";
import {
  hymn_options,
  language_options,
  service_options,
  season_options,
} from "../options.data";
import type { SelectOption } from "../options.data";
import { TURNSTILE_SITE_KEY } from "../config";
import { resolveContentType, uploadRecording, UploadError } from "../services/uploadApi";

interface UploadFormProps {
  onUpload: (file: Omit<AudioFile, "id" | "uploadedAt">) => void;
}

const serviceTypes = [
  'St. Basil / St. Gregory / St. Cyril Divine Liturgy',
  'Matins & Vespers',
  'Vesper Praises',
  'Morning & Midnight Praises',
  'Melodies',
  'Ceremonies (Baptism, Crowning, Ordination)',
  'Venerations',
  '...and more',
];

const faqs = [
  {
    q: 'What happens to my recording?',
    a: 'Your recording becomes part of a curated dataset used to train and develop the technology behind a future Coptic Orthodox platform currently in development. This is Phase 1 of that larger initiative — contributions made here are foundational to what the community will eventually access.',
  },
  {
    q: 'Is contributing free?',
    a: 'Completely free. Your recording is a gift to the community, and this project will always remain open and free to access.',
  },
  {
    q: 'Will my personal information be shared?',
    a: 'No. Email addresses are only used for project updates if you opt in, and are never shared with third parties.',
  },
];

const uploadSteps = [
  'Select the type of service and the season the hymn/response is said',
  'Select the hymn/response and the language(s) used in the audio file',
  'Select your hymn audio file — accepted formats: WAV, MP3, FLAC, AIFF, OGG',
  'Optionally enter your email to receive project updates and become a tester',
  'Click Upload Track',
];

export function UploadForm({ onUpload }: UploadFormProps) {
  const [title, setTitle] = useState("");
  const [artist] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedService, setSelectedService] = useState<SelectOption | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<SelectOption | null>(null);
  const [selectedHymn, setSelectedHymn] = useState<SelectOption | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<readonly SelectOption[]>([]);
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState("");
  const turnstileRef = useRef<TurnstileInstance>(null);

  const isHymnDisabled = !selectedService || !selectedSeason;
  const isLanguageDisabled = !selectedService || !selectedSeason;

  function isValidEmail(e: string): boolean {
    if (!e || e.length === 0 || e.length > 254) return false;
    return /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(e);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!selectedService || !selectedSeason || !selectedHymn || selectedLanguage.length === 0 || !file) {
      setSubmitError("Please select a service, season, hymn, at least one language, and an audio file.");
      return;
    }

    if (checked && (!email || !isValidEmail(email))) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError("");

    const contentType = resolveContentType(file);
    if (!contentType) {
      setSubmitError("Unsupported file type. Please use WAV, MP3, FLAC, AIFF, or OGG.");
      return;
    }
    if (!TURNSTILE_SITE_KEY) {
      setSubmitError("Verification isn't configured yet. Please try again later.");
      return;
    }
    if (!turnstileToken) {
      setSubmitError("Please complete the verification challenge below.");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    try {
      const recordingId = await uploadRecording(
        {
          service_slug: selectedService.value,
          season_slug: selectedSeason.value,
          hymn_slug: selectedHymn.value,
          languages: selectedLanguage.map((l) => l.value),
          content_type: contentType,
          size_bytes: file.size,
          original_filename: file.name,
          wants_updates: checked,
          email: checked && email ? email : undefined,
          turnstile_token: turnstileToken,
          file,
        },
        (pct) => setUploadProgress(pct),
      );

      // Keep the local gallery behavior for now.
      onUpload({ title, artist, fileUrl: URL.createObjectURL(file) });

      setTitle("");
      setSelectedService(null);
      setSelectedSeason(null);
      setSelectedHymn(null);
      setSelectedLanguage([]);
      setFile(null);
      setChecked(false);
      setEmail("");
      setEmailError("");
      setUploadProgress(null);
      alert(`Thank you for your submission! Reference: ${recordingId.slice(0, 8)}`);
    } catch (err) {
      setSubmitError(
        err instanceof UploadError ? err.message : "Something went wrong. Please try again.",
      );
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
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.625rem',
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

        {/* What we need */}
        <div style={{
          border: '1px solid var(--ink-mid)',
          padding: '2.25rem',
          marginBottom: '2.5rem',
          backgroundColor: 'var(--ink-soft)',
        }}>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.625rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--crimson-label)',
            marginBottom: '1.25rem',
          }}>
            What We Need
          </p>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '1.0625rem',
            lineHeight: 1.8,
            color: 'var(--text-muted)',
            marginBottom: '0.75rem',
          }}>
            These recordings will form a training dataset for a future platform currently in development for the Coptic Orthodox community.
          </p>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '1.0625rem',
            lineHeight: 1.8,
            color: 'var(--text-muted)',
            marginBottom: '1.5rem',
          }}>
            We are looking for hymns and responses across different feasts,
            seasons, and tunes. Please do{' '}
            <em style={{ color: 'var(--parchment-dim)' }}>not</em>{' '}
            submit entire liturgies or full service recordings.
          </p>
          <div style={{ textAlign: 'center' }}>
            {serviceTypes.map((s, i) => (
              <p key={i} style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '1.0625rem',
                color: s === '...and more' ? 'var(--gold-muted)' : 'var(--text-muted)',
                fontStyle: s === '...and more' ? 'italic' : 'normal',
                margin: '0 0 0.5rem',
              }}>
                {s}
              </p>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: '2.5rem' }}>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.625rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--crimson-label)',
            marginBottom: '1.25rem',
          }}>
            Common Questions
          </p>
          {faqs.map((item, i) => (
            <div key={i} style={{
              borderTop: '1px solid var(--ink-mid)',
              padding: '1.25rem 0',
              display: 'grid',
              gridTemplateColumns: '1fr 1.5fr',
              gap: '2rem',
              alignItems: 'start',
            }}>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                fontWeight: 400,
                color: 'var(--parchment)',
                margin: 0,
                lineHeight: 1.3,
              }}>
                {item.q}
              </p>
              <p style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '1.0625rem',
                lineHeight: 1.75,
                color: 'var(--text-muted)',
                margin: 0,
              }}>
                {item.a}
              </p>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--ink-mid)' }} />
        </div>

        {/* Steps */}
        <div style={{ marginBottom: '3rem' }}>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.625rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--crimson-label)',
            marginBottom: '1.25rem',
          }}>
            Steps to Upload
          </p>
          {uploadSteps.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '1.25rem',
                alignItems: 'flex-start',
                borderTop: '1px solid var(--ink-mid)',
                padding: '1rem 0',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.375rem',
                fontWeight: 300,
                color: 'var(--crimson-label)',
                lineHeight: 1.1,
                minWidth: '1.25rem',
                paddingTop: '0.05rem',
              }}>
                {i + 1}
              </span>
              <p style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '1.0625rem',
                lineHeight: 1.7,
                color: 'var(--text-muted)',
                margin: 0,
              }}>
                {step}
              </p>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--ink-mid)' }} />
        </div>

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

          <form onSubmit={handleSubmit}>

            {/* Service & Season */}
            <div className="grid sm:grid-cols-2 gap-4" style={{ marginBottom: '1.5rem' }}>
              <div>
                <label className="codex-label">Service *</label>
                <div className="rs-dark">
                  <Select
                    classNamePrefix="react-select"
                    options={service_options}
                    value={selectedService}
                    onChange={(option: SingleValue<SelectOption>) => {
                      setSelectedService(option);
                      if (!option) {
                        setSelectedHymn(null);
                        setSelectedLanguage([]);
                        setTitle("");
                      }
                    }}
                    placeholder="Select service"
                    isClearable
                  />
                </div>
              </div>
              <div>
                <label className="codex-label">Season *</label>
                <div className="rs-dark">
                  <Select
                    classNamePrefix="react-select"
                    options={season_options}
                    value={selectedSeason}
                    onChange={(option: SingleValue<SelectOption>) => {
                      setSelectedSeason(option);
                      if (!option) {
                        setSelectedHymn(null);
                        setSelectedLanguage([]);
                        setTitle("");
                      }
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
                <label className="codex-label">Hymn / Response Title *</label>
                <div className="rs-dark">
                  <Select
                    classNamePrefix="react-select"
                    options={hymn_options}
                    value={selectedHymn}
                    onChange={(option: SingleValue<SelectOption>) => {
                      setSelectedHymn(option);
                      setTitle(option?.label ?? "");
                    }}
                    placeholder="Select hymn/response"
                    isClearable
                    isDisabled={isHymnDisabled}
                  />
                </div>
              </div>
              <div>
                <label className="codex-label">Language *</label>
                <div className="rs-dark">
                  <Select<SelectOption, true>
                    classNamePrefix="react-select"
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

            {/* Locked-field hint */}
            {isHymnDisabled && (
              <p style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.6875rem',
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
              <label className="codex-label">
                Audio File (WAV, MP3, FLAC, AIFF, OGG) *
              </label>
              <div
                className={`file-zone${isDragging ? ' file-zone--active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files[0];
                  if (dropped) setFile(dropped);
                }}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  type="file"
                  id="file-input"
                  style={{ display: 'none' }}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".wav,.mp3,.aiff,.flac,.ogg,audio/wav,audio/wave,audio/x-wav,audio/mpeg,audio/mp3,audio/x-aiff,audio/aiff,audio/flac,audio/x-flac,audio/ogg,audio/vorbis,application/ogg"
                  required
                />
                {file ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem' }}>
                    <Music style={{ width: '1.125rem', height: '1.125rem', color: 'var(--gold)' }} />
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '1rem', color: 'var(--parchment)' }}>
                      {file.name}
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
                      Drop your audio file here, or click to browse
                    </p>
                    <p style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.75rem',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      color: 'var(--gold-muted)',
                      margin: 0,
                    }}>
                      WAV · MP3 · FLAC · AIFF · OGG
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Audio quality hint */}
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8125rem',
              fontStyle: 'italic',
              color: 'var(--gold-muted)',
              margin: '-0.75rem 0 1.75rem',
            }}>
              Any quality is welcome — WAV and FLAC preferred where possible.
            </p>

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
                  <label className="codex-label">Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    onBlur={() => {
                      if (email && !isValidEmail(email)) {
                        setEmailError("Please enter a valid email address");
                      }
                    }}
                    className={`codex-input${emailError ? ' codex-input--error' : ''}`}
                    placeholder="your.email@example.com"
                    required={checked}
                  />
                  {emailError && (
                    <p style={{
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
              <div style={{ marginBottom: '1.25rem' }} aria-live="polite">
                <div style={{ height: '2px', background: 'var(--ink-mid)', overflow: 'hidden' }}>
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
              <p style={{
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
                : 'Upload Track'}
            </button>

          </form>
        </div>

      </div>
    </section>
  );
}
