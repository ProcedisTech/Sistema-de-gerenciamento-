/* eslint-disable react-refresh/only-export-components -- provider + hooks juntos */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';
import { useOrg } from './OrgContext';
import { papelDe, usePapel } from '../hooks/usePapel';

const INATIVA = Object.freeze({
  ativa: false, pessoaId: null, nome: null, perfil: null, codigos: [], entrar() {}, sair() {},
});
const VAZIO = { pessoaId: null, nome: null, perfil: null, codigos: [] };

const PreviaAcessoContext = createContext(null);

/** Estado só em memória; sai sozinha quando o endereço muda. Os códigos servem só para exibição (menu/cabeçalho). */
export function PreviaAcessoProvider({ children }) {
  const [estado, setEstado] = useState(null);
  const { pathname } = useLocation();
  const [anterior, setAnterior] = useState(pathname);
  // Ajuste durante o render: mudar de rota limpa o estado (voltar à rota antiga não ressuscita a prévia).
  if (pathname !== anterior) {
    setAnterior(pathname);
    setEstado(null);
  }
  const previa = estado;

  const entrar = useCallback(({ pessoaId, nome, perfil, codigos }) => {
    setEstado({ pessoaId, nome, perfil, codigos: Array.isArray(codigos) ? codigos : [] });
  }, []);
  const sair = useCallback(() => setEstado(null), []);

  const valor = useMemo(
    () => ({ ativa: previa !== null, ...(previa || VAZIO), entrar, sair }),
    [previa, entrar, sair],
  );

  return (
    <PreviaAcessoContext.Provider value={valor}>
      {children}
      {previa && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="status"
              className="fixed inset-x-0 bottom-[var(--bottom-nav-h)] z-[100] flex items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900 shadow-lg"
            >
              <span>
                Prévia. É assim que {previa.nome}
                {previa.perfil ? ` (${previa.perfil})` : ''} vê o Procedi. Nada aqui muda o acesso dela.
              </span>
              <button type="button" onClick={sair} className="rounded border border-amber-700 px-2 py-0.5 font-medium">
                Sair da prévia
              </button>
            </div>,
            document.body,
          )
        : null}
    </PreviaAcessoContext.Provider>
  );
}

export function usePreviaAcesso() {
  return useContext(PreviaAcessoContext) || INATIVA;
}

/**
 * Papel para EXIBIÇÃO. Na prévia usa um papel não-Dono 'CST_PREVIA' (peso 0, não admin, não nível 1),
 * assim tudo vem só dos códigos da pessoa vista.
 */
export function usePapelExibicao() {
  const real = usePapel();
  const { ativa, codigos } = usePreviaAcesso();
  const { roleUserId } = useOrg();
  return ativa ? papelDe({ papel: 'CST_PREVIA', permissoes: codigos, roleUserId }) : real;
}
