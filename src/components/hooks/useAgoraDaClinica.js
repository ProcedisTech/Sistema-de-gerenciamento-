import { useEffect, useMemo, useState } from 'react';
import { agoraDaClinica } from '../../utils/datasClinica';
import { useFusoClinica } from './useFusoClinica';

/**
 * Relógio da clínica atualizado a cada `intervaloMs`.
 * Recalcula na hora quando o fuso muda (ex.: UF salva). Sem fuso: valores null.
 * @returns {{ pronto: boolean, fuso: string | null, hojeIso: string | null, hhmm: string | null, minutos: number | null, agora: ReturnType<typeof agoraDaClinica> | null, agoraMs: number }}
 */
export function useAgoraDaClinica(intervaloMs = 30000) {
  const { fuso, pronto } = useFusoClinica();
  const [agoraMs, setAgoraMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setAgoraMs(Date.now()), intervaloMs);
    return () => clearInterval(timer);
  }, [intervaloMs]);

  return useMemo(() => {
    if (!pronto) {
      return { pronto: false, fuso: null, hojeIso: null, hhmm: null, minutos: null, agora: null, agoraMs };
    }
    const agora = agoraDaClinica(fuso, agoraMs);
    return { pronto: true, fuso, hojeIso: agora.dataIso, hhmm: agora.hhmm, minutos: agora.minutos, agora, agoraMs };
  }, [pronto, fuso, agoraMs]);
}
