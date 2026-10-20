import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationBell from './NotificationBell.jsx';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';

vi.mock('../../services/api.js', () => ({
  notificacoesApi: {
    contarNaoLidas: vi.fn(),
    listar: vi.fn(),
    marcarLida: vi.fn(),
    marcarTodasLidas: vi.fn(),
  },
}));

import { notificacoesApi } from '../../services/api.js';

const passar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function montar() {
  const canal = criarAvisosFalsos();
  render(<NotificationBell />, { wrapper: canal.Wrapper });
  return canal;
}

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
