'use client';

import React from 'react';
import { formatCountdownClock, getFetanClock, getSpecialPickClock, FETAN_PICK_SECONDS, SPECIAL_PICK_SECONDS } from '../../lib/bingoUtils';

type SharedCountdownTextProps = {
  mode: 'FETAN' | 'SPECIAL' | 'ROUND';
  deadline?: number | null;
  status?: string;
  drawnCount?: number;
  className?: string;
};

function getServerSeconds({ mode, deadline, status, drawnCount = 0 }: SharedCountdownTextProps): number | null {
  // Returns the server-derived value if the deadline is known and in the future.
  // Returns null when we must fall back to a local ticking counter.
  if (mode === 'FETAN') {
    const { pickingCards, secondsLeft } = getFetanClock(deadline, status, drawnCount);
    if (pickingCards && deadline && deadline > Date.now()) return secondsLeft;
    if (!pickingCards) return 0;
    return null; // deadline missing / fallback needed
  }
  if (mode === 'SPECIAL') {
    const { pickingCards, secondsLeft } = getSpecialPickClock(deadline, status, drawnCount);
    if (pickingCards && deadline && deadline > Date.now()) return secondsLeft;
    if (!pickingCards) return 0;
    return null; // deadline missing / fallback needed
  }
  // ROUND mode always uses the deadline directly
  return deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
}

/** Ticks locally every second regardless of mini-app activity or missing deadline. */
export default function SharedCountdownText(props: SharedCountdownTextProps) {
  const { mode, deadline, status, drawnCount, className } = props;

  const [seconds, setSeconds] = React.useState<number>(() => {
    const sv = getServerSeconds({ mode, deadline, status, drawnCount });
    if (sv !== null) return sv;
    // No deadline yet — start a local countdown from the full pick window
    return mode === 'FETAN' ? FETAN_PICK_SECONDS : mode === 'SPECIAL' ? SPECIAL_PICK_SECONDS : 0;
  });

  // Track our own local start so the fallback can count down properly
  const localStartRef = React.useRef<{ at: number; from: number } | null>(null);
  const prevDeadlineRef = React.useRef(deadline);

  React.useEffect(() => {
    // When deadline changes, reset local tracking
    if (prevDeadlineRef.current !== deadline) {
      prevDeadlineRef.current = deadline;
      localStartRef.current = null;
    }

    const tick = () => {
      const sv = getServerSeconds({ mode, deadline, status, drawnCount });
      if (sv !== null) {
        // Server deadline is authoritative — use it directly
        localStartRef.current = null;
        setSeconds(sv);
        return;
      }
      // Deadline missing: tick a local countdown
      if (!localStartRef.current) {
        const startFrom = mode === 'FETAN' ? FETAN_PICK_SECONDS : mode === 'SPECIAL' ? SPECIAL_PICK_SECONDS : 0;
        localStartRef.current = { at: Date.now(), from: startFrom };
      }
      const elapsed = Math.floor((Date.now() - localStartRef.current.at) / 1000);
      const remaining = Math.max(0, localStartRef.current.from - elapsed);
      setSeconds(remaining);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [mode, deadline, status, drawnCount]);

  return (
    <span className={className}>
      {mode === 'FETAN' ? `${seconds}s` : formatCountdownClock(seconds)}
    </span>
  );
}
