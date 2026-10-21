/**
 * Servidor SSE falso para os testes do canal de avisos: `fetchImpl` controlável, corpo em fluxo
 * (o teste empurra bytes quando quiser) e abort do `AbortController` derrubando a leitura.
 */
import { vi } from 'vitest';

export function criarCorpoFalso() {
  const fila = [];
  let esperando = null;
  let fim = null;

  const entregar = (resultado) => {
    if (esperando) {
      const e = esperando;
      esperando = null;
      if (resultado.erro) e.reject(resultado.erro);
      else e.resolve(resultado);
    } else {
      fila.push(resultado);
    }
  };

  const reader = {
    read: () =>
      new Promise((resolve, reject) => {
        if (fila.length) {
          const r = fila.shift();
          if (r.erro) reject(r.erro);
          else resolve(r);
          return;
        }
        if (fim) {
          if (fim.erro) reject(fim.erro);
          else resolve({ done: true, value: undefined });
          return;
        }
        esperando = { resolve, reject };
      }),
  };

  return {
    body: { getReader: () => reader, cancel: () => Promise.resolve() },
    enviar(texto) {
      if (fim) return;
      entregar({ done: false, value: texto });
    },
    fechar() {
      if (fim) return;
      fim = { done: true };
      entregar({ done: true, value: undefined });
    },
    abortar() {
      if (fim) return;
      fim = { erro: new DOMException('Aborted', 'AbortError') };
      entregar(fim);
    },
  };
}

export const sse = {
  conectado: (id = '0') => `event: conectado\nid: ${id}\ndata: {"v":1}\n\n`,
  recarregar: (id = '0') => `event: recarregar\nid: ${id}\ndata: {"v":1}\n\n`,
  substituida: () => 'event: substituida\ndata: {"v":1}\n\n',
  aviso: (id, tipo, registroId = null, porMim = false) =>
    `event: aviso\nid: ${id}\ndata: {"v":1,"tipo":"${tipo}","registroId":${
      registroId == null ? 'null' : `"${registroId}"`
    },"atendimentoId":null,"porMim":${porMim}}\n\n`,
  batida: () => ': hb\n\n',
};

/**
 * @param {{ responder?: (n: number, init: RequestInit) => ({ status?: number, headers?: Record<string,string>, erro?: boolean } | undefined) }} [opts]
 */
export function criarServidorFalso({ responder } = {}) {
  const conexoes = [];
  const respostas = [];
  let chamadas = 0;

  const fetchImpl = vi.fn(async (url, init) => {
    chamadas += 1;
    const spec = respostas.shift() ?? responder?.(chamadas, init) ?? { status: 200 };
    if (spec.erro) throw new TypeError('Failed to fetch');
    const status = spec.status ?? 200;
    const headers = new Headers(spec.headers || {});
    if (status !== 200) {
      return { status, ok: false, headers, body: { cancel: () => Promise.resolve() } };
    }
    const corpo = criarCorpoFalso();
    const conexao = {
      url,
      init,
      headers: init.headers,
      aberta: true,
      enviar: (t) => corpo.enviar(t),
      fechar: () => {
        conexao.aberta = false;
        corpo.fechar();
      },
    };
    init.signal?.addEventListener('abort', () => {
      conexao.aberta = false;
      corpo.abortar();
    });
    conexoes.push(conexao);
    spec.aoAbrir?.(conexao);
    return { status, ok: true, headers, body: corpo.body };
  });

  return {
    fetchImpl,
    conexoes,
    responder: (spec) => respostas.push(spec),
    ultima: () => conexoes[conexoes.length - 1],
    abertas: () => conexoes.filter((c) => c.aberta),
  };
}

let visibilidadeAtual = 'visible';

/** Controla `document.visibilityState` e dispara `visibilitychange`. */
export function definirVisibilidade(estado) {
  visibilidadeAtual = estado;
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibilidadeAtual,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

export function prepararVisibilidade() {
  visibilidadeAtual = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibilidadeAtual,
  });
}
