import { useCallback, useEffect, useRef, useState } from 'react';
import { equipeApi } from '../services/api';
import { contarPrecisamDeVoce } from '../components/configuracoes/equipePrototypeUtils';

/** Quantos usuários ativos estão sem perfil de acesso. Busca ao montar e de novo a cada recarregar(); falha vira 0, em silêncio. */
export function usePendenciasEquipe(habilitado) {
  const [pendencias, setPendencias] = useState(0);
  const [versao, setVersao] = useState(0);
  const promessa = useRef(null);

  const recarregar = useCallback(() => {
    promessa.current = null;
    setVersao((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!habilitado) return undefined;
    let vivo = true;
    // A promessa fica no ref: o 2o efeito do StrictMode reaproveita a mesma chamada.
    if (!promessa.current) {
      promessa.current = (async () => {
        try {
          const data = await equipeApi.list(); // request() ja devolve o JSON: lista ou {content}
          return contarPrecisamDeVoce(Array.isArray(data) ? data : data?.content || []);
        } catch {
          return 0; // sem aviso: o ponto e so um indicador
        }
      })();
    }
    promessa.current.then((n) => {
      if (vivo) setPendencias(n);
    });
    return () => {
      vivo = false;
    };
  }, [habilitado, versao]);

  return { pendencias, recarregar };
}
