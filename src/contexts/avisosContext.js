import { createContext } from 'react';

/**
 * `{ assinar(receber) => cancelar }`. `receber` recebe `{ tipo: 'aviso', aviso }` ou `{ tipo: 'recarregar' }`.
 * `null` fora do `AvisosProvider` (o `useAviso` vira no-op).
 */
export const AvisosContext = createContext(null);
