import { useContext } from 'react';
import { DisponibilidadeRevisionContext } from './disponibilidadeRevisionContext.js';

export function useDisponibilidadeRevision() {
  const ctx = useContext(DisponibilidadeRevisionContext);
  if (!ctx) {
    if (import.meta.env.DEV) {
      console.warn('[Procedi] useDisponibilidadeRevision fora do Provider.');
    }
    return { revision: 0, bumpRevision: () => {} };
  }
  return ctx;
}
