'use client';

import React from 'react';
import { formatCountdownClock, getFetanClock, getSpecialPickClock } from '../../lib/bingoUtils';

type SharedCountdownTextProps = {
  mode: 'FETAN' | 'SPECIAL' | 'ROUND';
  deadline?: number | null;
  status?: string;
  drawnCount?: number;
  className?: string;
};

function getServerSeconds({ mode, deadline, status, drawnCount = 0 }: SharedCountdownTextProps): number | null {
  // A missing deadline means state is still syncing. Never start a client-only
  // countdown here: each player would get a different pick window.
  if (mode === 'FETAN') {
    const { pickingCards, secondsLeft } = getFetanClock(deadline, status, drawnCount);
    if (pickingCards && deadline && deadline > Date.now()) return secondsLeft;
    if (!deadline && status === 'OPEN' && drawnCount === 0) return null;
    if (!pickingCards) return 0;
    return null;
  }
  if (mode === 'SPECIAL') {
    const { pickingCards, secondsLeft } = getSpecialPickClock(deadline, status, drawnCount);
    if (pickingCards && deadline && deadline > Date.now()) return secondsLeft;
    if (!deadline && status === 'OPEN' && drawnCount === 0) return null;
    if (!pickingCards) return 0;
    return null;
  }
  // ROUND mode always uses the deadline directly
  return deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
}

/** Displays only the shared server countdown; missing deadlines remain visibly unsynced. */
export default function SharedCountdownText(props: SharedCountdownTextProps) {
  const { mode, deadline, status, drawnCount, className } = props;

  const [seconds, setSeconds] = React.useState<number | null>(() =>
    getServerSeconds({ mode, deadline, status, drawnCount })
  );

  React.useEffect(() => {
    const tick = () => {
      const sv = getServerSeconds({ mode, deadline, status, drawnCount });
      setSeconds(sv);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [mode, deadline, status, drawnCount]);

  return (
    <span className={className}>
      {seconds === null ? '…' : mode === 'FETAN' ? `${seconds}s` : formatCountdownClock(seconds)}
    </span>
  );
}
