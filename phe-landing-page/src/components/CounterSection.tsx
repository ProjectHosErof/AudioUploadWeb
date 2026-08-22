import { useState, useEffect, useRef } from 'react';

// Swap CURRENT_COUNT for a live API value when the backend is ready
const CURRENT_COUNT = 0;
const GOAL = 500;

function useCountUp(target: number, duration: number, triggered: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!triggered || target === 0) return;
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
  }, [triggered, target, duration]);

  return count;
}

export function CounterSection() {
  const [triggered, setTriggered] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setTriggered(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const count = useCountUp(CURRENT_COUNT, 1800, triggered);
  const progressPct = GOAL > 0 ? Math.min((CURRENT_COUNT / GOAL) * 100, 100) : 0;
  // Always show a sliver so the bar reads as intentional, not broken
  const barWidth = CURRENT_COUNT === 0 ? 0 : Math.max(progressPct, 0.5);

  return (
    <section id="progress" ref={ref} style={{
      backgroundColor: 'var(--ink)',
      borderTop: '1px solid var(--ink-mid)',
      borderBottom: '1px solid var(--ink-mid)',
      padding: 'clamp(3.5rem, 7vw, 5.5rem) 2rem',
    }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>

        {/* Overline */}
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.625rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--crimson-label)',
          marginBottom: '1.5rem',
        }}>
          Recordings Collected
        </p>

        {/* Count */}
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(4.5rem, 10vw, 7rem)',
          fontWeight: 300,
          lineHeight: 1,
          color: 'var(--parchment)',
          margin: '0 0 2rem',
          letterSpacing: '-0.02em',
        }}>
          {count.toLocaleString()}
        </p>

        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: '2px',
          backgroundColor: 'var(--ink-mid)',
          marginBottom: '1rem',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${barWidth}%`,
            background: 'linear-gradient(90deg, var(--crimson), var(--gold))',
            transition: 'width 1.8s ease',
          }} />
        </div>

        {/* Milestone label */}
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '1.0625rem',
          letterSpacing: '0.04em',
          color: 'var(--text-muted)',
          margin: '0 0 0.625rem',
        }}>
          {CURRENT_COUNT.toLocaleString()} of {GOAL.toLocaleString()} — building toward the first milestone
        </p>

        {/* Encouragement */}
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.75rem',
          fontStyle: 'italic',
          color: 'var(--gold-muted)',
          margin: 0,
        }}>
          Every recording moves the archive forward.
        </p>

      </div>
    </section>
  );
}
