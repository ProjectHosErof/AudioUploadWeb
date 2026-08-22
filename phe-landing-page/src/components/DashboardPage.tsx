import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Nav } from './Nav';
import { useAuth } from '../auth/AuthProvider';
import {
  describeStatus,
  fetchCommunityStats,
  fetchMyRecordings,
  type CommunityStats,
  type MyRecording,
  type StatusPresentation,
} from '../services/recordings';

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.round(seconds)}s`;
}

function formatTrackLength(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Chip colours per presentation tone. A duplicate reads as warm, not failed. */
const TONE_STYLES: Record<StatusPresentation['tone'], React.CSSProperties> = {
  accepted:  { color: 'var(--gold)',          borderColor: 'var(--gold-muted)' },
  pending:   { color: 'var(--text-muted)',    borderColor: 'var(--ink-mid)'    },
  duplicate: { color: 'var(--gold-muted)',    borderColor: 'var(--ink-mid)'    },
  declined:  { color: 'var(--crimson-label)', borderColor: 'var(--crimson)'    },
};

/** Prefer the name the identity provider gave us, then the email's local part. */
function displayNameFrom(email: string | null, metadata: Record<string, unknown> | undefined): string {
  const fullName = metadata?.full_name ?? metadata?.name;
  if (typeof fullName === 'string' && fullName.trim()) return fullName.split(' ')[0];
  if (email) return email.split('@')[0];
  return 'friend';
}

interface StatCardProps { value: string; label: string; }

function StatCard({ value, label }: StatCardProps) {
  return (
    <div style={{
      position: 'relative',
      padding: '2.25rem 1.75rem 2rem',
      backgroundColor: 'var(--ink-soft)',
      border: '1px solid var(--ink-mid)',
      borderBottom: '2px solid var(--crimson)',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(3.5rem, 6vw, 4.75rem)',
        fontWeight: 300,
        lineHeight: 1,
        color: 'var(--parchment)',
        margin: '0 0 1rem',
        letterSpacing: '-0.02em',
      }}>
        {value}
      </p>
      <p style={{
        fontFamily: 'var(--font-ui)',
        fontSize: '0.625rem',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        margin: 0,
      }}>
        {label}
      </p>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<MyRecording[]>([]);
  const [community, setCommunity] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    fetchMyRecordings()
      .then((rows) => { if (active) setTracks(rows); })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load your recordings.');
      })
      .finally(() => { if (active) setLoading(false); });

    fetchCommunityStats().then((s) => { if (active) setCommunity(s); });

    return () => { active = false; };
  }, [user?.id]);

  const stats = useMemo(() => ({
    total: tracks.length,
    seconds: tracks.reduce((s, t) => s + (t.durationSeconds ?? 0), 0),
    inCollection: tracks.filter((t) => t.status === 'ready').length,
  }), [tracks]);

  const name = displayNameFrom(user?.email ?? null, user?.user_metadata);
  const hasTracks = tracks.length > 0;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ink)' }}>
      <Nav />

      {/* Page header */}
      <header style={{
        paddingTop: 'calc(56px + clamp(3rem, 6vw, 4.5rem))',
        paddingBottom: 'clamp(2.5rem, 5vw, 3.5rem)',
        paddingLeft: '2rem',
        paddingRight: '2rem',
        borderBottom: '1px solid var(--ink-mid)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.625rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--crimson-label)',
            marginBottom: '1rem',
          }}>
            Contributor Portal
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 className="anim-1" style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.5rem, 5vw, 3.75rem)',
                fontWeight: 300,
                color: 'var(--parchment)',
                lineHeight: 1.1,
                margin: '0 0 0.5rem',
                letterSpacing: '-0.01em',
              }}>
                Welcome back, {name}.
              </h1>
              <p className="anim-2" style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '1.0625rem',
                color: 'var(--text-muted)',
                margin: 0,
              }}>
                {hasTracks ? 'Your archive is growing.' : 'Your archive begins with a single hymn.'}
              </p>
            </div>
            <Link
              to="/#upload"
              className="hero-cta anim-2"
              style={{ whiteSpace: 'nowrap', display: 'inline-block' }}
            >
              Upload New Recording
            </Link>
          </div>
        </div>
      </header>

      {/* Stats grid */}
      <section style={{
        backgroundColor: 'var(--ink-soft)',
        borderBottom: '1px solid var(--ink-mid)',
        padding: 'clamp(2.5rem, 5vw, 3.5rem) 2rem',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ backgroundColor: 'var(--ink-mid)' }}>
            <div style={{ backgroundColor: 'var(--ink-soft)' }}>
              <StatCard value={loading ? '—' : String(stats.total)} label="Total Recordings" />
            </div>
            <div style={{ backgroundColor: 'var(--ink-soft)' }}>
              <StatCard value={loading ? '—' : formatDuration(stats.seconds)} label="Duration Uploaded" />
            </div>
            <div style={{ backgroundColor: 'var(--ink-soft)' }}>
              <StatCard value={loading ? '—' : String(stats.inCollection)} label="In the Collection" />
            </div>
          </div>

          {/* Community context — personal figures first, the corpus as backdrop. */}
          {community && (
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8125rem',
              letterSpacing: '0.04em',
              color: 'var(--text-muted)',
              textAlign: 'center',
              margin: '1.75rem 0 0',
            }}>
              Together, {community.contributors}{' '}
              {community.contributors === 1 ? 'contributor has' : 'contributors have'} given{' '}
              <span style={{ color: 'var(--gold)' }}>{community.totalRecordings}</span>{' '}
              {community.totalRecordings === 1 ? 'recording' : 'recordings'} to the archive
              {community.readyRecordings > 0 && (
                <>
                  {' '}·{' '}
                  <span style={{ color: 'var(--gold)' }}>{formatDuration(community.readySeconds)}</span>{' '}
                  accepted into the collection
                </>
              )}
              .
            </p>
          )}
        </div>
      </section>

      {/* Track history */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 4.5rem) 2rem clamp(4rem, 8vw, 6rem)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.625rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--crimson-label)',
            marginBottom: '1.75rem',
          }}>
            Contribution History
          </p>

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
              Gathering your contributions…
            </p>
          )}

          {!loading && error && (
            <div style={{ border: '1px solid var(--crimson)', padding: '2rem', textAlign: 'center' }}>
              <p style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '1rem',
                color: 'var(--crimson-label)',
                margin: 0,
              }}>
                {error}
              </p>
            </div>
          )}

          {!loading && !error && hasTracks && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--ink-mid)' }}>
                    {['Title', 'Service', 'Season', 'Length', 'Uploaded', 'Status'].map(col => (
                      <th key={col} style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '0.625rem',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                        textAlign: 'left',
                        padding: '0 1rem 1rem 0',
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((track, i) => {
                    const presented = describeStatus(track);
                    return (
                      <tr
                        key={track.id}
                        style={{
                          borderBottom: '1px solid var(--ink-mid)',
                          backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(34,20,8,0.5)',
                        }}
                      >
                        <td style={{ padding: '1.125rem 1rem 1.125rem 0' }}>
                          <span style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '1.25rem',
                            fontWeight: 400,
                            color: 'var(--parchment)',
                            lineHeight: 1.2,
                            display: 'block',
                          }}>
                            {track.title}
                          </span>
                          <span style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            letterSpacing: '0.03em',
                          }}>
                            {track.languages}
                          </span>
                        </td>

                        <td style={{
                          padding: '1.125rem 1rem 1.125rem 0',
                          fontFamily: 'var(--font-ui)',
                          fontSize: '0.9375rem',
                          color: 'var(--text-muted)',
                        }}>
                          {track.service}
                        </td>

                        <td style={{
                          padding: '1.125rem 1rem 1.125rem 0',
                          fontFamily: 'var(--font-ui)',
                          fontSize: '0.9375rem',
                          color: 'var(--text-muted)',
                        }}>
                          {track.season}
                        </td>

                        <td style={{
                          padding: '1.125rem 1rem 1.125rem 0',
                          fontFamily: 'var(--font-ui)',
                          fontSize: '0.9375rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {formatTrackLength(track.durationSeconds)}
                        </td>

                        <td style={{
                          padding: '1.125rem 1rem 1.125rem 0',
                          fontFamily: 'var(--font-ui)',
                          fontSize: '0.9375rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                        }}>
                          {formatDate(track.uploadedAt)}
                        </td>

                        <td style={{ padding: '1.125rem 0 1.125rem 0' }}>
                          <span style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: '0.625rem',
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            fontWeight: 500,
                            padding: '0.25rem 0.625rem',
                            border: '1px solid',
                            whiteSpace: 'nowrap',
                            ...TONE_STYLES[presented.tone],
                          }}>
                            {presented.label}
                          </span>
                          {/* A decline is explainable to the person who submitted it. */}
                          {track.reviewReason && track.status === 'rejected' && (
                            <span style={{
                              display: 'block',
                              fontFamily: 'var(--font-ui)',
                              fontSize: '0.6875rem',
                              lineHeight: 1.5,
                              color: 'var(--text-muted)',
                              marginTop: '0.5rem',
                              maxWidth: '200px',
                            }}>
                              {track.reviewReason}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && !hasTracks && (
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
                No recordings yet.
              </p>
              <p style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '1rem',
                lineHeight: 1.7,
                color: 'var(--text-muted)',
                margin: '0 0 1.75rem',
              }}>
                Every hymn preserved here began with someone pressing record.
              </p>
              <Link to="/#upload" className="hero-cta" style={{ display: 'inline-block' }}>
                Contribute Your First Recording
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
