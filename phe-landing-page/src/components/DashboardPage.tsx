import { useMemo } from 'react';
import { Nav } from './Nav';

interface TrackRecord {
  trackId: string;
  title: string;
  hymn: string;
  service: string;
  season: string;
  language: string;
  durationSeconds: number;
  uploadedAt: string;
  status: 'ready' | 'processing' | 'rejected';
}

interface UserStats {
  totalDurationUploaded: number;
  totalTracks: number;
  readyTracks: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

const STATUS_STYLES: Record<TrackRecord['status'], React.CSSProperties> = {
  ready:      { color: 'var(--gold)',         borderColor: 'var(--gold-muted)' },
  processing: { color: 'var(--text-muted)',   borderColor: 'var(--ink-mid)'   },
  rejected:   { color: 'var(--crimson-label)', borderColor: 'var(--crimson)'  },
};

const MOCK_USER = { displayName: 'Anthony' };

const MOCK_TRACKS: TrackRecord[] = [
  {
    trackId: '1', title: 'Hiten: Pijwmi', hymn: 'Hiten',
    service: 'St. Basil Divine Liturgy', season: 'General',
    language: 'Coptic / Arabic', durationSeconds: 312,
    uploadedAt: '2026-05-28', status: 'ready',
  },
  {
    trackId: '2', title: 'Psalm 150 Response', hymn: 'Psalm 150',
    service: 'Matins', season: 'Great Lent',
    language: 'Arabic', durationSeconds: 148,
    uploadedAt: '2026-05-25', status: 'ready',
  },
  {
    trackId: '3', title: 'Efnoti Nahmen', hymn: 'Efnoti Nahmen',
    service: 'Vesper Praises', season: 'Kiahk',
    language: 'Coptic / Arabic', durationSeconds: 425,
    uploadedAt: '2026-05-20', status: 'processing',
  },
  {
    trackId: '4', title: 'Pi Oik: Trisagion', hymn: 'Pi Oik',
    service: 'St. Basil Divine Liturgy', season: 'General',
    language: 'Coptic', durationSeconds: 198,
    uploadedAt: '2026-05-15', status: 'ready',
  },
  {
    trackId: '5', title: 'Agios', hymn: 'Agios',
    service: 'St. Basil Divine Liturgy', season: 'General',
    language: 'Greek', durationSeconds: 74,
    uploadedAt: '2026-05-10', status: 'rejected',
  },
];

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

interface DashboardPageProps {
  user?: { displayName: string };
  tracks?: TrackRecord[];
}

export function DashboardPage({
  user = MOCK_USER,
  tracks = MOCK_TRACKS,
}: DashboardPageProps) {
  const stats: UserStats = useMemo(() => ({
    totalDurationUploaded: tracks.reduce((s, t) => s + t.durationSeconds, 0),
    totalTracks: tracks.length,
    readyTracks: tracks.filter(t => t.status === 'ready').length,
  }), [tracks]);

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
                Welcome back, {user.displayName}.
              </h1>
              <p className="anim-2" style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '1.0625rem',
                color: 'var(--text-muted)',
                margin: 0,
              }}>
                Your archive is growing.
              </p>
            </div>
            <a
              href="#upload"
              className="hero-cta anim-2"
              style={{ whiteSpace: 'nowrap', display: 'inline-block' }}
            >
              Upload New Recording
            </a>
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
              <StatCard
                value={String(stats.totalTracks)}
                label="Total Recordings"
              />
            </div>
            <div style={{ backgroundColor: 'var(--ink-soft)' }}>
              <StatCard
                value={formatDuration(stats.totalDurationUploaded)}
                label="Duration Uploaded"
              />
            </div>
            <div style={{ backgroundColor: 'var(--ink-soft)' }}>
              <StatCard
                value={String(stats.readyTracks)}
                label="Ready to Use"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Track history */}
      <section style={{
        padding: 'clamp(3rem, 6vw, 4.5rem) 2rem clamp(4rem, 8vw, 6rem)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

          {/* Section label */}
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

          {/* Table wrapper — horizontal scroll on mobile */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '640px',
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ink-mid)' }}>
                  {['Title', 'Service', 'Season', 'Uploaded', 'Status'].map(col => (
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
                {tracks.map((track, i) => (
                  <tr
                    key={track.trackId}
                    style={{
                      borderBottom: '1px solid var(--ink-mid)',
                      backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(34,20,8,0.5)',
                    }}
                  >
                    {/* Title */}
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
                        {track.language}
                      </span>
                    </td>

                    {/* Service */}
                    <td style={{
                      padding: '1.125rem 1rem 1.125rem 0',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.9375rem',
                      color: 'var(--text-muted)',
                    }}>
                      {track.service}
                    </td>

                    {/* Season */}
                    <td style={{
                      padding: '1.125rem 1rem 1.125rem 0',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.9375rem',
                      color: 'var(--text-muted)',
                    }}>
                      {track.season}
                    </td>

                    {/* Uploaded */}
                    <td style={{
                      padding: '1.125rem 1rem 1.125rem 0',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.9375rem',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}>
                      {formatDate(track.uploadedAt)}
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: '1.125rem 0 1.125rem 0' }}>
                      <span style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '0.625rem',
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        fontWeight: 500,
                        padding: '0.25rem 0.625rem',
                        border: '1px solid',
                        ...STATUS_STYLES[track.status],
                      }}>
                        {track.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {tracks.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              border: '1px solid var(--ink-mid)',
            }}>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.5rem',
                fontWeight: 300,
                color: 'var(--parchment-dim)',
                margin: '0 0 0.5rem',
              }}>
                No recordings yet.
              </p>
              <p style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '1rem',
                color: 'var(--text-muted)',
                margin: 0,
              }}>
                Your contributions will appear here once uploaded.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
