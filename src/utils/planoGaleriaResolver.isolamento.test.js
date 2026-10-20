// Regressão prevenida:
// Fotos e mapas de avaliação avulsos ou de outros planos do paciente NÃO podem vazar
// para o plano ativo. Mapas só pertencem ao plano se houver vínculo explícito (planejamentoId ou planejamentoItemId).
// Nenhuma entidade no banco (tb_planejamento ou tb_galeria_foto no GET /galeria) usa atendimentoId.

import { describe, it, expect } from 'vitest';
import { resolverFotosEPlanos } from './planoGaleriaResolver.js';

describe('Regressão Zero — Isolamento Estrito de Fotos por Plano (Anti-Cross-Plan Leakage)', () => {
  const planoAntigoConcluido = {
    id: 'plano-antigo-123',
    nome: 'Plano Antigo',
    statusCodigo: 'concluido',
    itens: [
      { id: 'item-1', planejamentoItemId: 'item-1', catalogoProcedimentoSaudeId: 'cat-biopsia', catalogoId: 'cat-biopsia' },
      { id: 'item-2', planejamentoItemId: 'item-2', catalogoProcedimentoSaudeId: 'cat-drenagem', catalogoId: 'cat-drenagem' },
    ],
  };

  const planoNovoAtivo = {
    id: 'plano-novo-456',
    nome: 'Plano Novo Ativo',
    statusCodigo: 'ativo',
    itens: [
      { id: 'item-3', planejamentoItemId: 'item-3', catalogoProcedimentoSaudeId: 'cat-biopsia', catalogoId: 'cat-biopsia' },
      { id: 'item-4', planejamentoItemId: 'item-4', catalogoProcedimentoSaudeId: 'cat-drenagem', catalogoId: 'cat-drenagem' },
    ],
  };

  it('Cenário 1: Mapa de avaliação vinculado ao plano via planejamentoItemId vincula estritamente ao plano correto', () => {
    const mapaDoPlanoNovo = {
      id: 'foto-mapa-novo',
      categoria: 'avaliacao',
      tipoFotoCodigo: 'AVALIACAO',
      mapaOverlay: {
        mapaId: 'mapa-novo-1',
        planejamentoItemId: 'item-3',
        procedimentos: [{ catalogoProcedimentoSaudeId: 'cat-biopsia', planejamentoItemId: 'item-3' }],
      },
    };

    const galeriaFotos = [mapaDoPlanoNovo];
    const planos = [planoAntigoConcluido, planoNovoAtivo];

    const { fotosPorPlanoId, fotosAvulsas } = resolverFotosEPlanos(planos, galeriaFotos, []);

    const fotosNoPlanoNovo = fotosPorPlanoId['plano-novo-456'] || [];
    expect(fotosNoPlanoNovo.map((f) => f.id)).toEqual(['foto-mapa-novo']);
    expect(fotosAvulsas).toHaveLength(0);
  });

  it('Cenário 2: Mapa de avaliação avulso (sem planejamentoItemId/planejamentoId) NUNCA vaza para o plano ativo', () => {
    const mapaAvulso = {
      id: 'foto-mapa-avulso',
      categoria: 'avaliacao',
      tipoFotoCodigo: 'AVALIACAO',
      mapaOverlay: {
        mapaId: 'mapa-avulso-1',
        planejamentoItemId: null,
        planejamentoId: null,
        procedimentos: [
          { catalogoProcedimentoSaudeId: 'cat-biopsia', planejamentoItemId: null },
          { catalogoProcedimentoSaudeId: 'cat-drenagem', planejamentoItemId: null },
        ],
      },
    };

    const galeriaFotos = [mapaAvulso];
    const planos = [planoAntigoConcluido, planoNovoAtivo];

    const { fotosPorPlanoId, fotosAvulsas, atendimentosAvulsos } = resolverFotosEPlanos(planos, galeriaFotos, []);

    // Não deve entrar em NENHUM plano ativo
    expect(fotosPorPlanoId['plano-novo-456'] || []).toHaveLength(0);
    expect(fotosPorPlanoId['plano-antigo-123'] || []).toHaveLength(0);

    // Deve ser catalogado como foto/atendimento avulso
    const idsAvulsos = [...fotosAvulsas, ...atendimentosAvulsos.flatMap((a) => a.fotos)].map((f) => f.id);
    expect(idsAvulsos).toContain('foto-mapa-avulso');
  });

  it('Cenário 3: Mapa com planejamentoId explícito do plano antigo NUNCA vaza para o novo plano ativo', () => {
    const mapaDoPlanoAntigo = {
      id: 'foto-mapa-antigo',
      categoria: 'avaliacao',
      tipoFotoCodigo: 'AVALIACAO',
      planejamentoId: 'plano-antigo-123',
      mapaOverlay: {
        mapaId: 'mapa-antigo-1',
        planejamentoId: 'plano-antigo-123',
        procedimentos: [{ catalogoProcedimentoSaudeId: 'cat-biopsia' }],
      },
    };

    const mapaDoPlanoNovo = {
      id: 'foto-mapa-novo',
      categoria: 'avaliacao',
      tipoFotoCodigo: 'AVALIACAO',
      planejamentoId: 'plano-novo-456',
      mapaOverlay: {
        mapaId: 'mapa-novo-2',
        planejamentoId: 'plano-novo-456',
        procedimentos: [{ catalogoProcedimentoSaudeId: 'cat-biopsia' }],
      },
    };

    const galeriaFotos = [mapaDoPlanoAntigo, mapaDoPlanoNovo];
    const planos = [planoAntigoConcluido, planoNovoAtivo];

    const { fotosPorPlanoId } = resolverFotosEPlanos(planos, galeriaFotos, []);

    const fotosNoPlanoNovo = fotosPorPlanoId['plano-novo-456'] || [];
    expect(fotosNoPlanoNovo.map((f) => f.id)).toEqual(['foto-mapa-novo']);
    expect(fotosNoPlanoNovo.map((f) => f.id)).not.toContain('foto-mapa-antigo');
  });
});
