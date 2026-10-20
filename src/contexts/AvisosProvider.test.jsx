import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosProvider } from './AvisosProvider.jsx';
import { AvisosContext } from './avisosContext.js';
import { useAviso } from './useAviso.js';
import { criarLeitorAvisos } from '../services/avisos/canalAvisos.js';
import {
  criarServidorFalso,
  definirVisibilidade,
  prepararVisibilidade,
  sse,
} from '../test/servidorAvisosFalso.js';

vi.mock('../services/api', () => ({
  attemptTokenRefresh: vi.fn(),
  authHeadersForFetch: vi.fn(),
  getFreshToken: vi.fn(),
}));

const passar = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));

function fabricaLeitor(servidor, extras = {}) {
  const obterHeaders = vi.fn(async ({ orgId }) => ({ Authorization: 'Bearer t', 'X-Org-Id': orgId }));
  return (opts) =>
    criarLeitorAvisos({
      ...opts,
      url: '/api/v1/eventos/stream',
      fetchImpl: servidor.fetchImpl,
      obterHeaders,
      // B-42 FD: a renovação devolve o resultado classificado; 'definitiva' = recusada pelo servidor.
      renovarToken: vi.fn().mockResolvedValue({ tipo: 'definitiva' }),
      aleatorio: () => 0.5,
      ...extras,
    });
}

/** Tela de teste: busca ao montar e a cada aviso/recarregar da AGENDA. */
function Tela({ banco, onBusca, onMontar }) {
  const [valor, setValor] = useState(null);
  const montou = useRef(false);
  const buscar = useCallback(async () => {
    onBusca?.();
    const lido = await Promise.resolve(banco.valor);
    setValor(lido);
  }, [banco, onBusca]);
  useEffect(() => {
    if (!montou.current) {
      montou.current = true;
      onMontar?.();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial da tela (setState só após await)
    buscar();
  }, [buscar, onMontar]);
  useAviso('AGENDA', buscar, { debounceMs: 0 });
  return <div data-testid="valor">{String(valor)}</div>;
}

/** Ouvinte cru do contexto: guarda toda mensagem despachada (sem o filtro do useAviso). */
function Ouvinte({ onMensagem }) {
  const ctx = useContext(AvisosContext);
  useEffect(() => ctx.assinar(onMensagem), [ctx, onMensagem]);
  return null;
}

function montar({ servidor, orgId = 'org-1', ativo = true, banco = { valor: 'v1' }, criarLeitor } = {}) {
  const onBusca = vi.fn();
  const onMontar = vi.fn();
  const onMensagem = vi.fn();
  const fabrica = criarLeitor ?? fabricaLeitor(servidor);
  const arvore = (props) => (
    <AvisosProvider orgId={props.orgId} ativo={props.ativo} criarLeitor={fabrica}>
      <Tela banco={banco} onBusca={onBusca} onMontar={onMontar} />
      <Ouvinte onMensagem={onMensagem} />
    </AvisosProvider>
  );
  const utils = render(arvore({ orgId, ativo }));
  return {
    ...utils,
    banco,
    onBusca,
    onMontar,
    onMensagem,
    atualizar: (props) => utils.rerender(arvore({ orgId, ativo, ...props })),
  };
}

describe('AvisosProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    prepararVisibilidade();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('todo conectado do leitor emite um recarregar (o primeiro e as reconexões)', async () => {
    const servidor = criarServidorFalso();
    const { onBusca } = montar({ servidor });
    await passar();
    expect(onBusca).toHaveBeenCalledTimes(1);
    servidor.ultima().enviar(sse.conectado('1'));
    await passar();
    expect(onBusca).toHaveBeenCalledTimes(2);

    servidor.ultima().fechar();
    await passar(1000);
    servidor.ultima().enviar(sse.conectado('1'));
    await passar();
    expect(onBusca).toHaveBeenCalledTimes(3);
  });

  it('despacha {tipo:"conectado", primeiro} a cada conexão, separado do recarregar', async () => {
    const servidor = criarServidorFalso();
    const { onMensagem } = montar({ servidor });
    await passar();
    servidor.ultima().enviar(sse.conectado('1'));
    await passar();
    servidor.ultima().fechar();
    await passar(1000);
    servidor.ultima().enviar(sse.conectado('1'));
    await passar();
    const conectados = onMensagem.mock.calls.map(([m]) => m).filter((m) => m.tipo === 'conectado');
    expect(conectados).toEqual([
      { tipo: 'conectado', primeiro: true },
      { tipo: 'conectado', primeiro: false },
    ]);
    const recarregares = onMensagem.mock.calls.map(([m]) => m).filter((m) => m.tipo === 'recarregar');
    expect(recarregares).toHaveLength(2);
  });

  it('repassa {tipo:"pendencia-liberada", atendimentoId} aos inscritos e o useAviso não dispara por ela', async () => {
    const servidor = criarServidorFalso();
    const { onMensagem, onBusca } = montar({ servidor });
    await passar();
    servidor.ultima().enviar(sse.conectado('1'));
    await passar();
    const buscas = onBusca.mock.calls.length;
    servidor.ultima().enviar('event: pendencia-liberada\ndata: {"atendimentoId":"at-1"}\n\n');
    await passar();
    expect(onMensagem).toHaveBeenCalledWith({ tipo: 'pendencia-liberada', atendimentoId: 'at-1' });
    expect(onBusca).toHaveBeenCalledTimes(buscas);
  });

  it('aviso confirmado entre a busca inicial e o primeiro conectado aparece na tela', async () => {
    const servidor = criarServidorFalso();
    const { banco } = montar({ servidor });
    await passar();
    expect(screen.getByTestId('valor')).toHaveTextContent('v1');
    banco.valor = 'v2';
    servidor.ultima().enviar(sse.conectado('7'));
    await passar();
    expect(screen.getByTestId('valor')).toHaveTextContent('v2');
  });

  it('troca de clínica fecha e reabre o leitor sem remontar os filhos e mostra o dado novo', async () => {
    const servidor = criarServidorFalso();
    const { banco, onMontar, atualizar } = montar({ servidor });
    await passar();
    servidor.ultima().enviar(sse.conectado('1'));
    await passar();
    const antiga = servidor.ultima();

    atualizar({ orgId: 'org-2' });
    await passar();
    expect(antiga.aberta).toBe(false);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    expect(servidor.ultima().headers['X-Org-Id']).toBe('org-2');
    expect(servidor.ultima().headers['Last-Event-ID']).toBeUndefined();
    expect(onMontar).toHaveBeenCalledTimes(1);

    banco.valor = 'clinica-2';
    servidor.ultima().enviar(sse.conectado('3'));
    await passar();
    expect(screen.getByTestId('valor')).toHaveTextContent('clinica-2');
  });

  it('sem conexão enquanto ativo for falso ou sem orgId', async () => {
    const servidor = criarServidorFalso();
    const { atualizar } = montar({ servidor, ativo: false });
    await passar(120_000);
    atualizar({ ativo: true, orgId: '' });
    await passar(120_000);
    expect(servidor.fetchImpl).not.toHaveBeenCalled();
    atualizar({ ativo: true, orgId: 'org-1' });
    await passar();
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('logout (ativo falso) fecha o canal e não rebusca', async () => {
    const servidor = criarServidorFalso();
    const { atualizar, onBusca } = montar({ servidor });
    await passar();
    servidor.ultima().enviar(sse.conectado('1'));
    await passar();
    atualizar({ ativo: false });
    await passar();
    expect(servidor.ultima().aberta).toBe(false);
    const buscas = onBusca.mock.calls.length;
    await passar(5 * 60_000);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
    expect(onBusca).toHaveBeenCalledTimes(buscas);
  });

  it('resposta 200 sem bytes por 30 s liga o modo degradado (recarregar a cada 30 s)', async () => {
    const servidor = criarServidorFalso();
    const { onBusca } = montar({ servidor });
    await passar();
    expect(onBusca).toHaveBeenCalledTimes(1);
    await passar(29_990);
    expect(onBusca).toHaveBeenCalledTimes(1);
    await passar(20);
    expect(onBusca).toHaveBeenCalledTimes(2);
    await passar(30_000);
    expect(onBusca).toHaveBeenCalledTimes(3);
  });

  it('degradado liga após 30 s de erro e desliga ao reconectar', async () => {
    const servidor = criarServidorFalso();
    for (let i = 0; i < 4; i += 1) servidor.responder({ erro: true });
    const { onBusca } = montar({ servidor });
    await passar(30_010);
    expect(onBusca).toHaveBeenCalledTimes(2);
    // backoff 1+2+5+10 s: a 5ª tentativa (t=18 s) abre o stream, ainda sem `conectado`
    await passar(20_000);
    servidor.ultima().enviar(sse.conectado('1'));
    await passar();
    const buscas = onBusca.mock.calls.length;
    for (let t = 0; t < 6; t += 1) {
      servidor.ultima().enviar(sse.batida());
      await passar(20_000);
    }
    expect(onBusca).toHaveBeenCalledTimes(buscas);
  });

  it('aba oculta desconectada não rebusca; ao ficar visível, reconecta', async () => {
    const servidor = criarServidorFalso({ responder: () => ({ erro: true }) });
    const { onBusca } = montar({ servidor });
    await passar();
    definirVisibilidade('hidden');
    await passar();
    const buscas = onBusca.mock.calls.length;
    await passar(6 * 60_000);
    expect(onBusca).toHaveBeenCalledTimes(buscas);

    const chamadas = servidor.fetchImpl.mock.calls.length;
    definirVisibilidade('visible');
    await passar();
    expect(servidor.fetchImpl.mock.calls.length).toBe(chamadas + 1);
  });

  it('aba visível substituída entra em modo degradado até ganhar foco', async () => {
    const servidor = criarServidorFalso();
    const { onBusca } = montar({ servidor });
    await passar();
    servidor.ultima().enviar(sse.conectado('1'));
    await passar();
    servidor.ultima().enviar(sse.substituida());
    await passar();
    const buscas = onBusca.mock.calls.length;
    await passar(30_010);
    expect(onBusca).toHaveBeenCalledTimes(buscas + 1);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await passar();
    servidor.ultima().enviar(sse.conectado('2'));
    await passar();
    const depois = onBusca.mock.calls.length;
    for (let t = 0; t < 4; t += 1) {
      servidor.ultima().enviar(sse.batida());
      await passar(20_000);
    }
    expect(onBusca).toHaveBeenCalledTimes(depois);
  });

  it.each([
    ['403', { status: 403 }],
    ['renovação recusada (definitiva)', { status: 401 }],
  ])('bloqueado (%s) não liga o degradado', async (_nome, resposta) => {
    const servidor = criarServidorFalso({ responder: () => resposta });
    const { onBusca } = montar({ servidor });
    await passar();
    await passar(5 * 60_000);
    expect(onBusca).toHaveBeenCalledTimes(1);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('renovação sem rede (401 + falha de rede) liga o degradado e continua tentando, nunca bloqueia', async () => {
    const servidor = criarServidorFalso({ responder: () => ({ status: 401 }) });
    const renovarToken = vi.fn().mockResolvedValue({ tipo: 'rede' });
    const { onBusca } = montar({ servidor, criarLeitor: fabricaLeitor(servidor, { renovarToken }) });
    await passar();
    expect(onBusca).toHaveBeenCalledTimes(1);
    await passar(30_010);
    expect(onBusca).toHaveBeenCalledTimes(2);
    expect(servidor.fetchImpl.mock.calls.length).toBeGreaterThan(1);
    expect(renovarToken.mock.calls.length).toBe(servidor.fetchImpl.mock.calls.length);
  });

  it('aviso não altera procedi_last_activity', async () => {
    localStorage.setItem('procedi_last_activity', '123');
    sessionStorage.setItem('procedi_last_activity', '123');
    const servidor = criarServidorFalso();
    montar({ servidor });
    await passar();
    servidor.ultima().enviar(sse.conectado('1') + sse.aviso('2', 'AGENDA.CRIADO', 'a') + sse.recarregar('2'));
    await passar(1000);
    expect(localStorage.getItem('procedi_last_activity')).toBe('123');
    expect(sessionStorage.getItem('procedi_last_activity')).toBe('123');
  });
});
