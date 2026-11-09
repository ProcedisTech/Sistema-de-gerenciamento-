import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { saidaManual } from './saidaManual.js';

const ESTADO_INICIAL = { id: undefined, ultimoId: null, chave: 'inicial' };

/**
 * Chave da árvore interna: só muda em saída manual (-> 'anon', depois o id do novo login) ou troca de pessoa.
 * Saída involuntária + mesmo usuário mantém a chave (não remonta a tela).
 */
export const useChaveDaSessao = () => {
  const [estado, setEstado] = useState(ESTADO_INICIAL);

  useEffect(() => {
    let alive = true;
    let leitura = 0;
    const pendentes = new Set();

    const aplicar = (novoId) => {
      setEstado((prev) => {
        if (prev.id === novoId) return prev;
        let chave = prev.chave;
        let ultimoId = novoId ?? prev.ultimoId;
        if (prev.id !== undefined) {
          if (novoId === null) {
            if (saidaManual.existe()) {
              chave = 'anon';
              ultimoId = null; // saída manual esquece o usuário: o próximo login, mesmo o mesmo id, remonta
            }
          } else if (novoId !== prev.ultimoId) {
            chave = novoId;
          }
        }
        return { id: novoId, ultimoId, chave };
      });
    };

    const ler = () => {
      const minha = ++leitura;
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!alive || minha !== leitura) return;
          aplicar(data?.session?.user?.id ?? null);
        })
        .catch(() => {});
    };

    // Mesmo padrão do useAuthState: nunca usa a sessão do evento nem chama o supabase dentro do callback.
    const t0 = setTimeout(() => {
      pendentes.delete(t0);
      ler();
    }, 0);
    pendentes.add(t0);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      const t = setTimeout(() => {
        pendentes.delete(t);
        ler();
      }, 0);
      pendentes.add(t);
    });

    return () => {
      alive = false;
      pendentes.forEach((t) => clearTimeout(t));
      pendentes.clear();
      subscription.unsubscribe();
    };
  }, []);

  return estado.chave;
};
