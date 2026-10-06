import React from 'react';
import { act, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnamneseAssinaturaActions } from './AnamneseAssinaturaActions.jsx';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';

vi.mock('../../services/api', () => ({
  anamneseEnvioApi: { status: vi.fn(), cancelar: vi.fn(), gerar: vi.fn() },
  anamneseApi: { getPaciente: vi.fn() },
}));

import { anamneseEnvioApi } from '../../services/api';

const flush = () => act(async () => {});
const passar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function montar(props = {}) {
  const canal = criarAvisosFalsos();
  const onDocumentoRefresh = vi.fn();
  const base = {
    pacienteId: 'pac1',
    preenchimentoId: 'pre1',
    envioAtivo: { id: 'env1', status: 'PENDENTE', expiraEm: '2099-01-01T00:00:00Z' },
    onDocumentoRefresh,
    ...props,
  };
  const utils = render(<AnamneseAssinaturaActions {...base} />, { wrapper: canal.Wrapper });
  return { ...utils, canal, onDocumentoRefresh, base };
}

describe('AnamneseAssinaturaActions — status do envio pelo canal de avisos', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    anamneseEnvioApi.status.mockResolvedValue({ status: 'PENDENTE' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('busca o status ao montar e não volta a consultar sem aviso', async () => {
    montar();
    await flush();
    expect(anamneseEnvioApi.status).toHaveBeenCalledWith('env1');
    await passar(60_000);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1);
  });

  it('aviso do envio com CONCLUIDO atualiza o documento e para de consultar', async () => {
    const { canal, onDocumentoRefresh } = montar();
    await flush();
    anamneseEnvioApi.status.mockResolvedValue({ status: 'CONCLUIDO' });
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env1');
    await passar(300);
    expect(onDocumentoRefresh).toHaveBeenCalledTimes(1);
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env1');
    await passar(300);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(2);
  });

  it.each(['EXPIRADO', 'CANCELADO'])('%s atualiza o documento', async (status) => {
    const { canal, onDocumentoRefresh } = montar();
    await flush();
    anamneseEnvioApi.status.mockResolvedValue({ status });
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, null);
    await passar(300);
    expect(onDocumentoRefresh).toHaveBeenCalledTimes(1);
  });

  it('aviso de outro envio é ignorado; recarregar rebusca', async () => {
    const { canal } = montar();
    await flush();
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env9');
    await passar(1000);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1);
    canal.emitirRecarregar();
    await passar(300);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(2);
  });

  it('busca no vencimento do envio', async () => {
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
    montar({ envioAtivo: { id: 'env1', status: 'PENDENTE', expiraEm: '2026-10-04T12:05:00Z' } });
    await flush();
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1);
    await passar(5 * 60_000);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(2);
  });

  it('sem envio pendente não consulta', async () => {
    const { canal } = montar({ envioAtivo: null });
    await flush();
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, null);
    await passar(1000);
    expect(anamneseEnvioApi.status).not.toHaveBeenCalled();
  });
});
