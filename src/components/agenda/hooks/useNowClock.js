import { useEffect, useState } from 'react';

function formatClock(now) {
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Relógio ao vivo (HH:MM), atualiza a cada 60s. */
export function useNowClock() {
  const [clockLabel, setClockLabel] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const tick = () => setClockLabel(formatClock(new Date()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return clockLabel;
}
