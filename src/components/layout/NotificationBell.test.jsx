import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationBell from './NotificationBell.jsx';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { PAYLOAD_REAL } from '../../utils/notificacaoPayloadsReais.js';
import { ToastContext } from '../../contexts/toastContext.js';

vi.mock('../../services/api.js', () => ({
  notificacoesApi: {
    contarNaoLidas: vi.fn(),
    listar: vi.fn(),
    marcarLida: vi.fn(),
    marcarTodasLidas: vi.fn(),
  },
}));

vi.mock('../hooks/useFusoClinica.js', () => ({ useFusoClinica: () => ({ fuso: 'Asia/Tokyo', pronto: true }) }));

import { notificacoesApi } from '../../services/api.js';

const passar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

const toasts = { urgente: vi.fn(), error: vi.fn() };

function montar() {
  const canal = criarAvisosFalsos();
  const Wrapper = ({ children }) => (
    <ToastContext.Provider value={toasts}>
      <canal.Wrapper>{children}</canal.Wrapper>
    </ToastContext.Provider>
  );
  const onVerTodas = vi.fn();
  render(<NotificationBell onVerTodas={onVerTodas} />, { wrapper: Wrapper });
  return { ...canal, onVerTodas };
}

const aviso = (id, nivel, extra = {}) => ({
  id, tipo: 'CONSULTA_ENCERRADA', tipoNome: 'Consulta encerrada', nivel, acendeSino: nivel !== 'SILENCIOSA',
  lida: false, payload: JSON.stringify(PAYLOAD_REAL.CONSULTA_ENCERRADA), criadoEm: '2026-10-24T15:00:00Z', ...extra,
});
const pagina = (...content) => ({ content, totalElements: content.length });

describe('NotificationBell — contagem pelo canal de avisos', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    notificacoesApi.contarNaoLidas.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('busca ao montar e não faz polling', async () => {
    montar();
    await passar(0);
    expect(notificacoesApi.contarNaoLidas).toHaveBeenCalledTimes(1);
    await passar(5 * 60_000);
    expect(notificacoesApi.contarNaoLidas).toHaveBeenCalledTimes(1);
  });

  it.each([AVISO.NOTIFICACAO.CRIADA, AVISO.NOTIFICACAO.ALTERADA])('rebusca a contagem em %s', async (tipo) => {
    const canal = montar();
    await passar(0);
    notificacoesApi.contarNaoLidas.mockResolvedValue({ count: 3 });
    canal.emitirAviso(tipo, 'n-1');
    await passar(300);
    expect(notificacoesApi.contarNaoLidas).toHaveBeenCalledTimes(2);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('10 NOTIFICACAO.CRIADA em 100 ms disparam uma única busca da contagem', async () => {
    const canal = montar();
    await passar(0);
    for (let i = 0; i < 10; i += 1) {
      canal.emitirAviso(AVISO.NOTIFICACAO.CRIADA, `n-${i}`);
      await passar(10);
    }
    await passar(300);
    expect(notificacoesApi.contarNaoLidas).toHaveBeenCalledTimes(2);
  });

  it('avisos de outros módulos não rebuscam', async () => {
    const canal = montar();
    await passar(0);
    canal.emitirAviso(AVISO.AGENDA.CRIADO, 'ag-1');
    await passar(1000);
    expect(notificacoesApi.contarNaoLidas).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationBell — destaque e toast urgente', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    notificacoesApi.contarNaoLidas.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('SILENCIOSA não lida fica sem destaque; NORMAL não lida tem destaque', async () => {
    notificacoesApi.listar.mockResolvedValue(pagina(aviso('s', 'SILENCIOSA'), aviso('n', 'NORMAL')));
    montar();
    await passar(0);
    await act(async () => { screen.getByLabelText('Notificações').click(); });
    await passar(0);
    const linhas = screen.getAllByRole('button').filter((el) => el.tagName === 'LI');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).not.toHaveClass('bg-emerald-50');
    expect(linhas[1]).toHaveClass('bg-emerald-50');
  });

  it('toast só para URGENTE nova: não na 1a carga, não repetido, não NORMAL nem lida', async () => {
    notificacoesApi.listar.mockResolvedValue(pagina(aviso('u0', 'URGENTE')));
    const canal = montar();
    await passar(0);
    expect(toasts.urgente).not.toHaveBeenCalled();

    notificacoesApi.listar.mockResolvedValue(
      pagina(aviso('u1', 'URGENTE'), aviso('n1', 'NORMAL'), aviso('u2', 'URGENTE', { lida: true }), aviso('u0', 'URGENTE')),
    );
    canal.emitirAviso(AVISO.NOTIFICACAO.CRIADA, 'u1');
    await passar(300);
    expect(toasts.urgente).toHaveBeenCalledTimes(1);
    const [texto, opts] = toasts.urgente.mock.calls[0];
    expect(texto).toBe('Consulta de Maria encerrada por Dra. Ana');
    expect(opts.titulo).toBe('Urgente · Consulta encerrada');
    expect(opts.acao.label).toBe('Ver notificações');
    opts.acao.onClick();
    expect(canal.onVerTodas).toHaveBeenCalledTimes(1);

    canal.emitirAviso(AVISO.NOTIFICACAO.ALTERADA, 'u1');
    await passar(300);
    expect(toasts.urgente).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationBell — fuso da clínica', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    notificacoesApi.contarNaoLidas.mockResolvedValue({ count: 1 });
  });
  afterEach(() => vi.useRealTimers());

  it('o tempo relativo usa o fuso da clínica (Tóquio: mesmo dia; em São Paulo seria "ontem")', async () => {
    vi.setSystemTime(new Date('2026-10-24T05:00:00Z'));
    notificacoesApi.listar.mockResolvedValue(pagina(aviso('t', 'NORMAL', { criadoEm: '2026-10-24T02:30:00Z' })));
    montar();
    await passar(0);
    await act(async () => { screen.getByLabelText('Notificações').click(); });
    await passar(0);
    expect(screen.getByText('há 2 h')).toBeInTheDocument();
  });
});
