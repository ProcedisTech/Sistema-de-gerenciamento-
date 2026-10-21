import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { ConsultaHub } from './ConsultaHub.jsx';

vi.mock('../../services/api', () => ({
  termosApi: { resolver: vi.fn() },
  anamneseApi: { listPaciente: vi.fn() },
  planejamentosApi: { listarPorPaciente: vi.fn() },
  getApiErrorDetail: () => '',
}));
vi.mock('../../hooks/usePapel.js', () => ({ usePapel: () => null }));
vi.mock('../hooks/useFusoClinica.js', () => ({ useFusoClinica: () => ({ fuso: 'America/Sao_Paulo' }) }));

const { termosApi, anamneseApi, planejamentosApi } = await import('../../services/api');

const PACIENTE = { id: 'p-1', nome: 'Ana Souza' };

async function esperar(ms = 400) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('ConsultaHub — indicadores rebuscam por aviso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    termosApi.resolver.mockResolvedValue({ faltantes: [] });
    anamneseApi.listPaciente.mockResolvedValue([]);
    planejamentosApi.listarPorPaciente.mockResolvedValue([]);
  });

  it('cada aviso rebusca uma vez só o indicador dele; recarregar rebusca todos', async () => {
    const avisos = criarAvisosFalsos();
    render(
      <avisos.Wrapper>
        <ConsultaHub paciente={PACIENTE} catalogoIds={['cat-1']} onSelectModule={() => {}} />
      </avisos.Wrapper>,
    );
    await esperar(50);
    expect(termosApi.resolver).toHaveBeenCalledTimes(1);
    expect(anamneseApi.listPaciente).toHaveBeenCalledTimes(1);
    expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledTimes(1);

    act(() => avisos.emitirAviso(AVISO.TERMOS.ASSINATURA_REMOTA_ALTERADA));
    await esperar();
    expect(termosApi.resolver).toHaveBeenCalledTimes(2);
    expect(anamneseApi.listPaciente).toHaveBeenCalledTimes(1);
    expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledTimes(1);

    act(() => avisos.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO));
    await esperar();
    expect(anamneseApi.listPaciente).toHaveBeenCalledTimes(2);

    act(() => avisos.emitirAviso(AVISO.ATENDIMENTO.SESSAO_ALTERADA));
    await esperar();
    expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledTimes(2);
    expect(termosApi.resolver).toHaveBeenCalledTimes(2);

    act(() => avisos.emitirRecarregar());
    await esperar();
    expect(termosApi.resolver).toHaveBeenCalledTimes(3);
    expect(anamneseApi.listPaciente).toHaveBeenCalledTimes(3);
    expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledTimes(3);
  });
});
