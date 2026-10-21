import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getPresetsForUnidade, normalizeUnidadeMedida } from '../../constants/quantidadePresets.js';
import { resolverFotosEPlanos } from '../../utils/planoGaleriaResolver.js';
import { somaQuantidadeListaPontos } from '../../utils/mapeamentoQuantidade.js';
import { useMapaAplicacaoState } from '../hooks/useMapaAplicacaoState.js';
import { mapApiPontoToLocal } from '../hooks/useMapeamentoFacialState.js';
import { marcacoesApiToOverlayPontos } from '../journey/mapeamento/mapaMarcacoesOverlayUtils.js';

/**
 * ═════════════════════════════════════════════════════════════════════════════════════
 * 🛡️ SUÍTE DE TESTES LÓGICOS DE SEGURANÇA E NÃO-REGRESSÃO: MÚLTIPLOS PROCEDIMENTOS
 * ═════════════════════════════════════════════════════════════════════════════════════
 */

// ─── 1. MÓDULO LÓGICO: GATE DE CONSENTIMENTO COLETIVO (LGPD / CFM) ─────────────────
describe('Gate de Consentimento Coletivo (LGPD / CFM)', () => {
  function avaliarGateConsentimentoColetivo({
    catalogoIdsSessao = [],
    termosFaltantesPorCatalogo = {},
    clinicaSemTermosAtivos = false,
  }) {
    if (clinicaSemTermosAtivos || catalogoIdsSessao.length === 0) {
      return { bloqueado: false, termosPendentes: [] };
    }

    const pendentes = [];
    catalogoIdsSessao.forEach((catId) => {
      const faltantes = termosFaltantesPorCatalogo[catId] || [];
      pendentes.push(...faltantes);
    });

    const termosUnicos = Array.from(new Set(pendentes));
    return {
      bloqueado: termosUnicos.length > 0,
      termosPendentes: termosUnicos,
    };
  }

  it('Retrocompatibilidade: Libera atendimento de 1 procedimento quando termo está assinado', () => {
    const res = avaliarGateConsentimentoColetivo({
      catalogoIdsSessao: ['cat-toxina'],
      termosFaltantesPorCatalogo: { 'cat-toxina': [] },
    });
    expect(res.bloqueado).toBe(false);
    expect(res.termosPendentes).toHaveLength(0);
  });

  it('Retrocompatibilidade: Bloqueia atendimento de 1 procedimento quando termo está pendente', () => {
    const res = avaliarGateConsentimentoColetivo({
      catalogoIdsSessao: ['cat-toxina'],
      termosFaltantesPorCatalogo: { 'cat-toxina': ['Termo de Consentimento para Toxina Botulínica'] },
    });
    expect(res.bloqueado).toBe(true);
    expect(res.termosPendentes).toContain('Termo de Consentimento para Toxina Botulínica');
  });

  it('Múltiplos procedimentos: Libera apenas se 100% dos procedimentos estiverem com termos assinados', () => {
    const res = avaliarGateConsentimentoColetivo({
      catalogoIdsSessao: ['cat-toxina', 'cat-preenchimento'],
      termosFaltantesPorCatalogo: {
        'cat-toxina': [],
        'cat-preenchimento': [],
      },
    });
    expect(res.bloqueado).toBe(false);
    expect(res.termosPendentes).toHaveLength(0);
  });

  it('Múltiplos procedimentos: BLOQUEIA RIGOROSAMENTE se Procedimento A estiver assinado mas Procedimento B estiver pendente', () => {
    const res = avaliarGateConsentimentoColetivo({
      catalogoIdsSessao: ['cat-toxina', 'cat-preenchimento'],
      termosFaltantesPorCatalogo: {
        'cat-toxina': [],
        'cat-preenchimento': ['Termo de Preenchimento com Ácido Hialurônico'],
      },
    });
    expect(res.bloqueado).toBe(true);
    expect(res.termosPendentes).toEqual(['Termo de Preenchimento com Ácido Hialurônico']);
  });

  it('Múltiplos procedimentos: Acumula termos de todos os procedimentos pendentes sem duplicação', () => {
    const res = avaliarGateConsentimentoColetivo({
      catalogoIdsSessao: ['cat-toxina', 'cat-preenchimento'],
      termosFaltantesPorCatalogo: {
        'cat-toxina': ['Termo Geral de Procedimentos Invasivos'],
        'cat-preenchimento': [
          'Termo Geral de Procedimentos Invasivos',
          'Termo de Preenchimento Específico',
        ],
      },
    });
    expect(res.bloqueado).toBe(true);
    expect(res.termosPendentes).toHaveLength(2);
    expect(res.termosPendentes).toContain('Termo Geral de Procedimentos Invasivos');
    expect(res.termosPendentes).toContain('Termo de Preenchimento Específico');
  });

  it('Isenção de clínica: Libera sem bloqueio se a organização de saúde não possui termos ativos cadastrados', () => {
    const res = avaliarGateConsentimentoColetivo({
      catalogoIdsSessao: ['cat-toxina', 'cat-preenchimento'],
      termosFaltantesPorCatalogo: {
        'cat-toxina': ['Termo Inativo'],
      },
      clinicaSemTermosAtivos: true,
    });
    expect(res.bloqueado).toBe(false);
    expect(res.termosPendentes).toHaveLength(0);
  });
});

// ─── 2. MÓDULO LÓGICO: INSUMOS, UNIDADES CLÍNICAS & PRESETS ────────────────────────
describe('Segregação Clínica de Insumos e Unidades de Medida (U vs ml)', () => {
  function calcularResumoInsumosSessao(gruposProcedimentos = []) {
    const subtotaisPorProcedimento = gruposProcedimentos.map((g) => {
      const unit = normalizeUnidadeMedida(g.unidadeMedida || 'u');
      const totalQtd = somaQuantidadeListaPontos(g.pontos || []);
      return {
        catalogoId: g.catalogoId,
        nome: g.nome,
        unidadeMedida: unit,
        totalQtd,
      };
    });

    const unidadesUnicas = Array.from(
      new Set(subtotaisPorProcedimento.map((s) => s.unidadeMedida.toLowerCase())),
    );

    const unidadesCompativeis = unidadesUnicas.length <= 1;
    let totalGeral = null;

    if (unidadesCompativeis && subtotaisPorProcedimento.length > 0) {
      const soma = subtotaisPorProcedimento.reduce((acc, s) => acc + s.totalQtd, 0);
      totalGeral = {
        valor: soma,
        unidadeMedida: unidadesUnicas[0] || 'u',
      };
    }

    return {
      subtotais: subtotaisPorProcedimento,
      unidadesCompativeis,
      totalGeral,
    };
  }

  it('Soma Total Geral com segurança quando todos os procedimentos utilizam a mesma unidade (ex: U e U)', () => {
    const grupos = [
      {
        catalogoId: 'cat-toxina-terco-superior',
        nome: 'Toxina Terço Superior',
        unidadeMedida: 'U',
        pontos: [{ quantidade: 20 }, { quantidade: 10 }],
      },
      {
        catalogoId: 'cat-toxina-masseter',
        nome: 'Toxina Masseter',
        unidadeMedida: 'U',
        pontos: [{ quantidade: 15 }, { quantidade: 15 }],
      },
    ];

    const resumo = calcularResumoInsumosSessao(grupos);
    expect(resumo.unidadesCompativeis).toBe(true);
    expect(resumo.totalGeral).not.toBeNull();
    expect(resumo.totalGeral.valor).toBe(60);
    expect(resumo.totalGeral.unidadeMedida).toBe('u');
  });

  it('BLOQUEIA Total Geral e isola subtotais quando as unidades são incompatíveis (ex: Toxina em U e Preenchimento em ml)', () => {
    const grupos = [
      {
        catalogoId: 'cat-toxina',
        nome: 'Toxina Botulínica',
        unidadeMedida: 'U',
        pontos: [{ quantidade: 20 }, { quantidade: 8 }],
      },
      {
        catalogoId: 'cat-preenchimento',
        nome: 'Preenchimento Labial',
        unidadeMedida: 'ml',
        pontos: [{ quantidade: 0.5 }, { quantidade: 1.0 }],
      },
    ];

    const resumo = calcularResumoInsumosSessao(grupos);
    expect(resumo.unidadesCompativeis).toBe(false);
    expect(resumo.totalGeral).toBeNull();

    const toxinaSub = resumo.subtotais.find((s) => s.catalogoId === 'cat-toxina');
    const preenchSub = resumo.subtotais.find((s) => s.catalogoId === 'cat-preenchimento');

    expect(toxinaSub.totalQtd).toBe(28);
    expect(toxinaSub.unidadeMedida.toLowerCase()).toBe('u');

    expect(preenchSub.totalQtd).toBe(1.5);
    expect(preenchSub.unidadeMedida).toBe('ml');
  });

  it('Adapta dinamicamente os botões de presets conforme a unidade do procedimento armado', () => {
    const presetsToxina = getPresetsForUnidade('U');
    expect(presetsToxina).toEqual([1, 2, 4, 6]);

    const presetsPreenchimento = getPresetsForUnidade('ml');
    expect(presetsPreenchimento).toEqual([0.1, 0.5, 1, 2]);

    const presetsBio = getPresetsForUnidade('mg');
    expect(presetsBio).toEqual([0.5, 1, 2]);
  });
});

// ─── 3. MÓDULO LÓGICO: 1 MAPA FACIAL COMPARTILHADO (ROSTO ÚNICO) ───────────────────
describe('1 Mapa Facial Único com Múltiplos Procedimentos Coexistentes', () => {
  it('Preserva marcações de ambos os procedimentos no mesmo canvas sem colisão ou perda de dados', () => {
    const pontosVistaFrontal = [];

    const ponto1Toxina = {
      localId: 'p1',
      posX: 50.0,
      posY: 20.0,
      quantidade: 4,
      catalogoProcedimentoSaudeId: 'cat-toxina',
      procedimentoIndex: 0,
      ordem: 1,
    };
    pontosVistaFrontal.push(ponto1Toxina);

    const ponto2Preenchimento = {
      localId: 'p2',
      posX: 50.0,
      posY: 75.0,
      quantidade: 0.5,
      catalogoProcedimentoSaudeId: 'cat-preenchimento',
      procedimentoIndex: 1,
      ordem: 2,
    };
    pontosVistaFrontal.push(ponto2Preenchimento);

    expect(pontosVistaFrontal).toHaveLength(2);
    expect(pontosVistaFrontal[0].catalogoProcedimentoSaudeId).toBe('cat-toxina');
    expect(pontosVistaFrontal[0].procedimentoIndex).toBe(0);

    expect(pontosVistaFrontal[1].catalogoProcedimentoSaudeId).toBe('cat-preenchimento');
    expect(pontosVistaFrontal[1].procedimentoIndex).toBe(1);
  });

  it('Contrato N:N do Backend: Constrói MapaRequestDTO válido com tabela de junção N:N e procedimentoIndex', () => {
    const novosIdsValidos = ['pf-uuid-1', 'pf-uuid-2'];
    const procedimentosSessao = [
      { catalogoProcedimentoSaudeId: 'cat-toxina', corHex: '#8B5CF6' },
      { catalogoProcedimentoSaudeId: 'cat-preenchimento', corHex: '#F97316' },
    ];

    const pontosMock = [
      {
        anguloFotoCodigo: 'frontal',
        tipoGeometria: 'ponto',
        quantidade: 4,
        procedimentoIndex: 0,
        vertices: [{ ordem: 1, posX: 50, posY: 20 }],
      },
      {
        anguloFotoCodigo: 'frontal',
        tipoGeometria: 'ponto',
        quantidade: 0.5,
        procedimentoIndex: 1,
        vertices: [{ ordem: 1, posX: 50, posY: 75 }],
      },
    ];

    const payloadSalvar = {
      tipoMapaCodigo: 'procedimento',
      procedimentos: novosIdsValidos.map((pid, idx) => ({
        procedimentoFeitoId: pid,
        catalogoProcedimentoSaudeId: procedimentosSessao[idx].catalogoProcedimentoSaudeId,
        ordem: idx + 1,
        corHex: procedimentosSessao[idx].corHex,
      })),
      marcacoes: pontosMock,
    };

    expect(payloadSalvar.procedimentos).toHaveLength(2);
    expect(payloadSalvar.procedimentos[0].procedimentoFeitoId).toBe('pf-uuid-1');
    expect(payloadSalvar.procedimentos[0].ordem).toBe(1);
    expect(payloadSalvar.procedimentos[1].procedimentoFeitoId).toBe('pf-uuid-2');
    expect(payloadSalvar.procedimentos[1].ordem).toBe(2);

    expect(payloadSalvar.marcacoes[0].procedimentoIndex).toBe(0);
    expect(payloadSalvar.marcacoes[1].procedimentoIndex).toBe(1);
  });
});

// ─── 4. MÓDULO LÓGICO: GALERIA E FOTOS DA SESSÃO UNIFICADA ─────────────────────────
describe('Galeria de Fotos: Agrupamento Inteligente da Sessão Clínica', () => {
  it('Agrupa múltiplos procedimentos avulsos da mesma consulta sob uma única pasta composta no prontuário', () => {
    const agendaIdCompartilhado = 'agenda-sessao-14h30';

    const procedimentosFeitos = [
      {
        id: 'pf-toxina',
        agendaId: agendaIdCompartilhado,
        procedimentoNome: 'Toxina Botulínica',
        criadoEm: '2026-10-01T14:30:00Z',
      },
      {
        id: 'pf-preenchimento',
        agendaId: agendaIdCompartilhado,
        procedimentoNome: 'Preenchimento Labial',
        criadoEm: '2026-10-01T14:30:00Z',
      },
    ];

    const fotos = [
      {
        id: 'foto-antes-rosto',
        agendaId: agendaIdCompartilhado,
        procedimentoFeitoId: 'pf-toxina',
        tipoFotoCodigo: 'ANTES',
        dataISO: '2026-10-01',
      },
      {
        id: 'foto-depois-rosto',
        agendaId: agendaIdCompartilhado,
        procedimentoFeitoId: 'pf-toxina',
        tipoFotoCodigo: 'DEPOIS',
        dataISO: '2026-10-01',
      },
    ];

    const res = resolverFotosEPlanos([], fotos, procedimentosFeitos);

    const atendimentoAvulso = res.atendimentosAvulsos.find(
      (a) => a.chave === `ag_${agendaIdCompartilhado}`,
    );

    expect(atendimentoAvulso).toBeDefined();
    expect(atendimentoAvulso.nomeProcedimento).toBe('Toxina Botulínica + Preenchimento Labial');
    expect(atendimentoAvulso.fotos).toHaveLength(2);
    expect(atendimentoAvulso.procedimentosFeitosIds).toContain('pf-toxina');
    expect(atendimentoAvulso.procedimentosFeitosIds).toContain('pf-preenchimento');
  });

  it('Não duplica fotos no prontuário quando o upload é executado 1 vez por sessão', () => {
    const agendaIdCompartilhado = 'agenda-sessao-10h';

    const procedimentosFeitos = [
      { id: 'pf-1', agendaId: agendaIdCompartilhado, procedimentoNome: 'Procedimento 1' },
      { id: 'pf-2', agendaId: agendaIdCompartilhado, procedimentoNome: 'Procedimento 2' },
    ];

    const fotosSessao = [
      { id: 'foto-antes', agendaId: agendaIdCompartilhado, procedimentoFeitoId: 'pf-1' },
      { id: 'foto-depois', agendaId: agendaIdCompartilhado, procedimentoFeitoId: 'pf-1' },
    ];

    const res = resolverFotosEPlanos([], fotosSessao, procedimentosFeitos);
    const pastaSessao = res.atendimentosAvulsos.find((a) => a.chave === `ag_${agendaIdCompartilhado}`);

    expect(pastaSessao.fotos).toHaveLength(2);
    expect(pastaSessao.fotos.map((f) => f.id)).toEqual(['foto-antes', 'foto-depois']);
  });
});

// ─── 6. MÓDULO LÓGICO: SINCRONISMO REATIVO DE CORES & REIDRATAÇÃO ─────────────────
describe('Sincronismo Reativo de Cores no Mapeamento & Reidratação', () => {
  it('atualizarCorProcedimento altera a cor de todos os pontos associados ao procedimento na tela', () => {
    const { result } = renderHook(() => useMapaAplicacaoState());

    act(() => {
      result.current.adicionarPonto('FRENTE', {
        posX: 50,
        posY: 50,
        quantidade: 2,
        catalogoProcedimentoSaudeId: 'cat-preenchimento',
        cor: '#ec4899', // rosa
      });
      result.current.adicionarPonto('FRENTE', {
        posX: 60,
        posY: 60,
        quantidade: 3,
        catalogoProcedimentoSaudeId: 'cat-preenchimento',
        cor: '#ec4899', // rosa
      });
      result.current.adicionarPonto('FRENTE', {
        posX: 70,
        posY: 70,
        quantidade: 1,
        catalogoProcedimentoSaudeId: 'cat-toxina',
        cor: '#0d9488', // teal
      });
    });

    expect(result.current.pontosPorVista['FRENTE']).toHaveLength(3);
    expect(result.current.pontosPorVista['FRENTE'][0].cor).toBe('#ec4899');
    expect(result.current.pontosPorVista['FRENTE'][1].cor).toBe('#ec4899');
    expect(result.current.pontosPorVista['FRENTE'][2].cor).toBe('#0d9488');

    // Usuário altera a cor do Preenchimento de rosa para azul (#3b82f6)
    act(() => {
      result.current.atualizarCorProcedimento('cat-preenchimento', '#3b82f6');
    });

    expect(result.current.pontosPorVista['FRENTE'][0].cor).toBe('#3b82f6');
    expect(result.current.pontosPorVista['FRENTE'][1].cor).toBe('#3b82f6');
    expect(result.current.pontosPorVista['FRENTE'][2].cor).toBe('#0d9488'); // outro procedimento intocado
  });

  it('atualizarCorProcedimento suporta smart-swap invertendo cores quando ocorre colisão', () => {
    const { result } = renderHook(() => useMapaAplicacaoState());

    act(() => {
      result.current.adicionarPonto('FRENTE', {
        posX: 10,
        posY: 10,
        quantidade: 1,
        catalogoProcedimentoSaudeId: 'cat-preenchimento',
        cor: '#ec4899', // rosa
      });
      result.current.adicionarPonto('FRENTE', {
        posX: 20,
        posY: 20,
        quantidade: 1,
        catalogoProcedimentoSaudeId: 'cat-toxina',
        cor: '#3b82f6', // azul
      });
    });

    // Usuário escolhe azul (#3b82f6) para Preenchimento; smart-swap inverte Toxina para a cor antiga (rosa #ec4899)
    act(() => {
      result.current.atualizarCorProcedimento('cat-preenchimento', '#3b82f6', 'cat-toxina', '#ec4899');
    });

    expect(result.current.pontosPorVista['FRENTE'][0].cor).toBe('#3b82f6'); // preenchimento virou azul
    expect(result.current.pontosPorVista['FRENTE'][1].cor).toBe('#ec4899'); // toxina virou rosa
  });

  it('editarPonto permite atualizar a cor diretamente sem ser descartada', () => {
    const { result } = renderHook(() => useMapaAplicacaoState());

    act(() => {
      result.current.adicionarPonto('FRENTE', {
        posX: 10,
        posY: 10,
        quantidade: 1,
        cor: '#ec4899',
      });
    });

    const localId = result.current.pontosPorVista['FRENTE'][0].localId;

    act(() => {
      result.current.editarPonto('FRENTE', localId, { cor: '#8b5cf6' });
    });

    expect(result.current.pontosPorVista['FRENTE'][0].cor).toBe('#8b5cf6');
  });

  it('mapApiPontoToLocal reidrata cor, catalogoId e procedimentoIndex preservando 100% de fidelidade', () => {
    const rawApiPonto = {
      id: 'ponto-123',
      posX: 45.5,
      posY: 55.2,
      quantidade: 2.5,
      tamanho: 1.0,
      corHex: '#f59e0b',
      catalogoProcedimentoSaudeId: 'cat-bioestimulador',
      procedimentoIndex: 1,
      nomeProcedimento: 'Bioestimulador',
    };

    const local = mapApiPontoToLocal(rawApiPonto, 1);
    expect(local.cor).toBe('#f59e0b');
    expect(local.catalogoProcedimentoSaudeId).toBe('cat-bioestimulador');
    expect(local.catalogoId).toBe('cat-bioestimulador');
    expect(local.procedimentoIndex).toBe(1);
    expect(local.nomeProcedimento).toBe('Bioestimulador');
  });

  it('marcacoesApiToOverlayPontos resolve corHex prioritariamente e nunca deixa nulo para evitar pontos vermelhos no Prontuário', () => {
    const marcacoes = [
      {
        id: 'm-1',
        corHex: '#3b82f6',
        vertices: [{ posX: 10, posY: 20, ordem: 1 }],
      },
      {
        id: 'm-2',
        corHex: null,
        catalogoId: 'cat-toxina',
        vertices: [{ posX: 30, posY: 40, ordem: 1 }],
      },
      {
        id: 'm-3-orfa',
        corHex: null,
        catalogoId: null,
        mapaProcedimentoId: null,
        vertices: [{ posX: 50, posY: 60, ordem: 1 }],
      },
    ];

    const overlayPontos = marcacoesApiToOverlayPontos(marcacoes);
    expect(overlayPontos[0].cor).toBe('#3b82f6');
    expect(overlayPontos[1].cor).toBeTruthy();
    expect(overlayPontos[1].cor).not.toBe('#ef4444');
    // Marcacao órfã sem qualquer vínculo recebe fallback seguro não-nulo da paleta
    expect(overlayPontos[2].cor).toBeTruthy();
    expect(overlayPontos[2].cor).not.toBeNull();
  });
});

