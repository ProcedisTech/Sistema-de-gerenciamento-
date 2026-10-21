import { describe, it, expect, vi, beforeEach } from 'vitest';
import { garantirProcedimentosNoPlano } from './sincronizarProcedimentosPlanoAgenda.js';
import { planejamentosApi } from '../services/api.js';

vi.mock('../services/api.js', () => ({
  planejamentosApi: {
    listarPorPaciente: vi.fn(),
    criar: vi.fn(),
    adicionarItem: vi.fn(),
  },
}));

describe('sincronizarProcedimentosPlanoAgenda', () => {
  const pacienteUuid = '11111111-1111-1111-1111-111111111111';
  const roleUuid = '22222222-2222-2222-2222-222222222222';
  const botoxCatUuid = '33333333-3333-3333-3333-333333333333';
  const preenchCatUuid = '44444444-4444-4444-4444-444444444444';
  const planoExistenteUuid = '55555555-5555-5555-5555-555555555555';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna objeto vazio se pacienteId não for UUID válido', async () => {
    const res = await garantirProcedimentosNoPlano({
      pacienteId: 'invalido',
      catalogoProcedimentoSaudeIds: [botoxCatUuid],
    });
    expect(res).toEqual({});
    expect(planejamentosApi.listarPorPaciente).not.toHaveBeenCalled();
  });

  it('retorna objeto vazio se não houver catálogo IDs válidos', async () => {
    const res = await garantirProcedimentosNoPlano({
      pacienteId: pacienteUuid,
      catalogoProcedimentoSaudeIds: ['invalido'],
    });
    expect(res).toEqual({});
    expect(planejamentosApi.listarPorPaciente).not.toHaveBeenCalled();
  });

  it('reutiliza plano ativo existente e itens existentes sem criar novos desnecessariamente', async () => {
    planejamentosApi.listarPorPaciente.mockResolvedValue([
      {
        id: planoExistenteUuid,
        statusCodigo: 'ativo',
        itens: [
          {
            planejamentoItemId: 'item-botox-existente',
            catalogoProcedimentoSaudeId: botoxCatUuid,
            statusProcedimentoCodigo: 'planejado',
          },
        ],
      },
    ]);

    const res = await garantirProcedimentosNoPlano({
      pacienteId: pacienteUuid,
      catalogoProcedimentoSaudeIds: [botoxCatUuid],
      roleUserId: roleUuid,
    });

    expect(planejamentosApi.criar).not.toHaveBeenCalled();
    expect(planejamentosApi.adicionarItem).not.toHaveBeenCalled();
    expect(res).toEqual({
      [botoxCatUuid]: 'item-botox-existente',
    });
  });

  it('anexa novo item ao plano ativo existente quando o procedimento ainda não está no plano', async () => {
    planejamentosApi.listarPorPaciente.mockResolvedValue([
      {
        id: planoExistenteUuid,
        statusCodigo: 'ativo',
        itens: [
          {
            planejamentoItemId: 'item-botox-existente',
            catalogoProcedimentoSaudeId: botoxCatUuid,
            statusProcedimentoCodigo: 'planejado',
          },
        ],
      },
    ]);

    planejamentosApi.adicionarItem.mockResolvedValue({
      planejamentoItemId: 'item-preench-novo',
    });

    const res = await garantirProcedimentosNoPlano({
      pacienteId: pacienteUuid,
      catalogoProcedimentoSaudeIds: [botoxCatUuid, preenchCatUuid],
      roleUserId: roleUuid,
      dataIso: '2026-10-20',
    });

    expect(planejamentosApi.criar).not.toHaveBeenCalled();
    expect(planejamentosApi.adicionarItem).toHaveBeenCalledTimes(1);
    expect(planejamentosApi.adicionarItem).toHaveBeenCalledWith(planoExistenteUuid, {
      catalogoProcedimentoSaudeId: preenchCatUuid,
      tipo: 'manual',
      dataPlanejada: '2026-10-20',
      roleUserId: roleUuid,
    });

    expect(res).toEqual({
      [botoxCatUuid]: 'item-botox-existente',
      [preenchCatUuid]: 'item-preench-novo',
    });
  });

  it('cria novo plano automaticamente se paciente não tiver plano ativo', async () => {
    planejamentosApi.listarPorPaciente.mockResolvedValue([]);
    const novoPlanoId = '66666666-6666-6666-6666-666666666666';
    planejamentosApi.criar.mockResolvedValue({
      planejamentoId: novoPlanoId,
    });
    planejamentosApi.adicionarItem.mockResolvedValue({
      planejamentoItemId: 'item-criado-1',
    });

    const res = await garantirProcedimentosNoPlano({
      pacienteId: pacienteUuid,
      catalogoProcedimentoSaudeIds: [botoxCatUuid],
      roleUserId: roleUuid,
    });

    expect(planejamentosApi.criar).toHaveBeenCalledWith({
      pacienteId: pacienteUuid,
      observacao: 'Plano de Tratamento',
      roleUserId: roleUuid,
    });
    expect(planejamentosApi.adicionarItem).toHaveBeenCalledWith(novoPlanoId, {
      catalogoProcedimentoSaudeId: botoxCatUuid,
      tipo: 'manual',
      roleUserId: roleUuid,
    });
    expect(res).toEqual({
      [botoxCatUuid]: 'item-criado-1',
    });
  });

  it('é resiliente a falhas de rede e não lança exceção', async () => {
    planejamentosApi.listarPorPaciente.mockRejectedValue(new Error('Falha de conexão com servidor'));

    const res = await garantirProcedimentosNoPlano({
      pacienteId: pacienteUuid,
      catalogoProcedimentoSaudeIds: [botoxCatUuid],
    });

    expect(res).toEqual({});
  });
});
