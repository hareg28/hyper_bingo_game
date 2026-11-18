'use client';

import React from 'react';
import { FETAN_PICK_SECONDS, SPECIAL_PICK_SECONDS, formatCountdownClock, getFetanClock, getSpecialPickClock } from '../../lib/bingoUtils';

type SharedCountdownTextProps = {
  mode: 'FETAN' | 'SPECIAL' | 'ROUND';
  deadline?: number | null;
  status?: string;
  drawnCount?: number;
  className?: string;
};

function getServerSeconds({ mode, deadline, status, drawnCount = 0 }: SharedCountdownTextProps): number {
  if (mode === 'FETAN') {
    const { pickingCards, secondsLeft } = getFetanClock(deadline, status, drawnCount);
    if (pickingCards && deadline && deadline > Date.now()) return secondsLeft;
    if (!deadline && status === 'OPEN' && drawnCount === 0) return FETAN_PICK_SECONDS;
    if (!pickingCards) return 0;
    return 0;
  }
  if (mode === 'SPECIAL') {
    const { pickingCards, secondsLeft } = getSpecialPickClock(deadline, status, drawnCount);
    if (pickingCards && deadline && deadline > Date.now()) return secondsLeft;
    if (!deadline && status === 'OPEN' && drawnCount === 0) return SPECIAL_PICK_SECONDS;
    if (!pickingCards) return 0;
    return 0;
  }
  // ROUND mode always uses the deadline directly
  return deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
}

/** Displays the countdown clock; fallbacks ensure it never freezes at ellipses. */
export default function SharedCountdownText(props: SharedCountdownTextProps) {
  const { mode, deadline, status, drawnCount, className } = props;

  const [seconds, setSeconds] = React.useState<number>(() =>
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
      {mode === 'FETAN' ? `${seconds}s` : formatCountdownClock(seconds)}
    </span>
  );
}
