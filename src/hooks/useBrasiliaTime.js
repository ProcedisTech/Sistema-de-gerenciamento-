import { useState, useEffect } from 'react';
import { getBrasiliaNow } from '../utils/agendaAvailability.js';

/**
 * Hook reativo que fornece a data e o minuto do dia atuais no fuso oficial de Brasília (America/Sao_Paulo).
 * Atualiza automaticamente a cada 30 segundos para manter slots passados bloqueados em tempo real.
 */
export function useBrasiliaTime(pollIntervalMs = 30000) {
  const [brasiliaTime, setBrasiliaTime] = useState(() => getBrasiliaNow());

  useEffect(() => {
    const update = () => setBrasiliaTime(getBrasiliaNow());
    const timer = setInterval(update, pollIntervalMs);
    return () => clearInterval(timer);
  }, [pollIntervalMs]);

  return brasiliaTime;
}
