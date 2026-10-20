import { useCallback, useState } from 'react';
import { useAviso } from '../contexts/useAviso.js';

/**
 * Número que sobe a cada aviso do prefixo (e a cada `recarregar` do canal). Entra na lista de dependências de quem
 * busca, para rebuscar uma vez por aviso. Fora do provider de avisos fica sempre 0.
 */
export function useChaveDeAviso(prefixo) {
  const [chave, setChave] = useState(0);
  const subir = useCallback(() => setChave((c) => c + 1), []);
  useAviso(prefixo, subir);
  return chave;
}
