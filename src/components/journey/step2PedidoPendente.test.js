import {
  carregarEnvioAtivoDocumento,
  escolherFichaEmBrancoPendente,
  montarPedidoPendente,
  pedidoVencido,
} from './step2PedidoPendente.js';

vi.mock('../../services/api', () => ({
  anamneseApi: { getDocumento: vi.fn() },
}));

import { anamneseApi } from '../../services/api';

const branco = (id, dataHora, extra = {}) => ({
  id,
  anamneseId: 'f1',
  status: 'aguardando_paciente',
  preenchidoPorPaciente: true,
  quantidadeRespostas: 0,
  dataHora,
  ...extra,
});

describe('escolherFichaEmBrancoPendente', () => {
  it('null/vazio → null', () => {
    expect(escolherFichaEmBrancoPendente(null)).toBeNull();
    expect(escolherFichaEmBrancoPendente(undefined)).toBeNull();
    expect(escolherFichaEmBrancoPendente([])).toBeNull();
  });

  it('escolhe o branco pendente mais recente', () => {
    const antigo = branco('a', '2026-08-01T10:00:00Z');
    const novo = branco('b', '2026-09-01T10:00:00Z');
    expect(escolherFichaEmBrancoPendente([antigo, novo])?.id).toBe('b');
  });

  it('ignora finalizada, com respostas, hub e status diferente', () => {
    const lista = [
      branco('fin', '2026-09-02T10:00:00Z', { status: 'finalizada' }),
      branco('resp', '2026-09-03T10:00:00Z', { quantidadeRespostas: 3 }),
      branco('hub', '2026-09-04T10:00:00Z', { status: 'aguardando_assinatura', preenchidoPorPaciente: false }),
      branco('cancel', '2026-09-05T10:00:00Z', { status: 'cancelada' }),
    ];
    expect(escolherFichaEmBrancoPendente(lista)).toBeNull();
  });
});

describe('montarPedidoPendente', () => {
  const ficha = branco('pre1', '2026-09-01T10:00:00Z');

  it('monta com envio PENDENTE', () => {
    expect(montarPedidoPendente(ficha, { id: 'env1', status: 'PENDENTE', expiraEm: '2026-09-02T10:00:00Z' }))
      .toEqual({
        envioId: 'env1',
        preenchimentoId: 'pre1',
        enviadoEm: '2026-09-01T10:00:00Z',
        expiraEm: '2026-09-02T10:00:00Z',
      });
  });

  it('null sem envio ou com status diferente de PENDENTE', () => {
    expect(montarPedidoPendente(ficha, null)).toBeNull();
    expect(montarPedidoPendente(ficha, { id: 'env1', status: 'CONCLUIDO' })).toBeNull();
    expect(montarPedidoPendente(null, { id: 'env1', status: 'PENDENTE' })).toBeNull();
  });
});

describe('pedidoVencido', () => {
  const agora = Date.parse('2026-09-01T12:00:00Z');

  it('sem expiraEm não vence', () => {
    expect(pedidoVencido({ envioId: 'e' }, agora)).toBe(false);
    expect(pedidoVencido(null, agora)).toBe(false);
  });

  it('vence quando expiraEm <= agora', () => {
    expect(pedidoVencido({ expiraEm: '2026-09-01T12:00:00Z' }, agora)).toBe(true);
    expect(pedidoVencido({ expiraEm: '2026-09-01T11:00:00Z' }, agora)).toBe(true);
    expect(pedidoVencido({ expiraEm: '2026-09-01T13:00:00Z' }, agora)).toBe(false);
  });
});

describe('carregarEnvioAtivoDocumento', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem ids não chama a API', async () => {
    expect(await carregarEnvioAtivoDocumento(null, 'p')).toBeNull();
    expect(anamneseApi.getDocumento).not.toHaveBeenCalled();
  });

  it('retorna envioAtivo do documento', async () => {
    anamneseApi.getDocumento.mockResolvedValue({ envioAtivo: { id: 'e1', status: 'PENDENTE' } });
    expect(await carregarEnvioAtivoDocumento('pac', 'pre')).toEqual({ id: 'e1', status: 'PENDENTE' });
    expect(anamneseApi.getDocumento).toHaveBeenCalledWith('pac', 'pre');
  });

  it('erro → null', async () => {
    anamneseApi.getDocumento.mockRejectedValue(new Error('x'));
    expect(await carregarEnvioAtivoDocumento('pac', 'pre')).toBeNull();
  });
});
