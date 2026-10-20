import { describe, it, expect, vi, beforeEach } from 'vitest';
import { persistirMapaAplicacao } from './persistirMapaAplicacao.js';
import { mapasApi } from '../services/api.js';

vi.mock('../services/api.js', () => ({
  mapasApi: { salvar: vi.fn() },
  pacientesGaleriaApi: { upload: vi.fn() },
}));

describe('persistirMapaAplicacao - Sessão Multi-Procedimentos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mapasApi.salvar.mockResolvedValue({ id: 'mapa-123' });
  });

  it('não vaza catálogo do procedimento 0 para marcação do procedimento 1 e envia corHex resolvido', async () => {
    const catBiopsia = 'ae05fd5a-3362-46ff-9c0f-2846190ccb87';
    const catDrenagem = '34c86deb-f026-426c-8eef-20a8674f514a';

    const snapshot = {
      fotosPorVista: {},
      dirtyVistas: ['frontal'],
      pontosPorVista: {
        frontal: [
          { localId: 'p0', procedimentoIndex: 0, posX: 10, posY: 20, quantidade: 1, tamanho: 1 },
          { localId: 'p1', procedimentoIndex: 1, posX: 30, posY: 40, quantidade: 1, tamanho: 1 },
        ],
      },
    };

    const res = await persistirMapaAplicacao({
      pacienteId: 'pac-1',
      roleUserId: 'user-1',
      procedimentoFeitoIds: ['pf-0', 'pf-1'],
      catalogoProcedimentoSaudeId: catBiopsia,
      procedimentosSessao: [
        { id: 'pf-0', catalogoProcedimentoSaudeId: catBiopsia, corHex: '#d946ef' },
        { id: 'pf-1', catalogoProcedimentoSaudeId: catDrenagem, corHex: '#64748b' },
      ],
      snapshot,
    });

    expect(res.ok).toBe(true);
    const payload = mapasApi.salvar.mock.calls[0][0];

    // Procedimentos no payload
    expect(payload.procedimentos[0].corHex).toBe('#d946ef');
    expect(payload.procedimentos[0].catalogoProcedimentoSaudeId).toBe(catBiopsia);
    expect(payload.procedimentos[1].corHex).toBe('#64748b');
    expect(payload.procedimentos[1].catalogoProcedimentoSaudeId).toBe(catDrenagem);

    // Marcações: marcação 1 NÃO herda catBiopsia e herda corHex do procedimento
    expect(payload.marcacoes[0].catalogoProcedimentoSaudeId).toBe(catBiopsia);
    expect(payload.marcacoes[0].corHex).toBe('#d946ef');
    expect(payload.marcacoes[1].catalogoProcedimentoSaudeId).toBe(catDrenagem);
    expect(payload.marcacoes[1].corHex).toBe('#64748b');
  });

  it('preserva corHex e catálogo em lote com 4 procedimentos avulsos prevenindo colisão vermelha #ef4444', async () => {
    const cat1 = 'ae05fd5a-3362-46ff-9c0f-2846190ccb87'; // Biópsia (#d946ef)
    const cat2 = '34c86deb-f026-426c-8eef-20a8674f514a'; // Drenagem (#64748b)
    const cat3 = '8ef9175f-b64e-4b12-ad92-cdd640c03a26'; // Proc 3 (#ec4899)
    const cat4 = '54b9041a-d3a0-43ce-b2be-c31dddcfffa7'; // Proc 4 (#3b82f6)

    const snapshot = {
      fotosPorVista: {},
      dirtyVistas: ['frontal'],
      pontosPorVista: {
        frontal: [
          { localId: 'p0', procedimentoIndex: 0, posX: 49.4, posY: 36.5, quantidade: 1, tamanho: 1 },
          { localId: 'p1', procedimentoIndex: 1, posX: 58.3, posY: 47.3, quantidade: 1, tamanho: 1 },
          { localId: 'p2', procedimentoIndex: 2, posX: 55.1, posY: 54.4, quantidade: 1, tamanho: 1 },
          { localId: 'p3', procedimentoIndex: 3, posX: 34.4, posY: 50.8, quantidade: 1, tamanho: 1 },
        ],
      },
    };

    // Item 0 veio de useJourneyState com nomeProcedimentoCatalogoId
    const res = await persistirMapaAplicacao({
      pacienteId: 'pac-1',
      roleUserId: 'user-1',
      procedimentoFeitoIds: ['pf-0', 'pf-1', 'pf-2', 'pf-3'],
      catalogoProcedimentoSaudeId: cat1,
      procedimentosSessao: [
        { id: 'pf-0', nomeProcedimentoCatalogoId: cat1, corHex: '#d946ef' },
        { id: 'pf-1', catalogoProcedimentoSaudeId: cat2, corHex: '#64748b' },
        { id: 'pf-2', catalogoProcedimentoSaudeId: cat3, corHex: '#ec4899' },
        { id: 'pf-3', catalogoProcedimentoSaudeId: cat4, corHex: '#3b82f6' },
      ],
      snapshot,
    });

    expect(res.ok).toBe(true);
    const payload = mapasApi.salvar.mock.calls[0][0];

    expect(payload.procedimentos).toHaveLength(4);
    // Cada procedimento tem sua cor canônica e NUNCA cai em #ef4444 por engano
    expect(payload.procedimentos[0].corHex).toBe('#d946ef');
    expect(payload.procedimentos[0].catalogoProcedimentoSaudeId).toBe(cat1);
    expect(payload.procedimentos[1].corHex).toBe('#64748b');
    expect(payload.procedimentos[2].corHex).toBe('#ec4899');
    expect(payload.procedimentos[3].corHex).toBe('#3b82f6');

    // As 4 marcações respeitam rigorosamente suas cores
    expect(payload.marcacoes[0].corHex).toBe('#d946ef');
    expect(payload.marcacoes[1].corHex).toBe('#64748b');
    expect(payload.marcacoes[2].corHex).toBe('#ec4899');
    expect(payload.marcacoes[3].corHex).toBe('#3b82f6');
  });
});
