import { useState, useEffect, useRef } from 'react';
import { fetchCommunityStats } from '../services/recordings';

const GOAL = 500;
/**
 * Below this many recordings in the collection, a raw count ("1 of 500")
 * makes the project look empty, so the counter invites people to be among
 * the first instead. From here on, the number is encouraging on its own.
 */
const SHOW_COUNT_FROM = 25;

/** Users who asked for less motion get the number straight away. */
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function useCountUp(target: number, duration: number, triggered: boolean) {
  const [count, setCount] = useState(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (!triggered || target === 0 || reduced) return;
    let current = 0;
    const increment = Math.max(1, Math.ceil(target / (duration / 16)));
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(current);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [triggered, target, duration, reduced]);

  return reduced ? target : count;
}

const overline: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '0.75rem',
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'var(--crimson-label)',
  margin: '0 0 1.25rem',
};

/**
 * The collection's progress, compact enough to sit beside "How it works".
 * Reads readyRecordings from GET /stats/community.
 */
export function CommunityCounter() {
  const [triggered, setTriggered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // null while loading or if the API can't be reached.
  const [collected, setCollected] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchCommunityStats().then((s) => { if (active && s) setCollected(s.readyRecordings); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setTriggered(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const total = collected ?? 0;
  const count = useCountUp(total, 1800, triggered);
  const progressPct = GOAL > 0 ? Math.min((total / GOAL) * 100, 100) : 0;
  const early = collected !== null && collected < SHOW_COUNT_FROM;

  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <p style={overline}>The Collection</p>

      {early ? (
        <>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.75rem, 4vw, 2.25rem)',
            fontWeight: 300,
            lineHeight: 1.2,
            color: 'var(--parchment)',
            margin: '0 0 0.75rem',
          }}>
            Be one of the first contributors
          </p>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-muted)', margin: 0 }}>
            The collection is just opening. The voices who start it shape what it becomes.
          </p>
        </>
      ) : (
        <>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(3.5rem, 8vw, 5rem)',
            fontWeight: 300,
            lineHeight: 1,
            color: 'var(--parchment)',
            margin: '0 0 1.25rem',
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {collected === null ? '—' : count.toLocaleString()}
          </p>
          <div aria-hidden="true" style={{ width: '100%', height: '2px', backgroundColor: 'var(--ink-mid)', marginBottom: '0.875rem', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${Math.max(progressPct, 0.5)}%`,
              background: 'linear-gradient(90deg, var(--crimson), var(--gold))',
              transition: 'width 1.8s ease',
            }} />
          </div>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '1rem', color: 'var(--text-muted)', margin: 0 }}>
            {collected === null
              ? 'Recordings in the collection'
              : `${total.toLocaleString()} of ${GOAL.toLocaleString()} recordings — building toward the first milestone`}
          </p>
        </>
      )}
    </div>
  );
}
