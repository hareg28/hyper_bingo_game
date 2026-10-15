'use client';

import React from 'react';
import { formatCountdownClock, getFetanClock, getSpecialPickClock } from '../../lib/bingoUtils';

type SharedCountdownTextProps = {
  mode: 'FETAN' | 'SPECIAL';
  deadline?: number | null;
  status?: string;
  drawnCount?: number;
  className?: string;
};

function getRemainingSeconds({ mode, deadline, status, drawnCount = 0 }: SharedCountdownTextProps): number {
  return mode === 'FETAN'
    ? getFetanClock().secondsLeft
    : getSpecialPickClock(deadline, status, drawnCount).secondsLeft;
}

/** Ticks locally without rerendering the large game room or lottery board. */
export default function SharedCountdownText(props: SharedCountdownTextProps) {
  const { mode, deadline, status, drawnCount, className } = props;
  const [seconds, setSeconds] = React.useState(() => getRemainingSeconds({ mode, deadline, status, drawnCount }));

  React.useEffect(() => {
    const update = () => setSeconds(getRemainingSeconds({ mode, deadline, status, drawnCount }));
    update();
    const timer = window.setInterval(update, 1000);
    const resume = () => {
      if (document.visibilityState === 'visible') update();
    };
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [mode, deadline, status, drawnCount]);

  return (
    <span className={className}>
      {mode === 'FETAN' ? `${seconds}s` : formatCountdownClock(seconds)}
    </span>
  );
}
