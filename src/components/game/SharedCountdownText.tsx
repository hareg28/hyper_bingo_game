'use client';

import React from 'react';
import { formatCountdownClock, getFetanClock, getSpecialPickClock } from '../../lib/bingoUtils';
import { isMiniAppActive, subscribeToMiniAppActivity } from '../../lib/miniAppActivity';

type SharedCountdownTextProps = {
  mode: 'FETAN' | 'SPECIAL' | 'ROUND';
  deadline?: number | null;
  status?: string;
  drawnCount?: number;
  className?: string;
};

function getRemainingSeconds({ mode, deadline, status, drawnCount = 0 }: SharedCountdownTextProps): number {
  if (mode === 'FETAN') return getFetanClock(deadline, status, drawnCount).secondsLeft;
  if (mode === 'SPECIAL') return getSpecialPickClock(deadline, status, drawnCount).secondsLeft;
  return deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
}

/** Ticks locally without rerendering the large game room or lottery board. */
export default function SharedCountdownText(props: SharedCountdownTextProps) {
  const { mode, deadline, status, drawnCount, className } = props;
  const [seconds, setSeconds] = React.useState(() => getRemainingSeconds({ mode, deadline, status, drawnCount }));

  React.useEffect(() => {
    const update = () => {
      if (!isMiniAppActive()) return;
      setSeconds(getRemainingSeconds({ mode, deadline, status, drawnCount }));
    };
    update();
    const timer = window.setInterval(update, 1000);
    const unsubscribe = subscribeToMiniAppActivity(update);
    const resume = () => update();
    window.addEventListener('focus', resume);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', resume);
      unsubscribe();
    };
  }, [mode, deadline, status, drawnCount]);

  return (
    <span className={className}>
      {mode === 'FETAN' ? `${seconds}s` : formatCountdownClock(seconds)}
    </span>
  );
}
