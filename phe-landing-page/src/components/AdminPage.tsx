import { useCallback, useEffect, useState } from 'react';
import { Nav } from './Nav';
import {
  ModerationError,
  REJECTION_REASONS,
  fetchPlaybackSource,
  fetchQueue,
  submitReview,
  type QueueItem,
} from '../services/moderation';

const PAGE_SIZE = 25;

function formatLength(seconds: number | null): string {
  if (seconds === null) return 'unknown length';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatSize(bytes: number | null): string | null {
  if (bytes === null) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** "48 kHz · mono · pcm_s16le · 14.2 MB" — the technical case for or against a take. */
function technicalLine(item: QueueItem): string {
  const parts: string[] = [];
  if (item.sampleRateHz) parts.push(`${(item.sampleRateHz / 1000).toFixed(item.sampleRateHz % 1000 ? 1 : 0)} kHz`);
  if (item.channels) parts.push(item.channels === 1 ? 'mono' : item.channels === 2 ? 'stereo' : `${item.channels} ch`);
  if (item.codec) parts.push(item.codec);
  const size = formatSize(item.fileSizeBytes);
  if (size) parts.push(size);
  return parts.join(' · ');
}

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '0.625rem',
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'var(--crimson-label)',
};

const metaStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '0.875rem',
  color: 'var(--text-muted)',
  margin: 0,
};

const buttonBase: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '0.6875rem',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  padding: '0.625rem 1.5rem',
  border: '1px solid',
  background: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

interface CardProps {
  item: QueueItem;
  onResolved: (id: string, note: string) => void;
  onError: (message: string) => void;
}

function ReviewCard({ item, onResolved, onError }: CardProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<string>(REJECTION_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [busy, setBusy] = useState(false);

  const loadAudio = async () => {
    setLoadingAudio(true);
    try {
      const src = await fetchPlaybackSource(item.id);
      setAudioUrl(src.url);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not load the audio.');
    } finally {
      setLoadingAudio(false);
    }
  };

  const decide = async (decision: 'approve' | 'reject') => {
    const text = decision === 'reject' ? (reason === 'Something else' ? customReason.trim() : reason) : undefined;
    if (decision === 'reject' && !text) {
      onError('Please describe why this recording is being declined.');
      return;
    }
    setBusy(true);
    try {
      await submitReview(item.id, decision, text);
      onResolved(
        item.id,
        decision === 'approve'
          ? `"${item.title}" added to the collection.`
          : `"${item.title}" declined.`,
      );
    } catch (err) {
      // 409 = someone already reviewed it. The decision stands; our copy of the
      // queue was simply stale, so drop the card rather than cry failure.
      if (err instanceof ModerationError && err.status === 409) {
        onResolved(item.id, `"${item.title}" had already been reviewed.`);
        return;
      }
      onError(err instanceof Error ? err.message : 'Could not record your decision.');
      setBusy(false);
    }
  };

  return (
    <article
      style={{
        position: 'relative',
        border: '1px solid var(--ink-mid)',
        borderLeft: '2px solid var(--crimson)',
        backgroundColor: 'var(--ink-soft)',
        padding: 'clamp(1.5rem, 3vw, 2rem)',
        opacity: busy ? 0.5 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '260px', flex: '1 1 320px' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            fontWeight: 400,
            color: 'var(--parchment)',
            margin: '0 0 0.5rem',
            lineHeight: 1.2,
          }}>
            {item.title}
          </h2>
          <p style={metaStyle}>
            {[item.service, item.season].filter(Boolean).join(' · ') || '—'}
          </p>
          <p style={{ ...metaStyle, fontSize: '0.8125rem', marginTop: '0.25rem' }}>
            {formatLength(item.durationSeconds)}
            {technicalLine(item) && ` · ${technicalLine(item)}`}
          </p>
        </div>

        <div style={{ textAlign: 'right', fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <p style={{ margin: '0 0 0.25rem' }}>{formatDate(item.uploadedAt)}</p>
          {item.contributor && <p style={{ margin: 0, color: 'var(--gold-muted)' }}>{item.contributor}</p>}
          {!item.isEnriched && (
            <p style={{
              margin: '0.5rem 0 0',
              fontSize: '0.625rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--crimson-label)',
              border: '1px solid var(--crimson)',
              padding: '0.2rem 0.5rem',
              display: 'inline-block',
            }}>
              Not yet analysed
            </p>
          )}
        </div>
      </div>

      {/* Playback — the presigned URL is fetched on demand so it isn't already
          expiring by the time anyone presses play. */}
      <div style={{ marginTop: '1.5rem' }}>
        {audioUrl ? (
          // The native player is kept for its keyboard support and Range-based
          // scrubbing; inverting it is the only way to stop a stark white bar
          // from cutting through the dark card, since its internals aren't
          // styleable. Rotating the hue back keeps the icons neutral.
          <audio
            controls
            autoPlay
            src={audioUrl}
            style={{ width: '100%', filter: 'invert(0.9) hue-rotate(180deg)' }}
          />
        ) : (
          <button
            onClick={loadAudio}
            disabled={loadingAudio}
            style={{
              ...buttonBase,
              borderColor: 'var(--ink-mid)',
              color: 'var(--gold-muted)',
              width: '100%',
              padding: '0.875rem',
              cursor: loadingAudio ? 'wait' : 'pointer',
            }}
          >
            {loadingAudio ? 'Retrieving…' : '▸ Listen'}
          </button>
        )}
        {item.originalFilename && (
          <p style={{ ...metaStyle, fontSize: '0.6875rem', marginTop: '0.5rem', opacity: 0.7 }}>
            {item.originalFilename}
          </p>
        )}
      </div>

      {/* Decision */}
      {!rejecting ? (
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => decide('approve')}
            disabled={busy}
            style={{ ...buttonBase, borderColor: 'var(--gold)', color: 'var(--gold)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--ink)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--gold)'; }}
          >
            Add to Collection
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={busy}
            style={{ ...buttonBase, borderColor: 'var(--ink-mid)', color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--crimson)'; e.currentTarget.style.color = 'var(--crimson-label)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--ink-mid)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            Decline
          </button>
        </div>
      ) : (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--ink-mid)', paddingTop: '1.25rem' }}>
          <p style={{ ...eyebrowStyle, marginBottom: '0.75rem' }}>Reason for declining</p>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: 'var(--ink)',
              border: '1px solid var(--ink-mid)',
              color: 'var(--parchment)',
              fontFamily: 'var(--font-ui)',
              fontSize: '0.875rem',
            }}
          >
            {REJECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            <option value="Something else">Something else…</option>
          </select>

          {reason === 'Something else' && (
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="This is shown to the contributor, so keep it kind and specific."
              rows={2}
              maxLength={500}
              style={{
                width: '100%',
                marginTop: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'var(--ink)',
                border: '1px solid var(--ink-mid)',
                color: 'var(--parchment)',
                fontFamily: 'var(--font-ui)',
                fontSize: '0.875rem',
                resize: 'vertical',
              }}
            />
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => decide('reject')}
              disabled={busy}
              style={{ ...buttonBase, borderColor: 'var(--crimson)', color: 'var(--crimson-label)' }}
            >
              Confirm Decline
            </button>
            <button
              onClick={() => setRejecting(false)}
              disabled={busy}
              style={{ ...buttonBase, borderColor: 'var(--ink-mid)', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export function AdminPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewedCount, setReviewedCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await fetchQueue(PAGE_SIZE, 0);
      setItems(page.items);
      setTotal(page.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the review queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleResolved = (id: string, message: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    setReviewedCount((n) => n + 1);
    setNotice(message);
    setError('');
  };

  const remaining = items.length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ink)' }}>
      <Nav />

      <header style={{
        paddingTop: 'calc(56px + clamp(3rem, 6vw, 4.5rem))',
        paddingBottom: 'clamp(2rem, 4vw, 3rem)',
        paddingLeft: '2rem',
        paddingRight: '2rem',
        borderBottom: '1px solid var(--ink-mid)',
      }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <p style={{ ...eyebrowStyle, marginBottom: '1rem' }}>Moderation</p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.25rem, 4.5vw, 3.25rem)',
            fontWeight: 300,
            color: 'var(--parchment)',
            lineHeight: 1.1,
            margin: '0 0 0.5rem',
            letterSpacing: '-0.01em',
          }}>
            The Review Queue
          </h1>
          <p style={{ ...metaStyle, fontSize: '1.0625rem' }}>
            {loading
              ? 'Gathering submissions…'
              : total === 0
                ? 'Nothing is waiting.'
                : `${total} ${total === 1 ? 'recording awaits' : 'recordings await'} a decision.`}
            {reviewedCount > 0 && ` ${reviewedCount} reviewed in this sitting.`}
          </p>
        </div>
      </header>

      <section style={{ padding: 'clamp(2rem, 5vw, 3.5rem) 2rem clamp(4rem, 8vw, 6rem)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>

          {notice && (
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8125rem',
              letterSpacing: '0.04em',
              color: 'var(--gold)',
              border: '1px solid var(--gold-muted)',
              padding: '0.875rem 1rem',
              marginBottom: '1.5rem',
            }}>
              {notice}
            </p>
          )}

          {error && (
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.9375rem',
              color: 'var(--crimson-label)',
              border: '1px solid var(--crimson)',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}>
              {error}
            </p>
          )}

          {loading && (
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--gold-muted)',
              padding: '3rem 0',
              textAlign: 'center',
            }}>
              Gathering submissions…
            </p>
          )}

          {!loading && remaining > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {items.map((item) => (
                <ReviewCard
                  key={item.id}
                  item={item}
                  onResolved={handleResolved}
                  onError={setError}
                />
              ))}
            </div>
          )}

          {/* More pages exist than we've loaded — reload from the top, since the
              queue shifts as decisions are made and offsets go stale. */}
          {!loading && remaining > 0 && total > remaining && (
            <button
              onClick={() => void load()}
              style={{
                ...buttonBase,
                borderColor: 'var(--ink-mid)',
                color: 'var(--gold-muted)',
                width: '100%',
                marginTop: '1.5rem',
                padding: '0.875rem',
              }}
            >
              Load the next {Math.min(PAGE_SIZE, total - remaining)}
            </button>
          )}

          {!loading && !error && remaining === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              border: '1px solid var(--ink-mid)',
              backgroundColor: 'var(--ink-soft)',
              position: 'relative',
            }}>
              <span className="codex-corner codex-corner--tl" />
              <span className="codex-corner codex-corner--tr" />
              <span className="codex-corner codex-corner--bl" />
              <span className="codex-corner codex-corner--br" />
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.75rem',
                color: 'var(--gold)',
                letterSpacing: '0.55em',
                margin: '0 0 1.5rem',
              }}>
                ✦ ✦ ✦
              </p>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.75rem',
                fontWeight: 300,
                color: 'var(--parchment)',
                margin: '0 0 0.75rem',
              }}>
                The queue is clear.
              </p>
              <p style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '1rem',
                lineHeight: 1.7,
                color: 'var(--text-muted)',
                margin: 0,
              }}>
                Every submission has been heard.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
