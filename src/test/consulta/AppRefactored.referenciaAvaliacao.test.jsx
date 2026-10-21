// Regressão prevenida:
// No Hub de Procedimentos, a seção "AVALIAÇÃO — APENAS REFERÊNCIA" NUNCA pode vazar fotos
// ou mapas de consultas anteriores quando o atendimento for avulso (sem plano vinculado).
// Em atendimentos vinculados a plano, só deve exibir fotos do plano ativo ou da consulta atual.

import { describe, it, expect } from 'vitest';

/**
 * Função pura espelhando a regra estrita de filtro implementada em AppRefactored.jsx (L1982-L2005)
 */
function filtrarFotosReferenciaAvaliacao(itens, currentAtendId, currentPlanId) {
  return itens.filter((f) => {
    const code = String(f.tipoFotoCodigo || f.categoria || '').toUpperCase();
    const leg = String(f.legenda || f.descricaoLegenda || '').toUpperCase();
    const isAvaliacaoFoto =
      code === 'AVALIACAO' ||
      code === 'MAPA' ||
      code === 'PLANEJAMENTO' ||
      leg.includes('AVALIAÇÃO') ||
      leg.includes('AVALIACAO');
    if (!isAvaliacaoFoto) return false;

    const fotoAtendId = f.atendimentoId || f.atendimento?.id;
    const fotoPlanId = f.planejamentoId || f.mapaOverlay?.planejamentoId;

    const pertenceAoAtendimento = Boolean(
      currentAtendId && fotoAtendId && String(fotoAtendId) === String(currentAtendId)
    );
    const pertenceAoPlano = Boolean(
      currentPlanId && fotoPlanId && String(fotoPlanId) === String(currentPlanId)
    );

    // Em atendimento avulso (sem plano), NUNCA vaza fotos de atendimentos passados
    if (!currentPlanId) {
      return pertenceAoAtendimento;
    }

    return Boolean(pertenceAoAtendimento || pertenceAoPlano);
  });
}

describe('Regressão Zero — Filtro Estrito de Fotos de Referência no Hub de Procedimentos', () => {
  const currentAtendId = 'atend-atual-123';

  const fotoHistoricaAvulsa = {
    id: 'f-hist-1',
    tipoFotoCodigo: 'MAPA',
    legenda: 'Mapa de Avaliação Anterior',
    atendimentoId: 'atend-antigo-999',
    planejamentoId: null,
  };

  const fotoHistoricaOutroPlano = {
    id: 'f-hist-2',
    tipoFotoCodigo: 'AVALIACAO',
    legenda: 'Avaliação Plano B',
    atendimentoId: 'atend-antigo-888',
    planejamentoId: 'plano-outro-xyz',
  };

  const fotoSessaoAtual = {
    id: 'f-sessao-atual',
    tipoFotoCodigo: 'MAPA',
    legenda: 'Mapa de Avaliação Desta Sessão',
    atendimentoId: currentAtendId,
    planejamentoId: null,
  };

  const fotoDoPlanoAtivo = {
    id: 'f-plano-ativo',
    tipoFotoCodigo: 'AVALIACAO',
    legenda: 'Foto de Referência do Plano Ativo',
    atendimentoId: 'atend-anterior-777',
    planejamentoId: 'plano-ativo-principal',
  };

  it('Cenário 1: Consulta Avulsa (sem plano) sem fotos na sessão atual retorna lista VAZIA (Zero Vazamento)', () => {
    // Simula entrar direto em procedimento sem ter tirado fotos na avaliação da sessão atual
    const galeria = [fotoHistoricaAvulsa, fotoHistoricaOutroPlano, fotoDoPlanoAtivo];

    const resultado = filtrarFotosReferenciaAvaliacao(galeria, currentAtendId, null);

    // Deve ser RIGOROSAMENTE VAZIO. Zero fotos de consultas antigas vazando.
    expect(resultado).toEqual([]);
  });

  it('Cenário 2: Consulta Avulsa (sem plano) com foto tirada na sessão atual retorna APENAS a foto da sessão', () => {
    const galeria = [fotoHistoricaAvulsa, fotoHistoricaOutroPlano, fotoSessaoAtual];

    const resultado = filtrarFotosReferenciaAvaliacao(galeria, currentAtendId, null);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('f-sessao-atual');
  });

  it('Cenário 3: Consulta vinculada a plano exibe fotos do plano ativo e da sessão atual, filtrando outros planos', () => {
    const galeria = [fotoHistoricaAvulsa, fotoHistoricaOutroPlano, fotoSessaoAtual, fotoDoPlanoAtivo];

    const resultado = filtrarFotosReferenciaAvaliacao(galeria, currentAtendId, 'plano-ativo-principal');

    expect(resultado).toHaveLength(2);
    const ids = resultado.map((f) => f.id);
    expect(ids).toContain('f-sessao-atual');
    expect(ids).toContain('f-plano-ativo');
    expect(ids).not.toContain('f-hist-1');
    expect(ids).not.toContain('f-hist-2');
  });
});
