import { useEffect, useState } from 'react';

/** Relógio compartilhado para rail (now-line, countdown, sufixos de período). */
export function useTickInterval(ms = 60_000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [ms]);

  return now;
}
