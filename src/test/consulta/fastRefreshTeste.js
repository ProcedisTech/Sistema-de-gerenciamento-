/**
 * Simula, no app de teste, o "hot update" do Vite (React Fast Refresh) de um componente: a árvore e o estado
 * continuam, mas o React roda de novo TODOS os efeitos do componente ignorando as dependências
 * (react-dom-client.development.js, `areHookInputsEqual` com `ignorePreviousDependencies`). É o que acontece no
 * `npm run dev` quando o AppRefactored.jsx, ou um módulo que ele importa (hooks da consulta), muda com a tela aberta.
 *
 * Usa os mesmos pontos de entrada do react-refresh (`setRefreshHandler` e `scheduleRefresh`), recebidos por um
 * gancho de DevTools mínimo. Este arquivo tem de ser o PRIMEIRO import do arquivo de teste: o react-dom só se
 * registra no gancho quando é carregado.
 */
import { act } from 'react';

let internos = null;
const raizes = new Set();

globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
  supportsFiber: true,
  renderers: new Map(),
  inject(i) {
    internos = i;
    return 1;
  },
  onScheduleFiberRoot() {},
  onCommitFiberRoot(_id, raiz) {
    raizes.add(raiz);
  },
  onPostCommitFiberRoot() {},
  onCommitFiberUnmount() {},
};

function acharTipo(fibra, nome) {
  for (let f = fibra; f; f = f.sibling) {
    if (typeof f.type === 'function' && f.type.name === nome) return f.type;
    const filho = acharTipo(f.child, nome);
    if (filho) return filho;
  }
  return null;
}

/** "Hot update" do componente `nome` (função com esse nome) em todas as raízes montadas. */
export async function simularFastRefresh(nome) {
  if (!internos) throw new Error('O react-dom carregou antes do gancho: importe fastRefreshTeste.js primeiro.');
  for (const raiz of raizes) {
    const original = acharTipo(raiz.current, nome);
    if (!original) continue;
    const familia = { current: (props) => original(props) };
    internos.setRefreshHandler((tipo) => (tipo === original || tipo === familia.current ? familia : undefined));
    await act(async () => {
      internos.scheduleRefresh(raiz, { staleFamilies: new Set(), updatedFamilies: new Set([familia]) });
    });
    return;
  }
  throw new Error(`Componente ${nome} não encontrado na árvore montada.`);
}
