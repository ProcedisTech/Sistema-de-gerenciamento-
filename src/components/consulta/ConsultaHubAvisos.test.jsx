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

  const planoAtivo = (feitas) => ({
    id: 'pl-1',
    statusCodigo: 'ATIVO',
    itens: [
      { id: 'i-1', statusItem: feitas >= 1 ? 'FINALIZADO' : 'PLANEJADO' },
      { id: 'i-2', statusItem: feitas >= 2 ? 'FINALIZADO' : 'PLANEJADO' },
    ],
  });

  // F-c
  it('PLANEJAMENTO.ALTERADO do paciente relê o plano e o selo mostra o novo "x de y"', async () => {
    planejamentosApi.listarPorPaciente.mockResolvedValue([planoAtivo(0)]);
    const avisos = criarAvisosFalsos();
    const { container } = render(
      <avisos.Wrapper>
        <ConsultaHub paciente={PACIENTE} catalogoIds={['cat-1']} onSelectModule={() => {}} />
      </avisos.Wrapper>,
    );
    await esperar(50);
    expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('0 de 2');

    planejamentosApi.listarPorPaciente.mockResolvedValue([planoAtivo(1)]);
    act(() => avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE.id));
    await esperar();
    expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('1 de 2');
  });

  // F-i (selo)
  it('releitura por aviso que falha (500) mantém o selo "x de y" e não mostra erro', async () => {
    planejamentosApi.listarPorPaciente.mockResolvedValue([planoAtivo(1)]);
    const avisos = criarAvisosFalsos();
    const { container } = render(
      <avisos.Wrapper>
        <ConsultaHub paciente={PACIENTE} catalogoIds={['cat-1']} onSelectModule={() => {}} />
      </avisos.Wrapper>,
    );
    await esperar(50);
    expect(container.textContent).toContain('1 de 2');

    planejamentosApi.listarPorPaciente.mockRejectedValue(new Error('500'));
    act(() => avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE.id));
    await esperar();
    expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('1 de 2');
    expect(container.textContent).not.toMatch(/Não foi possível carregar/);
  });

  it('AGENDA.REAGENDADO (sem filtro de paciente) relê o plano e o selo reflete o servidor', async () => {
    planejamentosApi.listarPorPaciente.mockResolvedValue([planoAtivo(0)]);
    const avisos = criarAvisosFalsos();
    const { container } = render(
      <avisos.Wrapper>
        <ConsultaHub paciente={PACIENTE} catalogoIds={['cat-1']} onSelectModule={() => {}} />
      </avisos.Wrapper>,
    );
    await esperar(50);
    expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('0 de 2');

    planejamentosApi.listarPorPaciente.mockResolvedValue([planoAtivo(2)]);
    act(() => avisos.emitirAviso('AGENDA.REAGENDADO', 'agenda-qualquer'));
    await esperar();
    expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('2 de 2');
  });
});
